import type { EmbeddingProvider } from '@/lib/embeddings/provider'
import type { RobotsCacheRecord, RobotsStore } from '@/lib/robots'
import type { PinnedRequest, SafeFetch, SafeFetchResponse, TransportResponse } from '@/lib/safe-fetch'
import { createHash } from 'node:crypto'
import { SaxesParser } from 'saxes'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from '@/lib/embeddings/provider'
import { createRobotsGate } from '@/lib/robots'
import { createSafeFetch, mediaType, SafeFetchError } from '@/lib/safe-fetch'
import { canonicalizeLink, publisherHostKey } from './canonicalize'

const MAX_FEED_BYTES = 2 * 1024 * 1024
const MAX_EMBEDDING_TEXT_CHARS = 1200

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
  issueHydratedAt?: Date
  outboundUrls: ParsedOutboundUrl[]
  persistedItemId?: string
  title: string
  summary?: string
  rawFeedDate?: string
}

interface ParsedOutboundUrl {
  rawUrl: string
  anchorText?: string
  baseUrl?: string
}

interface MutableFeedItem {
  fields: Map<string, string>
  atomLink?: string
  guidCanBeLink?: boolean
  outboundUrls: Map<string, string | undefined>
  openAnchor?: {
    rawUrl: string
    text: string
  }
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

function capEmbeddingText(text: string): string {
  if (text.length <= MAX_EMBEDDING_TEXT_CHARS)
    return text
  return Array.from(text).slice(0, MAX_EMBEDDING_TEXT_CHARS).join('')
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

function cleanedAnchorText(text: string | undefined): string | undefined {
  if (text === undefined)
    return undefined
  const cleaned = plainText(text)
  return cleaned === '' ? undefined : cleaned
}

function retainLongestAnchor(
  urls: Map<string, string | undefined>,
  rawUrl: string,
  anchorText: string | undefined,
): void {
  const url = decodeCharacterReferences(rawUrl).trim()
  if (url === '')
    return
  const cleaned = cleanedAnchorText(anchorText)
  const existing = urls.get(url)
  if (!urls.has(url) || (cleaned?.length ?? 0) > (existing?.length ?? 0))
    urls.set(url, cleaned)
}

function extractOutboundUrls(html: string): ParsedOutboundUrl[] {
  const urls = new Map<string, string | undefined>()
  const pairedAnchors = /<a(?=\s|>)[^>]*>([\s\S]*?)<\/a\s*>/gi
  for (const anchor of html.matchAll(pairedAnchors)) {
    const tag = anchor[0].slice(0, anchor[0].indexOf('>') + 1)
    const hrefMatch = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag)
    const rawUrl = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3]
    if (rawUrl !== undefined)
      retainLongestAnchor(urls, rawUrl, anchor[1])
  }

