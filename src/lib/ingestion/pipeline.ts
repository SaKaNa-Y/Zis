import type { RobotsCacheRecord, RobotsStore } from '@/lib/robots'
import type { PinnedRequest, SafeFetch, SafeFetchResponse, TransportResponse } from '@/lib/safe-fetch'
import { createHash } from 'node:crypto'
import { SaxesParser } from 'saxes'
import { createRobotsGate } from '@/lib/robots'
import { createSafeFetch, SafeFetchError } from '@/lib/safe-fetch'
import { canonicalizeLink, publisherHostKey } from './canonicalize'

const MAX_FEED_BYTES = 2 * 1024 * 1024

type FeedParseErrorCode = 'too_large' | 'unsafe_xml' | 'invalid_xml'

class FeedParseError extends Error {
  readonly code: FeedParseErrorCode

  constructor(code: FeedParseErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FeedParseError'
    this.code = code
  }
}

interface ParsedFeedItem {
  guid?: string
  link?: string
  outboundUrls: ParsedOutboundUrl[]
  title: string
  summary?: string
  rawFeedDate?: string
}

interface ParsedOutboundUrl {
  rawUrl: string
  baseUrl?: string
}

interface MutableFeedItem {
  fields: Map<string, string>
  atomLink?: string
  guidCanBeLink?: boolean
  outboundUrls: Set<string>
}

const ITEM_FIELDS = new Set([
  'title',
  'description',
  'summary',
  'content',
  'encoded',
  'guid',
  'id',
  'pubdate',
  'published',
  'updated',
  'link',
])

const CONTENT_FIELDS = new Set(['summary', 'description', 'content', 'encoded'])

function localName(name: string): string {
  return (name.split(':').at(-1) ?? name).toLowerCase()
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function decodeCharacterReferences(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: '\'',
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return text.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (whole, decimal: string, hex: string, name: string) => {
    const value = decimal === undefined
      ? hex === undefined ? named[name.toLowerCase()] : String.fromCodePoint(Number.parseInt(hex, 16))
      : String.fromCodePoint(Number.parseInt(decimal, 10))
    return value ?? whole
  })
}

function plainText(text: string): string {
  return collapse(decodeCharacterReferences(text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')))
}

function extractHrefs(html: string): string[] {
  const urls = new Set<string>()
  const anchors = /<a(?=\s|>)[^>]*>/gi
  const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
  for (const anchor of html.matchAll(anchors)) {
    const match = href.exec(anchor[0])
    if (match === null)
      continue
    const raw = match[1] ?? match[2] ?? match[3]
    if (raw === undefined)
      continue
    const decoded = decodeCharacterReferences(raw).trim()
    if (decoded !== '')
      urls.add(decoded)
  }
  return [...urls]
}

function readField(item: MutableFeedItem, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = collapse(item.fields.get(name) ?? '')
    if (value !== '')
      return value
  }
  return undefined
}

function finishItem(item: MutableFeedItem): ParsedFeedItem | undefined {
  const title = plainText(readField(item, 'title') ?? '')
  if (title === '')
    return undefined

  const guid = readField(item, 'guid', 'id')
  const link = item.atomLink ?? readField(item, 'link') ?? (item.guidCanBeLink ? guid : undefined)
  const rawSummary = readField(item, 'summary', 'description', 'content', 'encoded') ?? ''
  const outboundUrls = new Set(item.outboundUrls)
  for (const field of CONTENT_FIELDS) {
    for (const href of extractHrefs(item.fields.get(field) ?? ''))
      outboundUrls.add(href)
  }
  const summary = plainText(rawSummary)
  return {
    guid,
    link,
    outboundUrls: [...outboundUrls].map(rawUrl => ({ rawUrl })),
    title,
    summary: summary === '' ? undefined : summary,
    rawFeedDate: readField(item, 'published', 'pubdate', 'updated'),
  }
}

function parseFeed(bytes: Uint8Array): ParsedFeedItem[] {
  if (bytes.byteLength > MAX_FEED_BYTES)
    throw new FeedParseError('too_large', `feed exceeds ${MAX_FEED_BYTES} bytes`)

  let xml: string
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch (cause) {
    throw new FeedParseError('invalid_xml', 'feed is not valid UTF-8 XML', { cause })
  }

  if (/<!DOCTYPE\b/i.test(xml))
    throw new FeedParseError('unsafe_xml', 'DTD declarations are forbidden in feeds')

  const parsed: ParsedFeedItem[] = []
  const stack: string[] = []
  let feedKind: 'rss' | 'atom' | undefined
  let current: MutableFeedItem | undefined

  try {
    const parser = new SaxesParser()
    parser.on('doctype', () => {
      throw new FeedParseError('unsafe_xml', 'DTD declarations are forbidden in feeds')
    })
    parser.on('opentag', (tag) => {
      const name = localName(tag.name)
      if (stack.length === 0) {
        if (name === 'rss' || name === 'rdf')
          feedKind = 'rss'
        else if (name === 'feed')
          feedKind = 'atom'
        else
          throw new FeedParseError('invalid_xml', `expected an RSS or Atom root, received <${tag.name}>`)
      }
      stack.push(name)
      const expectedItem = feedKind === 'atom' ? 'entry' : 'item'
      if (name === expectedItem) {
        current = { fields: new Map(), outboundUrls: new Set() }
        return
      }
      if (current === undefined)
        return

      if (name === 'guid' && feedKind === 'rss') {
        const marker = tag.attributes.isPermaLink ?? tag.attributes.ispermalink
        current.guidCanBeLink = typeof marker !== 'string' || marker.toLowerCase() !== 'false'
        return
      }

      if (name === 'a') {
        const href = tag.attributes.href
        const field = [...stack].reverse().find(candidate => ITEM_FIELDS.has(candidate))
        if (field !== undefined && CONTENT_FIELDS.has(field) && typeof href === 'string' && href.trim() !== '')
          current.outboundUrls.add(href.trim())
        return
      }
      if (name !== 'link')
        return

      const href = tag.attributes.href
      const rel = tag.attributes.rel
      const relation = typeof rel === 'string' ? rel.toLowerCase() : rel
      if (typeof href === 'string' && (relation === undefined || relation === 'alternate'))
        current.atomLink ??= href
    })
    const append = (text: string): void => {
      if (current === undefined)
        return
      const field = [...stack].reverse().find(name => ITEM_FIELDS.has(name))
      if (field === undefined)
        return
      current.fields.set(field, `${current.fields.get(field) ?? ''}${text}`)
    }
    parser.on('text', append)
    parser.on('cdata', append)
    parser.on('closetag', (tag) => {
      const name = localName(tag.name)
      const expectedItem = feedKind === 'atom' ? 'entry' : 'item'
      if (name === expectedItem && current !== undefined) {
        const item = finishItem(current)
        if (item !== undefined)
          parsed.push(item)
        current = undefined
      }
      stack.pop()
    })
    parser.write(xml).close()
  }
  catch (cause) {
    if (cause instanceof FeedParseError)
      throw cause
    throw new FeedParseError('invalid_xml', 'feed is not well-formed XML', { cause })
  }

  if (feedKind === undefined)
    throw new FeedParseError('invalid_xml', 'feed has no RSS or Atom root')
  return parsed
}

function itemExternalId(item: ParsedFeedItem, canonicalUrl: string | undefined): string {
  const guid = item.guid?.trim()
  if (guid !== undefined && guid !== '')
    return guid
  if (canonicalUrl !== undefined)
    return canonicalUrl
  return `sha256:${createHash('sha256').update(`${item.title}${item.link ?? ''}`).digest('hex')}`
}

function stableUuid(namespace: 'citation' | 'item' | 'link', identity: string): string {
  const bytes = createHash('sha256').update(`zis:${namespace}:${identity}`).digest().subarray(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0F) | 0x80
  bytes[8] = ((bytes[8] ?? 0) & 0x3F) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function linkIdForUrl(url: string): string {
  return stableUuid('link', url)
}

function itemIdForNaturalKey(sourceId: string, externalId: string): string {
  return stableUuid('item', `${sourceId}\0${externalId}`)
}

function citationIdForNaturalKey(itemId: string, kind: CitationKind, rawUrl: string): string {
  return stableUuid('citation', `${itemId}\0${kind}\0${rawUrl}`)
}

function normalizedPublishedAt(rawFeedDate: string | undefined, fetchedAt: Date): Date {
  if (rawFeedDate === undefined)
    return fetchedAt
  const milliseconds = Date.parse(rawFeedDate)
  if (!Number.isFinite(milliseconds) || milliseconds > fetchedAt.getTime())
    return fetchedAt
  return new Date(milliseconds)
}

export type IngestionTransport
  = 'rss'
    | 'atom'
    | 'hn_firebase'
    | 'hn_algolia'
    | 'github_graphql'
    | 'bluesky_feed'
export type FetchOutcome = 'ok' | 'not_modified' | 'http_error' | 'timeout' | 'robots_denied' | 'parse_error' | 'too_large'

export const ROBOTS_AUTO_DISABLED_REASON = 'automatically disabled after 10 consecutive robots denials'

export interface IngestionSource {
  id: string
  publisherId: string
  transport: IngestionTransport
  endpointUrl: string
  isAggregator: boolean
  disabledAt: Date | null
  disabledReason: string | null
  consecutiveFailures: number
  retryAfterAt: Date | null
  lastPolledAt: Date | null
  newestItemAt: Date | null
  createdAt: Date
}

export interface PersistedItem {
  id: string
  sourceId: string
  externalId: string
  url: string | null
  title: string
  summary: string | null
  rawFeedDate: string | null
  publishedAt: Date
  fetchedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface PublisherHost {
  host: string
  publisherId: string
}

export interface PersistedLink {
  id: string
  url: string
  firstSeenAt: Date
  createdAt: Date
}

export interface PersistedSignal {
  id: string
  targetLinkId: string
  mergedIntoId: string | null
  strength: number
  originPublisherId: string | null
  createdAt: Date
}

export type CitationKind = 'self' | 'outbound'

export interface PersistedCitation {
  id: string
  itemId: string
  sourceId: string
  linkId: string
  kind: CitationKind
  rawUrl: string
  firstSeenAt: Date
  createdAt: Date
}

export interface HttpCacheRecord {
  url: string
  etag: string | null
  lastModified: string | null
  lastStatus: number | null
  fetchedAt: Date
}

export interface SourceFetchLog {
  id: number
  sourceId: string
  startedAt: Date
  durationMs: number
  outcome: FetchOutcome
  httpStatus: number | null
  itemsSeen: number
  itemsNew: number
  bytes: number
  errorMessage: string | null
}

export interface PersistedGraph {
  sources: IngestionSource[]
  items: PersistedItem[]
  publisherHosts: PublisherHost[]
  links: PersistedLink[]
  signals: PersistedSignal[]
  citations: PersistedCitation[]
  fetchLogs: SourceFetchLog[]
  httpCache: HttpCacheRecord[]
  robotsCache: RobotsCacheRecord[]
  dormantSourceIds: string[]
}

export interface CannedTransportResponse {
  url: string
  status: number
  headers?: Record<string, string>
  body?: string | Uint8Array
  /** Select this response only when every named request header is byte-identical. */
  whenHeaders?: Record<string, string>
  /** URLs that must already have been requested before this response is usable. */
  requires?: string[]
  /** Test-only coordination: do not answer until this many requests overlap. */
  waitForActive?: number
  /** Test-only origin latency. */
  delayMs?: number
  /** Test-only assertion for the pipeline's global cap. */
  failAboveActive?: number
  /** Test-only assertion for per-host serialization, including redirects. */
  failAboveHostActive?: number
}

interface RunIngestionCommon {
  sources: IngestionSource[]
  publisherHosts?: PublisherHost[]
  now?: () => Date
  initialGraph?: PersistedGraph
  onSourceCommitted?: (
    source: IngestionSource,
    graph: PersistedGraph,
    touchedHttpCacheKeys: ReadonlySet<string>,
  ) => Promise<void>
}

export type RunIngestionInput = RunIngestionCommon & (
  | { responses: CannedTransportResponse[], fetch?: never }
  | { fetch: SafeFetch, responses?: never }
)

function cloneDate(value: Date | null): Date | null {
  return value === null ? null : new Date(value)
}

function cloneSource(source: IngestionSource): IngestionSource {
  return {
    ...source,
    disabledAt: cloneDate(source.disabledAt),
    retryAfterAt: cloneDate(source.retryAfterAt),
    lastPolledAt: cloneDate(source.lastPolledAt),
    newestItemAt: cloneDate(source.newestItemAt),
    createdAt: new Date(source.createdAt),
  }
}

function emptyGraph(sources: IngestionSource[], publisherHosts: PublisherHost[]): PersistedGraph {
  return {
    sources: sources.map(cloneSource),
    items: [],
    publisherHosts: publisherHosts.map(record => ({ ...record })),
    links: [],
    signals: [],
    citations: [],
    fetchLogs: [],
    httpCache: [],
    robotsCache: [],
    dormantSourceIds: [],
  }
}

function responseBody(body: CannedTransportResponse['body']): Uint8Array {
  return typeof body === 'string' ? new TextEncoder().encode(body) : body ?? new Uint8Array(0)
}

function stream(bytes: Uint8Array): AsyncIterable<Uint8Array> | null {
  if (bytes.byteLength === 0)
    return null
  return (async function* () {
    yield bytes
  })()
}

function createCannedSafeFetch(responses: CannedTransportResponse[]) {
  const unused = responses.map((response, index) => ({ response, index, used: false }))
  const consumed = new Set<string>()
  const waiters = new Set<() => void>()
  const activeByHost = new Map<string, number>()
  let active = 0

  function notifyWaiters(): void {
    for (const notify of waiters)
      notify()
  }

  async function waitForActive(count: number): Promise<void> {
    if (active >= count)
      return
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      const check = (): void => {
        if (active < count)
          return
        clearTimeout(timer)
        waiters.delete(check)
        resolve()
      }
      timer = setTimeout(() => {
        waiters.delete(check)
        reject(new Error(`only ${active} requests overlapped; expected ${count}`))
      }, 250)
      waiters.add(check)
    })
  }

  const transport = async (request: PinnedRequest): Promise<TransportResponse> => {
    const candidates = unused.filter(candidate => !candidate.used && candidate.response.url === request.url)
    const conditional = candidates.find(candidate => candidate.response.whenHeaders !== undefined
      && Object.entries(candidate.response.whenHeaders).every(([name, value]) => request.headers[name.toLowerCase()] === value))
    const canned = conditional ?? candidates.find(candidate => candidate.response.whenHeaders === undefined)
    if (canned === undefined)
      throw new Error(`no canned response for ${request.url}`)
    for (const prerequisite of canned.response.requires ?? []) {
      if (!consumed.has(prerequisite))
        throw new Error(`${request.url} was requested before ${prerequisite}`)
    }
    canned.used = true
    consumed.add(canned.response.url)
    const host = new URL(request.url).host
    active++
    activeByHost.set(host, (activeByHost.get(host) ?? 0) + 1)
    notifyWaiters()
    try {
      if (canned.response.failAboveActive !== undefined && active > canned.response.failAboveActive)
        throw new Error(`${active} concurrent requests exceeded the cap ${canned.response.failAboveActive}`)
      const hostActive = activeByHost.get(host) ?? 0
      if (canned.response.failAboveHostActive !== undefined && hostActive > canned.response.failAboveHostActive)
        throw new Error(`${hostActive} concurrent ${host} requests exceeded the cap ${canned.response.failAboveHostActive}`)
      if (canned.response.waitForActive !== undefined)
        await waitForActive(canned.response.waitForActive)
      if (canned.response.delayMs !== undefined)
        await new Promise(resolve => setTimeout(resolve, canned.response.delayMs))
      const bytes = responseBody(canned.response.body)
      const headers = Object.fromEntries(
        Object.entries(canned.response.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
      )
      return { status: canned.response.status, headers, body: stream(bytes) }
    }
    finally {
      active--
      activeByHost.set(host, (activeByHost.get(host) ?? 1) - 1)
      notifyWaiters()
    }
  }
  return createSafeFetch({
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    transport,
  })
}

interface RequestScheduler {
  acquire: (url: string, signal?: AbortSignal) => Promise<() => void>
}

function createRequestScheduler(limit: number): RequestScheduler {
  interface WaitingRequest {
    host: string
    signal?: AbortSignal
    onAbort?: () => void
    reject: (error: unknown) => void
    resolve: (release: () => void) => void
  }

  const waiting: WaitingRequest[] = []
  const activeHosts = new Set<string>()
  let active = 0

  function pump(): void {
    while (active < limit) {
      const index = waiting.findIndex(candidate => !activeHosts.has(candidate.host))
      if (index === -1)
        return
      const [request] = waiting.splice(index, 1)
      if (request === undefined)
        return
      if (request.onAbort !== undefined)
        request.signal?.removeEventListener('abort', request.onAbort)
      active++
      activeHosts.add(request.host)
      let released = false
      request.resolve(() => {
        if (released)
          return
        released = true
        active--
        activeHosts.delete(request.host)
        pump()
      })
    }
  }

  return {
    acquire: async (url, signal) => {
      const host = new URL(url).host
      return new Promise<() => void>((resolve, reject) => {
        const request: WaitingRequest = { host, reject, resolve, signal }
        request.onAbort = () => {
          const index = waiting.indexOf(request)
          if (index !== -1)
            waiting.splice(index, 1)
          reject(signal?.reason instanceof Error ? signal.reason : new Error(`request scheduling for ${host} was aborted`))
          pump()
        }
        if (signal?.aborted === true) {
          request.onAbort()
          return
        }
        signal?.addEventListener('abort', request.onAbort, { once: true })
        waiting.push(request)
        pump()
      })
    },
  }
}

class RobotsDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RobotsDeniedError'
  }
}