  const anchors = /<a(?=\s|>)[^>]*>/gi
  const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
  for (const anchor of html.matchAll(anchors)) {
    const match = href.exec(anchor[0])
    if (match === null)
      continue
    const raw = match[1] ?? match[2] ?? match[3]
    if (raw === undefined)
      continue
    retainLongestAnchor(urls, raw, undefined)
  }
  return [...urls].map(([rawUrl, anchorText]) => ({ rawUrl, anchorText }))
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
  const outboundUrls = new Map(item.outboundUrls)
  for (const field of CONTENT_FIELDS) {
    for (const outboundUrl of extractOutboundUrls(item.fields.get(field) ?? ''))
      retainLongestAnchor(outboundUrls, outboundUrl.rawUrl, outboundUrl.anchorText)
  }
  const summary = capEmbeddingText(plainText(rawSummary))
  return {
    guid,
    link,
    outboundUrls: [...outboundUrls].map(([rawUrl, anchorText]) => ({ rawUrl, anchorText })),
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
        current = { fields: new Map(), outboundUrls: new Map() }
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
        if (field !== undefined && CONTENT_FIELDS.has(field) && typeof href === 'string' && href.trim() !== '') {
          current.openAnchor = { rawUrl: href, text: '' }
        }
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
      if (current.openAnchor !== undefined)
        current.openAnchor.text += text
    }
    parser.on('text', append)
    parser.on('cdata', append)
    parser.on('closetag', (tag) => {
      const name = localName(tag.name)
      if (name === 'a' && current?.openAnchor !== undefined) {
        retainLongestAnchor(
          current.outboundUrls,
          current.openAnchor.rawUrl,
          current.openAnchor.text,
        )
        current.openAnchor = undefined
      }
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
  issueHydratedAt: Date | null
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
  textBasis: SignalTextBasis | null
  embeddingText: string | null
  embedding: number[] | null
  embeddingModel: string | null
  embeddingDimensions: number | null
  embeddingVersion: string | null
  embeddedAt: Date | null
  createdAt: Date
}

export type SignalTextBasis = 'own' | 'citing' | 'slug'

export type CitationKind = 'self' | 'outbound'

export interface PersistedCitation {
  id: string
  itemId: string
  sourceId: string
  linkId: string
  kind: CitationKind
  rawUrl: string
  anchorText: string | null
  firstSeenAt: Date
  createdAt: Date
}

export interface PersistedUser {
  id: string
  createdAt: Date
}

export interface PersistedInterest {
  id: string
  userId: string
  statement: string
  embedding: number[] | null
  embeddingInputHash: string | null
  embeddingModel: string | null
  embeddingDimensions: number | null
  embeddingVersion: string | null
  embeddedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PersistedReaderSignalMatch {
  userId: string
  signalId: string
  matchedInterestId: string | null
  relevance: number | null
  gap: number | null
  matchedAt: Date
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
  users: PersistedUser[]
  interests: PersistedInterest[]
  readerSignalMatches: PersistedReaderSignalMatch[]
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
  embeddingProvider?: EmbeddingProvider
  onSourceCommitted?: (
    source: IngestionSource,
    graph: PersistedGraph,
    touchedHttpCacheKeys: ReadonlySet<string>,
    touchedItemIds: ReadonlySet<string>,
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
    users: [],
    interests: [],
    readerSignalMatches: [],
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

function isHydratedIssueCache(record: HttpCacheRecord): boolean {
  return record.lastStatus === 200 || record.lastStatus === 304
}

function persistedItemForHydration(
  graph: PersistedGraph,
  source: IngestionSource,
  item: ParsedFeedItem,
): PersistedItem | undefined {
  if (item.persistedItemId !== undefined) {
    const persisted = graph.items.find(candidate =>
      candidate.id === item.persistedItemId && candidate.sourceId === source.id,
    )
    if (persisted !== undefined)
      return persisted
  }
  const guid = item.guid?.trim()
  if (guid !== undefined && guid !== '') {
    const exact = graph.items.find(candidate =>
      candidate.sourceId === source.id && candidate.externalId === guid,
    )
    if (exact !== undefined)
      return exact
  }
  if (item.link === undefined)
    return undefined
  const cacheKey = httpCacheKey(item.link)
  const selfCitation = graph.citations.find(candidate =>
    candidate.sourceId === source.id
    && candidate.kind === 'self'
    && httpCacheKey(candidate.rawUrl) === cacheKey,
  )
  return selfCitation === undefined
    ? undefined
    : graph.items.find(candidate => candidate.id === selfCitation.itemId)
}

const ISSUE_HTML_MEDIA_TYPES = new Set(['text/html', 'application/xhtml+xml'])
const ISSUE_CHALLENGE_MARKERS = [
  /<title[^>]*>[^<]*(?:access denied|attention required|captcha|just a moment)/i,
  /\b(?:cf-chl-|challenge-platform|g-recaptcha|h-captcha)\b/i,
  /\b(?:confirm|verify)(?: that)? you are (?:a )?human\b/i,
]

function trustedIssueLinks(response: SafeFetchResponse): ParsedOutboundUrl[] | undefined {
  if (response.status !== 200 || response.byteLength === 0)
    return undefined
  const responseMediaType = response.contentType ?? mediaType(response.headers['content-type'])
  if (responseMediaType === undefined || !ISSUE_HTML_MEDIA_TYPES.has(responseMediaType))
    return undefined
  const wafAction = response.headers['x-amzn-waf-action']
  if (wafAction !== undefined && wafAction.trim() !== '') {
    return undefined
  }
  if (response.headers['cf-mitigated']?.trim().toLowerCase() === 'challenge')
    return undefined
  const html = response.text()
  if (ISSUE_CHALLENGE_MARKERS.some(marker => marker.test(html)))
    return undefined
  return extractOutboundUrls(html)
}

interface IssueHydrationResult {
  retryAfterAt: Date | null
  touchedCacheKeys: Set<string>
}

function laterDate(left: Date | null, right: Date | null): Date | null {
  if (left === null)
    return right
  if (right === null)
    return left
  return left > right ? left : right
}

/** Stage 4: recover the link list omitted by excerpt-only Aggregator feeds. */
async function hydrateIssuePages(
  graph: PersistedGraph,
  source: IngestionSource,
  feedItems: ParsedFeedItem[],
  fetch: SafeFetch,
  now: () => Date,
): Promise<IssueHydrationResult> {
  const touchedCacheKeys = new Set<string>()
  if (!source.isAggregator)
    return { retryAfterAt: null, touchedCacheKeys }

  const cacheUpdates: HttpCacheRecord[] = []
  let retryAfterAt: Date | null = null

  for (const item of feedItems) {
    if (item.link === undefined)
      continue
    const cacheKey = httpCacheKey(item.link)
    const cache = cacheUpdates.find(record => record.url === cacheKey)
      ?? graph.httpCache.find(record => record.url === cacheKey)
    const persistedItem = persistedItemForHydration(graph, source, item)
    const wasHydrated = persistedItem?.issueHydratedAt != null
    const hasValidatedCache = cache !== undefined && isHydratedIssueCache(cache)
    if (wasHydrated && (!hasValidatedCache
      || (cache.etag === null && cache.lastModified === null))) {
      continue
    }

    let response: SafeFetchResponse
    try {
      response = await fetch(item.link, {
        headers: {
          accept: 'text/html, application/xhtml+xml',
          ...(wasHydrated && hasValidatedCache ? cacheHeaders(cache) : {}),
        },
      })
    }
    catch (error) {
      if (error instanceof RobotsDeniedError || error instanceof SafeFetchError)
        continue
      throw error
    }
    const fetchedAt = now()
    retryAfterAt = laterDate(retryAfterAt, responseDeferral(response.headers, fetchedAt))
    if (response.status === 304) {
      if (!wasHydrated || !hasValidatedCache)
        continue
      upsertHttpCache(
        cacheUpdates,
        httpCacheRecord(cache, cacheKey, response, fetchedAt, true),
      )
      touchedCacheKeys.add(cacheKey)
      continue
    }
    const links = trustedIssueLinks(response)
    if (links === undefined)
      continue
    upsertHttpCache(cacheUpdates, httpCacheRecord(cache, cacheKey, response, fetchedAt))
    touchedCacheKeys.add(cacheKey)
    if (wasHydrated)
      continue
    item.issueHydratedAt = fetchedAt
    for (const link of links)
      item.outboundUrls.push({ ...link, baseUrl: response.url })
  }

  for (const update of cacheUpdates)
    upsertHttpCache(graph.httpCache, update)
  return { retryAfterAt, touchedCacheKeys }
}

function pendingIssueHydrationItems(
  graph: PersistedGraph,
  source: IngestionSource,
): ParsedFeedItem[] {
  if (!source.isAggregator)
    return []
  return graph.items.flatMap((item): ParsedFeedItem[] => {
    if (item.sourceId !== source.id || item.issueHydratedAt !== null)
      return []
    const selfCitation = graph.citations.find(candidate =>
      candidate.itemId === item.id && candidate.kind === 'self',
    )
    const link = selfCitation?.rawUrl ?? item.url ?? undefined
    if (link === undefined)
      return []
    return [{
      guid: item.externalId,
      link,
      outboundUrls: [],
      persistedItemId: item.id,
      title: item.title,
    }]
  })
}

function applyHydrationToPersistedItems(
  graph: PersistedGraph,
  source: IngestionSource,
  feedItems: ParsedFeedItem[],
  touchedItemIds: Set<string>,
): void {
  for (const item of feedItems) {
    if (item.issueHydratedAt === undefined)
      continue
    const persistedItem = persistedItemForHydration(graph, source, item)
    if (persistedItem === undefined)
      throw new Error(`hydrated issue has no persisted Item for Source ${source.id}`)
    persistedItem.issueHydratedAt ??= item.issueHydratedAt
    touchedItemIds.add(persistedItem.id)
    for (const outboundUrl of item.outboundUrls) {
      recordCitation(
        graph,
        persistedItem,
        source,
        outboundUrl.rawUrl,
        'outbound',
        item.issueHydratedAt,
        outboundUrl.baseUrl ?? item.link,
        outboundUrl.anchorText,
      )
    }
  }
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
      textBasis: null,
      embeddingText: null,
      embedding: null,
      embeddingModel: null,
      embeddingDimensions: null,
      embeddingVersion: null,
      embeddedAt: null,
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

const TEXT_BASIS_ORDINAL: Record<SignalTextBasis, number> = {
  slug: 0,
  citing: 1,
  own: 2,
}
const SLUG_HOST_SUFFIXES = new Set(['co', 'com', 'dev', 'io', 'net', 'org'])
const VEHICLE_TRANSPORTS = new Set<IngestionTransport>(['hn_firebase', 'hn_algolia', 'bluesky_feed'])

interface TextBasisCandidate {
  basis: SignalTextBasis
  text: string
}

function itemIsVehicle(graph: PersistedGraph, item: PersistedItem): boolean {
  const source = graph.sources.find(candidate => candidate.id === item.sourceId)
  return source !== undefined
    && VEHICLE_TRANSPORTS.has(source.transport)
    && graph.citations.some(citation => citation.itemId === item.id && citation.kind === 'outbound')
}

function memberCitations(graph: PersistedGraph, root: PersistedSignal): PersistedCitation[] {
  const memberLinkIds = new Set(graph.signals
    .filter(signal => resolveSignal(graph, signal).id === root.id)
    .map(signal => signal.targetLinkId))
  return graph.citations.filter(citation => memberLinkIds.has(citation.linkId))
}

function slugText(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return capEmbeddingText(collapse(url))
  }

  let path = parsed.pathname
  try {
    path = decodeURIComponent(path)
  }
  catch {
    // Keep the URL parser's safe percent-encoded path when decoding is invalid.
  }
  const pathWords = path
    .replace(/\.(?:html?|php|aspx?|md)$/i, '')
    .split(/[/\-_.]+/)
    .filter(Boolean)
    .filter(word => !/^\d{1,4}$/.test(word))
    .filter(word => !/^[\da-f]{8,}$/i.test(word))
  const hostWords = parsed.hostname
    .replace(/^www\./, '')
    .split('.')
    .filter(word => word !== '' && !SLUG_HOST_SUFFIXES.has(word))
  return capEmbeddingText(collapse([...hostWords, ...pathWords].join(' ')))
}

function textBasisForSignal(graph: PersistedGraph, root: PersistedSignal): TextBasisCandidate {
  const citations = memberCitations(graph, root)
  const ownItems = [...new Map(citations
    .filter(citation => citation.kind === 'self')
    .map(citation => graph.items.find(item => item.id === citation.itemId))
    .filter((item): item is PersistedItem => item !== undefined && !itemIsVehicle(graph, item))
    .map(item => [item.id, item])).values()]
    .sort((left, right) =>
      (right.summary?.length ?? 0) - (left.summary?.length ?? 0)
      || left.id.localeCompare(right.id))

  const own = ownItems[0]
  if (own !== undefined) {
    return {
      basis: 'own',
      text: capEmbeddingText(collapse(`${own.title}. ${own.summary ?? ''}`)),
    }
  }

  const citing = citations.filter(citation => citation.kind === 'outbound')
  const anchorCitation = citing
    .filter(citation => citation.anchorText !== null)
    .sort((left, right) =>
      (right.anchorText?.length ?? 0) - (left.anchorText?.length ?? 0)
      || left.id.localeCompare(right.id))
    .at(0)
  const anchor = anchorCitation?.anchorText
  if (anchor !== null && anchor !== undefined) {
    return {
      basis: 'citing',
      text: capEmbeddingText(anchor),
    }
  }

  const citingItem = citing
    .map(citation => graph.items.find(item => item.id === citation.itemId))
    .filter((item): item is PersistedItem => item !== undefined)
    .filter((item) => {
      const source = graph.sources.find(candidate => candidate.id === item.sourceId)
      return source !== undefined && !source.isAggregator
    })
    .sort((left, right) => right.title.length - left.title.length || left.id.localeCompare(right.id))
    .at(0)
  const citingTitle = citingItem?.title
  if (citingTitle !== undefined) {
    return {
      basis: 'citing',
      text: capEmbeddingText(collapse(citingTitle)),
    }
  }

  const target = graph.links.find(link => link.id === root.targetLinkId)
  if (target === undefined)
    throw new Error(`Signal ${root.id} targets missing Link ${root.targetLinkId}`)
  return { basis: 'slug', text: slugText(target.url) }
}

type NumericVector = readonly number[] | Float32Array

function assertStoredVector(
  vector: NumericVector | null,
  label: string,
): asserts vector is NumericVector {
  if (vector === null || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${label} must contain ${EMBEDDING_DIMENSIONS} embedding dimensions; received ${vector?.length ?? 'null'}`,
    )
  }
  if (!vector.every(component => Number.isFinite(component)))
    throw new Error(`${label} embedding must contain only finite numbers`)
}

function validatedProviderVectors(
  vectors: readonly Float32Array[],
  expectedRows: number,
  label: string,
): number[][] {
  if (vectors.length !== expectedRows)
    throw new Error(`${label} embedding returned ${vectors.length} rows; expected ${expectedRows}`)
  return vectors.map((vector, index) => {
    assertStoredVector(vector, `${label} row ${index}`)
    return Array.from(vector)
  })
}

function assertEmbeddingIdentity(
  record: {
    embeddingModel: string | null
    embeddingDimensions: number | null
    embeddingVersion: string | null
  },
  label: string,
): void {
  if (record.embeddingModel !== EMBEDDING_MODEL
    || record.embeddingDimensions !== EMBEDDING_DIMENSIONS
    || record.embeddingVersion !== EMBEDDING_VERSION) {
    throw new Error(`${label} uses a different embedding identity; an explicit full re-embed is required`)
  }
}

function cosine(left: NumericVector, right: NumericVector): number {
  assertStoredVector(left, 'Signal')
  assertStoredVector(right, 'Interest')
  let dot = 0
  let leftSquared = 0
  let rightSquared = 0
  for (let index = 0; index < EMBEDDING_DIMENSIONS; index++) {
    const leftComponent = left[index]!
    const rightComponent = right[index]!
    dot += leftComponent * rightComponent
    leftSquared += leftComponent ** 2
    rightSquared += rightComponent ** 2
  }
  if (leftSquared === 0 || rightSquared === 0)
    throw new Error('Cosine similarity requires non-zero embedding vectors')
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftSquared * rightSquared)))
}

async function embedSignalsAndMatchInterests(
  graph: PersistedGraph,
  provider: EmbeddingProvider,
  at: Date,
): Promise<void> {
  if (provider.model !== EMBEDDING_MODEL
    || provider.dimensions !== EMBEDDING_DIMENSIONS
    || provider.version !== EMBEDDING_VERSION) {
    throw new Error('Embedding provider does not implement the pinned model identity')
  }

  const liveSignals = graph.signals
    .filter(signal => signal.mergedIntoId === null)
    .sort((left, right) => left.id.localeCompare(right.id))
  const signalPlans = liveSignals.flatMap((signal) => {
    const candidate = textBasisForSignal(graph, signal)
    if (candidate.text === '')
      throw new Error(`Signal ${signal.id} has an empty ${candidate.basis} embedding input`)

    if (signal.embedding === null) {
      const partialMetadata = signal.textBasis !== null
        || signal.embeddingText !== null
        || signal.embeddingModel !== null
        || signal.embeddingDimensions !== null
        || signal.embeddingVersion !== null
        || signal.embeddedAt !== null
      if (partialMetadata)
        throw new Error(`Signal ${signal.id} has incomplete embedding state`)
      return [{ signal, candidate }]
    }

    assertStoredVector(signal.embedding, `Signal ${signal.id}`)
    assertEmbeddingIdentity(signal, `Signal ${signal.id}`)
    if (signal.textBasis === null || signal.embeddingText === null || signal.embeddedAt === null)
      throw new Error(`Signal ${signal.id} has incomplete embedding state`)
    return TEXT_BASIS_ORDINAL[candidate.basis] > TEXT_BASIS_ORDINAL[signal.textBasis]
      ? [{ signal, candidate }]
      : []
  })

  const orderedInterests = [...graph.interests].sort((left, right) => left.id.localeCompare(right.id))
  const interestPlans = orderedInterests.flatMap((interest) => {
    if (interest.statement.trim() === '')
      throw new Error(`Interest ${interest.id} has an empty statement`)
    const inputHash = createHash('sha256').update(interest.statement).digest('hex')
    if (interest.embedding === null) {
      const partialMetadata = interest.embeddingInputHash !== null
        || interest.embeddingModel !== null
        || interest.embeddingDimensions !== null
        || interest.embeddingVersion !== null
        || interest.embeddedAt !== null
      if (partialMetadata)
        throw new Error(`Interest ${interest.id} has incomplete embedding state`)
      return [{ interest, inputHash }]
    }

    assertStoredVector(interest.embedding, `Interest ${interest.id}`)
    assertEmbeddingIdentity(interest, `Interest ${interest.id}`)
    if (interest.embeddingInputHash === inputHash && interest.embeddedAt !== null)
      return []
    return [{ interest, inputHash }]
  })

  const signalVectors = signalPlans.length === 0
    ? []
    : validatedProviderVectors(
        await provider.embed(signalPlans.map(plan => plan.candidate.text)),
        signalPlans.length,
        'Signal',
      )
  const interestVectors = interestPlans.length === 0
    ? []
    : validatedProviderVectors(
        await provider.embed(interestPlans.map(plan => plan.interest.statement)),
        interestPlans.length,
        'Interest',
      )

  const plannedSignalVector = new Map(signalPlans.map((plan, index) => [plan.signal.id, signalVectors[index]!]))
  const plannedInterestVector = new Map(interestPlans.map((plan, index) => [plan.interest.id, interestVectors[index]!]))
  const matches: PersistedReaderSignalMatch[] = []

  for (const user of [...graph.users].sort((left, right) => left.id.localeCompare(right.id))) {
    const userInterests = orderedInterests.filter(interest => interest.userId === user.id)
    for (const signal of liveSignals) {
      const signalVector = plannedSignalVector.get(signal.id) ?? signal.embedding
      assertStoredVector(signalVector, `Signal ${signal.id}`)
      const similarities = userInterests.map((interest) => {
        const interestVector = plannedInterestVector.get(interest.id) ?? interest.embedding
        assertStoredVector(interestVector, `Interest ${interest.id}`)
        return { interest, value: cosine(signalVector, interestVector) }
      }).sort((left, right) => right.value - left.value || left.interest.id.localeCompare(right.interest.id))
      const winner = similarities[0]
      matches.push({
        userId: user.id,
        signalId: signal.id,
        matchedInterestId: winner?.interest.id ?? null,
        relevance: winner?.value ?? null,
        gap: similarities.length < 2 ? null : winner!.value - similarities[1]!.value,
        matchedAt: at,
      })
    }
  }

  for (const [index, plan] of signalPlans.entries()) {
    Object.assign(plan.signal, {
      textBasis: plan.candidate.basis,
      embeddingText: plan.candidate.text,
      embedding: signalVectors[index]!,
      embeddingModel: provider.model,
      embeddingDimensions: provider.dimensions,
      embeddingVersion: provider.version,
      embeddedAt: at,
    })
  }
  for (const [index, plan] of interestPlans.entries()) {
    Object.assign(plan.interest, {
      embedding: interestVectors[index]!,
      embeddingInputHash: plan.inputHash,
      embeddingModel: provider.model,
      embeddingDimensions: provider.dimensions,
      embeddingVersion: provider.version,
      embeddedAt: at,
    })
  }
  graph.readerSignalMatches = matches
}

function recordCitation(
  graph: PersistedGraph,
  item: PersistedItem,
  source: IngestionSource,
  rawUrl: string | undefined,
  kind: CitationKind,
  firstSeenAt: Date,
  baseUrl?: string,
  anchorText?: string,
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
    const cleaned = cleanedAnchorText(anchorText)
    if ((cleaned?.length ?? 0) > (existing.anchorText?.length ?? 0))
      existing.anchorText = cleaned ?? null
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
    anchorText: cleanedAnchorText(anchorText) ?? null,
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
): Promise<{
  touchedHttpCacheKeys: ReadonlySet<string>
  touchedItemIds: ReadonlySet<string>
}> {
  const touchedHttpCacheKeys = new Set<string>()
  const touchedItemIds = new Set<string>()
  const result = { touchedHttpCacheKeys, touchedItemIds }
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
        return result
      }
      const pendingHydration = pendingIssueHydrationItems(graph, source)
      const hydration = await hydrateIssuePages(graph, source, pendingHydration, fetch, now)
      for (const hydratedCacheKey of hydration.touchedCacheKeys)
        touchedHttpCacheKeys.add(hydratedCacheKey)
      applyHydrationToPersistedItems(graph, source, pendingHydration, touchedItemIds)
      putHttpCache(graph, cacheKey, response, fetchedAt, true)
      touchedHttpCacheKeys.add(cacheKey)
      source.consecutiveFailures = 0
      source.retryAfterAt = laterDate(originDeferral, hydration.retryAfterAt)
      addLog(graph, source.id, startedAt, now(), 'not_modified', {
        httpStatus: response.status,
        bytes: response.byteLength,
      })
      return result
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
      return result
    }

    const parsed = parseFeed(response.bytes)
    const hydration = await hydrateIssuePages(graph, source, parsed, fetch, now)
    for (const hydratedCacheKey of hydration.touchedCacheKeys)
      touchedHttpCacheKeys.add(hydratedCacheKey)
    putHttpCache(graph, cacheKey, response, fetchedAt)
    touchedHttpCacheKeys.add(cacheKey)
    source.consecutiveFailures = 0
    source.retryAfterAt = laterDate(originDeferral, hydration.retryAfterAt)
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
          issueHydratedAt: item.issueHydratedAt ?? null,
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
          issueHydratedAt: existing.issueHydratedAt ?? item.issueHydratedAt ?? null,
          updatedAt: fetchedAt,
        })
        persistedItem = existing
      }
      touchedItemIds.add(persistedItem.id)
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
          outboundUrl.anchorText,
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
    touchedItemIds.clear()
    const outcome = failureOutcome(error)
    const failedAt = now()
    const originDeferral = response === undefined ? undefined : responseDeferral(response.headers, failedAt)
    recordFailure(graph, source, startedAt, failedAt, outcome, error, response, originDeferral)
  }
  return result
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
  embeddingProvider,
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
        const { touchedHttpCacheKeys, touchedItemIds } = await ingestSource(graph, source, fetch, now)
        await onSourceCommitted?.(source, graph, touchedHttpCacheKeys, touchedItemIds)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queues.length) }, () => worker()))
  mergeReleaseTagAliases(graph)
  updateStrength(graph)
  if (embeddingProvider !== undefined)
    await embedSignalsAndMatchInterests(graph, embeddingProvider, now())
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