function createPolicyFetch(graph: PersistedGraph, fetch: SafeFetch, now: () => Date): SafeFetch {
  const requests = createRequestScheduler(6)
  const policyChecks = createRequestScheduler(Number.MAX_SAFE_INTEGER)
  const gate = createRobotsGate({
    fetchRobots: async (url) => {
      const requestedHost = new URL(url).host
      return fetch(url, {
        beforeRequest: async (hopUrl, signal) => {
          const hopHost = new URL(hopUrl).host
          if (hopHost !== requestedHost)
            throw new Error(`robots redirect left ${requestedHost} for ${hopHost}`)
          return requests.acquire(hopUrl, signal)
        },
      })
    },
    store: createGraphRobotsStore(graph),
    now,
  })

  return async (url, options = {}) => fetch(url, {
    ...options,
    beforeRequest: async (hopUrl, signal) => {
      const releasePolicy = await policyChecks.acquire(hopUrl, signal)
      let decision
      try {
        decision = await gate.decide(hopUrl)
      }
      finally {
        releasePolicy()
      }
      if (!decision.allowed)
        throw new RobotsDeniedError(decision.reason)
      return requests.acquire(hopUrl, signal)
    },
  })
}

function createGraphRobotsStore(graph: PersistedGraph): RobotsStore {
  return {
    get: async host => graph.robotsCache.find(record => record.host === host),
    put: async (record) => {
      const index = graph.robotsCache.findIndex(candidate => candidate.host === record.host)
      if (index === -1)
        graph.robotsCache.push(record)
      else
        graph.robotsCache[index] = record
    },
  }
}

function cacheHeaders(cache: HttpCacheRecord | undefined): Record<string, string> {
  const headers: Record<string, string> = {}
  if (cache?.etag !== null && cache?.etag !== undefined)
    headers['if-none-match'] = cache.etag
  if (cache?.lastModified !== null && cache?.lastModified !== undefined)
    headers['if-modified-since'] = cache.lastModified
  return headers
}

function httpCacheKey(url: string): string {
  try {
    const canonical = new URL(url)
    canonical.hash = ''
    return canonical.href
  }
  catch {
    return url
  }
}

function httpCacheRecord(
  existing: HttpCacheRecord | undefined,
  url: string,
  response: SafeFetchResponse,
  fetchedAt: Date,
  preserveMissingValidators = false,
): HttpCacheRecord {
  return {
    url,
    etag: response.headers.etag ?? (preserveMissingValidators ? existing?.etag : null) ?? null,
    lastModified: response.headers['last-modified'] ?? (preserveMissingValidators ? existing?.lastModified : null) ?? null,
    lastStatus: response.status,
    fetchedAt,
  }
}

function upsertHttpCache(records: HttpCacheRecord[], record: HttpCacheRecord): void {
  const existing = records.find(candidate => candidate.url === record.url)
  if (existing === undefined)
    records.push(record)
  else
    Object.assign(existing, record)
}

function putHttpCache(
  graph: PersistedGraph,
  url: string,
  response: SafeFetchResponse,
  fetchedAt: Date,
  preserveMissingValidators = false,
): void {
  const existing = graph.httpCache.find(record => record.url === url)
  upsertHttpCache(
    graph.httpCache,
    httpCacheRecord(existing, url, response, fetchedAt, preserveMissingValidators),
  )
}

function isSuccessfulCache(record: HttpCacheRecord): boolean {
  return record.lastStatus === 304
    || (record.lastStatus !== null && record.lastStatus >= 200 && record.lastStatus < 300)
}

/** Stage 4: recover the link list omitted by excerpt-only Aggregator feeds. */
async function hydrateIssuePages(
  graph: PersistedGraph,
  source: IngestionSource,
  feedItems: ParsedFeedItem[],
  fetch: SafeFetch,
  now: () => Date,
): Promise<Set<string>> {
  const touchedCacheKeys = new Set<string>()
  if (!source.isAggregator)
    return touchedCacheKeys

  const cacheUpdates: HttpCacheRecord[] = []

  for (const item of feedItems) {
    if (item.link === undefined)
      continue
    const cacheKey = httpCacheKey(item.link)
    const cache = cacheUpdates.find(record => record.url === cacheKey)
      ?? graph.httpCache.find(record => record.url === cacheKey)
    if (cache !== undefined
      && isSuccessfulCache(cache)
      && cache.etag === null
      && cache.lastModified === null) {
      continue
    }

    const response = await fetch(item.link, {
      headers: { accept: 'text/html', ...cacheHeaders(cache) },
    })
    const fetchedAt = now()
    if (response.status === 304) {
      if (cache === undefined || !isSuccessfulCache(cache))
        throw new Error('received 304 for an issue page without previously persisted Citations')
      upsertHttpCache(
        cacheUpdates,
        httpCacheRecord(cache, cacheKey, response, fetchedAt, true),
      )
      touchedCacheKeys.add(cacheKey)
      continue
    }
    if (response.status < 200 || response.status >= 300)
      throw new Error(`issue page returned HTTP ${response.status}`)
    for (const rawUrl of extractHrefs(response.text()))
      item.outboundUrls.push({ rawUrl, baseUrl: response.url })
    upsertHttpCache(cacheUpdates, httpCacheRecord(cache, cacheKey, response, fetchedAt))
    touchedCacheKeys.add(cacheKey)
  }

  for (const update of cacheUpdates)
    upsertHttpCache(graph.httpCache, update)
  return touchedCacheKeys
}

function addLog(
  graph: PersistedGraph,
  sourceId: string,
  startedAt: Date,
  completedAt: Date,
  outcome: FetchOutcome,
  result: {
    httpStatus?: number | null
    itemsSeen?: number
    itemsNew?: number
    bytes?: number
    errorMessage?: string | null
  } = {},
): void {
  graph.fetchLogs.push({
    id: graph.fetchLogs.length + 1,
    sourceId,
    startedAt,
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    outcome,
    httpStatus: result.httpStatus ?? null,
    itemsSeen: result.itemsSeen ?? 0,
    itemsNew: result.itemsNew ?? 0,
    bytes: result.bytes ?? 0,
    errorMessage: result.errorMessage ?? null,
  })
}

function failureOutcome(error: unknown): FetchOutcome {
  if (error instanceof RobotsDeniedError)
    return 'robots_denied'
  if (error instanceof FeedParseError)
    return error.code === 'too_large' ? 'too_large' : 'parse_error'
  if (error instanceof SafeFetchError)
    return error.code === 'timeout' ? 'timeout' : error.code === 'too_large' ? 'too_large' : 'http_error'
  return 'http_error'
}

function responseDeferral(headers: Record<string, string>, at: Date): Date | null {
  const candidates: Date[] = []
  const retryAfter = headers['retry-after']
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter)
    const milliseconds = Number.isFinite(seconds)
      ? at.getTime() + Math.max(0, seconds) * 1000
      : Date.parse(retryAfter)
    if (Number.isFinite(milliseconds))
      candidates.push(new Date(milliseconds))
  }
  const pollSeconds = Number(headers['x-poll-interval'])
  if (Number.isFinite(pollSeconds) && pollSeconds >= 0)
    candidates.push(new Date(at.getTime() + pollSeconds * 1000))
  return candidates.reduce<Date | null>((latest, candidate) =>
    latest === null || candidate > latest ? candidate : latest, null)
}

function recordFailure(
  graph: PersistedGraph,
  source: IngestionSource,
  startedAt: Date,
  at: Date,
  outcome: FetchOutcome,
  error: unknown,
  response?: SafeFetchResponse,
  originDeferral?: Date | null,
): void {
  source.lastPolledAt = at
  source.consecutiveFailures++
  const backoffMinutes = Math.min(24 * 60, 5 * 2 ** (source.consecutiveFailures - 1))
  const backoffAt = new Date(at.getTime() + backoffMinutes * 60_000)
  source.retryAfterAt = originDeferral !== null && originDeferral !== undefined && originDeferral > backoffAt
    ? originDeferral
    : backoffAt
  if (source.consecutiveFailures >= 10) {
    source.disabledAt ??= at
    source.disabledReason ??= outcome === 'robots_denied'
      ? ROBOTS_AUTO_DISABLED_REASON
      : 'automatically disabled after 10 consecutive failures'
  }
  addLog(graph, source.id, startedAt, at, outcome, {
    httpStatus: response?.status,
    bytes: response?.byteLength,
    errorMessage: error instanceof Error ? error.message : String(error),
  })
}

const REFERENCE_ONLY_URLS = [
  /^https:\/\/developer\.mozilla\.org\//i,
  /^https:\/\/(?:www\.)?(?:w3\.org|whatwg\.org|rfc-editor\.org|ietf\.org|unicode\.org|khronos\.org)\//i,
  /^https:\/\/(?:www\.)?caniuse\.com\//i,
  /^https:\/\/(?:[a-z]{2}\.)?wikipedia\.org\//i,
  /^https:\/\/(?:www\.)?npmjs\.com\/package\//i,
  /^https:\/\/(?:www\.)?stackoverflow\.com\/questions\//i,
  /^https:\/\/(?:bugs|bugzilla|bugreport)\./i,
  /^https:\/\/(?:crbug\.com|issues\.chromium\.org|bugs\.webkit\.org|bugzilla\.mozilla\.org)\//i,
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:pull|issues|commit|commits|compare|blob|discussions|labels|milestone|projects|wiki)\b/i,
  /^https:\/\/[^/]+\/(?:docs|api|reference|guide|guides|manual|spec|schema)\//i,
  /^https:\/\/(?:www\.)?(?:youtube|youtu)\.[a-z.]+\/playlist/i,
  /^https:\/\/(?:www\.)?doi\.org\//i,
]

function isReferenceOnly(url: string): boolean {
  return REFERENCE_ONLY_URLS.some(pattern => pattern.test(url))
}

function ownerOfHost(graph: PersistedGraph, host: string): string | undefined {
  const canonicalHost = publisherHostKey(host)
  return graph.publisherHosts.find(record => publisherHostKey(record.host) === canonicalHost)?.publisherId
}

function ensureSignal(graph: PersistedGraph, link: PersistedLink): PersistedSignal {
  let signal = graph.signals.find(candidate => candidate.targetLinkId === link.id)
  if (signal === undefined) {
    signal = {
      id: link.id,
      targetLinkId: link.id,
      mergedIntoId: null,
      strength: 0,
      originPublisherId: null,
      createdAt: link.createdAt,
    }
    graph.signals.push(signal)
  }
  return signal
}

function resolveSignal(graph: PersistedGraph, signal: PersistedSignal): PersistedSignal {
  const visited = new Set<string>()
  let current = signal
  while (current.mergedIntoId !== null) {
    if (visited.has(current.id))
      throw new Error(`Signal merge cycle includes ${current.id}`)
    visited.add(current.id)
    const next = graph.signals.find(candidate => candidate.id === current.mergedIntoId)
    if (next === undefined)
      throw new Error(`Signal ${current.id} merges into missing Signal ${current.mergedIntoId}`)
    current = next
  }
  return current
}

const RELEASE_TAG_URL = /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\/.+$/

function mergeReleaseTagAliases(graph: PersistedGraph): void {
  const linkById = new Map(graph.links.map(link => [link.id, link]))
  const signalByLinkId = new Map(graph.signals.map(signal => [signal.targetLinkId, signal]))
  const targetLinkIdsByAliasLinkId = new Map<string, Set<string>>()

  for (const item of graph.items) {
    if (item.url === null)
      continue
    const source = graph.sources.find(candidate => candidate.id === item.sourceId)
    if (source === undefined)
      throw new Error(`Item ${item.id} belongs to missing Source ${item.sourceId}`)
    if (source.transport !== 'rss' && source.transport !== 'atom')
      continue
    const targetLink = graph.links.find(link => link.url === item.url)
    if (targetLink === undefined)
      continue
    const aliasLinkIds = [...new Set(graph.citations
      .filter(citation => citation.itemId === item.id && citation.kind === 'outbound')
      .map(citation => citation.linkId)
      .filter((linkId) => {
        const link = linkById.get(linkId)
        return link !== undefined && RELEASE_TAG_URL.test(link.url)
      }))]
    if (aliasLinkIds.length !== 1 || aliasLinkIds[0] === targetLink.id)
      continue
    const targets = targetLinkIdsByAliasLinkId.get(aliasLinkIds[0]!) ?? new Set<string>()
    targets.add(targetLink.id)
    targetLinkIdsByAliasLinkId.set(aliasLinkIds[0]!, targets)
  }

  const aliases = [...targetLinkIdsByAliasLinkId.entries()].sort(([leftId], [rightId]) => {
    const leftUrl = linkById.get(leftId)?.url ?? leftId
    const rightUrl = linkById.get(rightId)?.url ?? rightId
    return leftUrl.localeCompare(rightUrl) || leftId.localeCompare(rightId)
  })
  for (const [aliasLinkId, targetLinkIds] of aliases) {
    const orderedTargetLinkIds = [...targetLinkIds].sort((leftId, rightId) => {
      const leftUrl = linkById.get(leftId)?.url ?? leftId
      const rightUrl = linkById.get(rightId)?.url ?? rightId
      return leftUrl.localeCompare(rightUrl) || leftId.localeCompare(rightId)
    })
    const preferredSignal = signalByLinkId.get(orderedTargetLinkIds[0]!)
    const aliasSignal = signalByLinkId.get(aliasLinkId)
    if (preferredSignal === undefined || aliasSignal === undefined)
      throw new Error('Alias merge requires every Link to have a Signal')
    const destination = resolveSignal(graph, preferredSignal)
    const candidates = [aliasSignal, ...orderedTargetLinkIds
      .map(linkId => signalByLinkId.get(linkId))
      .filter((signal): signal is PersistedSignal => signal !== undefined)]
    for (const candidate of candidates) {
      const root = resolveSignal(graph, candidate)
      if (root.id !== destination.id)
        root.mergedIntoId = destination.id
    }
  }
}

function updateStrength(graph: PersistedGraph): void {
  const signalByLinkId = new Map(graph.signals.map(signal => [signal.targetLinkId, signal]))
  const publishersBySignalId = new Map<string, Set<string>>()

  for (const signal of graph.signals) {
    signal.strength = 0
    signal.originPublisherId = null
    if (signal.mergedIntoId !== null)
      continue
    const target = graph.links.find(link => link.id === signal.targetLinkId)
    if (target === undefined)
      throw new Error(`Signal ${signal.id} targets missing Link ${signal.targetLinkId}`)
    signal.originPublisherId = ownerOfHost(graph, new URL(target.url).hostname) ?? null
    publishersBySignalId.set(signal.id, new Set())
  }

  for (const citation of graph.citations) {
    const signal = signalByLinkId.get(citation.linkId)
    if (signal === undefined)
      throw new Error(`Citation ${citation.id} points to a Link without a Signal`)
    const root = resolveSignal(graph, signal)
    const source = graph.sources.find(candidate => candidate.id === citation.sourceId)
    if (source === undefined)
      throw new Error(`Citation ${citation.id} belongs to missing Source ${citation.sourceId}`)
    if (source.publisherId !== root.originPublisherId)
      publishersBySignalId.get(root.id)?.add(source.publisherId)
  }

  for (const signal of graph.signals) {
    if (signal.mergedIntoId === null)
      signal.strength = publishersBySignalId.get(signal.id)?.size ?? 0
  }
}

function recordCitation(
  graph: PersistedGraph,
  item: PersistedItem,
  source: IngestionSource,
  rawUrl: string | undefined,
  kind: CitationKind,
  firstSeenAt: Date,
  baseUrl?: string,
): void {
  if (rawUrl === undefined || rawUrl.trim() === '')
    return
  const preservedRawUrl = rawUrl.trim()
  const canonicalUrl = canonicalizeLink(preservedRawUrl, baseUrl)
  if (canonicalUrl === undefined)
    return
  if (kind === 'outbound') {
    if (isReferenceOnly(canonicalUrl))
      return
    if (ownerOfHost(graph, new URL(canonicalUrl).hostname) === source.publisherId)
      return
  }

  let link = graph.links.find(candidate => candidate.url === canonicalUrl)
  if (link === undefined) {
    link = {
      id: linkIdForUrl(canonicalUrl),
      url: canonicalUrl,
      firstSeenAt,
      createdAt: firstSeenAt,
    }
    graph.links.push(link)
  }
  else if (firstSeenAt < link.firstSeenAt) {
    link.firstSeenAt = firstSeenAt
  }
  ensureSignal(graph, link)

  const existing = graph.citations.find(candidate =>
    candidate.itemId === item.id
    && candidate.kind === kind
    && candidate.rawUrl === preservedRawUrl,
  )
  if (existing !== undefined) {
    existing.linkId = link.id
    if (firstSeenAt < existing.firstSeenAt)
      existing.firstSeenAt = firstSeenAt
    return
  }

  graph.citations.push({
    id: citationIdForNaturalKey(item.id, kind, preservedRawUrl),
    itemId: item.id,
    sourceId: source.id,
    linkId: link.id,
    kind,
    rawUrl: preservedRawUrl,
    firstSeenAt,
    createdAt: firstSeenAt,
  })
}

function findPersistedItem(
  graph: PersistedGraph,
  source: IngestionSource,
  parsed: ParsedFeedItem,
  externalId: string,
  canonicalUrl: string | undefined,
): PersistedItem | undefined {
  const exact = graph.items.find(candidate =>
    candidate.sourceId === source.id && candidate.externalId === externalId,
  )
  if (exact !== undefined || parsed.guid?.trim())
    return exact
  if (canonicalUrl === undefined)
    return undefined

  const legacy = graph.items
    .filter(candidate => candidate.sourceId === source.id
      && candidate.url !== null
      && canonicalizeLink(candidate.externalId) === canonicalUrl
      && canonicalizeLink(candidate.url) === canonicalUrl)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()
      || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  return legacy[0]
}

async function ingestSource(
  graph: PersistedGraph,
  source: IngestionSource,
  fetch: ReturnType<typeof createCannedSafeFetch>,
  now: () => Date,
): Promise<ReadonlySet<string>> {
  const touchedHttpCacheKeys = new Set<string>()
  if (source.transport !== 'rss' && source.transport !== 'atom')
    throw new Error(`Source ${source.id} uses unsupported transport ${source.transport}`)
  const startedAt = now()
  let response: SafeFetchResponse | undefined
  let fetchedAt = startedAt
  try {
    const cacheKey = httpCacheKey(source.endpointUrl)
    const cache = graph.httpCache.find(record => record.url === cacheKey)
    response = await fetch(source.endpointUrl, { headers: cacheHeaders(cache) })
    fetchedAt = now()
    if (source.disabledReason === ROBOTS_AUTO_DISABLED_REASON) {
      source.disabledAt = null
      source.disabledReason = null
      source.consecutiveFailures = 0
    }

    source.lastPolledAt = fetchedAt
    const originDeferral = responseDeferral(response.headers, fetchedAt)
    if (response.status === 304) {
      if (cache === undefined) {
        recordFailure(
          graph,
          source,
          startedAt,
          fetchedAt,
          'http_error',
          new Error('received 304 without a previously validated feed'),
          response,
          originDeferral,
        )
        return touchedHttpCacheKeys
      }
      putHttpCache(graph, cacheKey, response, fetchedAt, true)
      touchedHttpCacheKeys.add(cacheKey)
      source.consecutiveFailures = 0
      source.retryAfterAt = originDeferral
      addLog(graph, source.id, startedAt, now(), 'not_modified', {
        httpStatus: response.status,
        bytes: response.byteLength,
      })
      return touchedHttpCacheKeys
    }
    if (response.status < 200 || response.status >= 300) {
      recordFailure(
        graph,
        source,
        startedAt,
        fetchedAt,
        'http_error',
        new Error(`HTTP ${response.status}`),
        response,
        originDeferral,
      )
      return touchedHttpCacheKeys
    }

    const parsed = parseFeed(response.bytes)
    const hydratedCacheKeys = await hydrateIssuePages(graph, source, parsed, fetch, now)
    for (const hydratedCacheKey of hydratedCacheKeys)
      touchedHttpCacheKeys.add(hydratedCacheKey)
    putHttpCache(graph, cacheKey, response, fetchedAt)
    touchedHttpCacheKeys.add(cacheKey)
    source.consecutiveFailures = 0
    source.retryAfterAt = originDeferral
    let itemsNew = 0
    let newest: Date | null = null
    for (const item of parsed) {
      const url = canonicalizeLink(item.link)
      const externalId = itemExternalId(item, url)
      const publishedAt = normalizedPublishedAt(item.rawFeedDate, fetchedAt)
      const existing = findPersistedItem(graph, source, item, externalId, url)
      let persistedItem: PersistedItem
      if (existing === undefined) {
        persistedItem = {
          id: itemIdForNaturalKey(source.id, externalId),
          sourceId: source.id,
          externalId,
          url: url ?? null,
          title: item.title,
          summary: item.summary ?? null,
          rawFeedDate: item.rawFeedDate ?? null,
          publishedAt,
          fetchedAt,
          createdAt: fetchedAt,
          updatedAt: fetchedAt,
        }
        graph.items.push(persistedItem)
        itemsNew++
      }
      else {
        Object.assign(existing, {
          url: url ?? null,
          title: item.title,
          summary: item.summary ?? null,
          rawFeedDate: item.rawFeedDate ?? null,
          publishedAt,
          fetchedAt,
          updatedAt: fetchedAt,
        })
        persistedItem = existing
      }
      recordCitation(graph, persistedItem, source, item.link, 'self', fetchedAt)
      for (const outboundUrl of item.outboundUrls) {
        recordCitation(
          graph,
          persistedItem,
          source,
          outboundUrl.rawUrl,
          'outbound',
          fetchedAt,
          outboundUrl.baseUrl ?? item.link,
        )
      }
      if (newest === null || publishedAt > newest)
        newest = publishedAt
    }
    if (newest !== null && (source.newestItemAt === null || newest > source.newestItemAt))
      source.newestItemAt = newest
    addLog(graph, source.id, startedAt, now(), 'ok', {
      httpStatus: response.status,
      itemsSeen: parsed.length,
      itemsNew,
      bytes: response.byteLength,
    })
  }
  catch (error) {
    touchedHttpCacheKeys.clear()
    const outcome = failureOutcome(error)
    const failedAt = now()
    const originDeferral = response === undefined ? undefined : responseDeferral(response.headers, failedAt)
    recordFailure(graph, source, startedAt, failedAt, outcome, error, response, originDeferral)
  }
  return touchedHttpCacheKeys
}

/**
 * Issue #69's one behavioral seam: Sources plus canned egress responses in,
 * the persisted graph out. No fetch/parse/normalize stage is exported as a
 * separate seam.
 */
export async function runIngestion({
  sources,
  publisherHosts = [],
  responses,
  fetch: liveFetch,
  now = () => new Date(),
  initialGraph,
  onSourceCommitted,
}: RunIngestionInput): Promise<PersistedGraph> {
  const graph = initialGraph ?? emptyGraph(sources, publisherHosts)
  for (const link of graph.links)
    ensureSignal(graph, link)
  const rawFetch = liveFetch ?? createCannedSafeFetch(responses ?? [])
  const fetch = createPolicyFetch(graph, rawFetch, now)
  const byHost = new Map<string, IngestionSource[]>()
  for (const requested of sources) {
    const source = graph.sources.find(candidate => candidate.id === requested.id) ?? cloneSource(requested)
    if (!graph.sources.includes(source))
      graph.sources.push(source)
    let host: string
    try {
      host = new URL(source.endpointUrl).host
    }
    catch {
      host = `invalid:${source.id}`
    }
    const queue = byHost.get(host) ?? []
    queue.push(source)
    byHost.set(host, queue)
  }
  const queues = [...byHost.values()]
  let nextQueue = 0
  async function worker(): Promise<void> {
    while (true) {
      const queue = queues[nextQueue++]
      if (queue === undefined)
        return
      for (const source of queue) {
        const touchedHttpCacheKeys = await ingestSource(graph, source, fetch, now)
        await onSourceCommitted?.(source, graph, touchedHttpCacheKeys)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queues.length) }, () => worker()))
  mergeReleaseTagAliases(graph)
  updateStrength(graph)
  graph.items.sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
  const dormantBefore = new Date(now())
  dormantBefore.setUTCMonth(dormantBefore.getUTCMonth() - 6)
  graph.dormantSourceIds = graph.sources
    .filter(source => source.disabledAt === null
      && source.newestItemAt !== null
      && source.newestItemAt < dormantBefore)
    .map(source => source.id)
  return graph
}
