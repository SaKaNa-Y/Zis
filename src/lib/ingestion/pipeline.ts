import type { RobotsCacheRecord, RobotsStore } from '@/lib/robots'
import type { PinnedRequest, SafeFetch, SafeFetchResponse, TransportResponse } from '@/lib/safe-fetch'
import { createHash, randomUUID } from 'node:crypto'
import { SaxesParser } from 'saxes'
import { createRobotsGate } from '@/lib/robots'
import { createSafeFetch, SafeFetchError } from '@/lib/safe-fetch'

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
  title: string
  summary?: string
  rawFeedDate?: string
}

interface MutableFeedItem {
  fields: Map<string, string>
  atomLink?: string
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

  const link = item.atomLink ?? readField(item, 'link')
  const summary = plainText(readField(item, 'summary', 'description', 'content', 'encoded') ?? '')
  return {
    guid: readField(item, 'guid', 'id'),
    link,
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
        current = { fields: new Map() }
        return
      }
      if (current === undefined || name !== 'link')
        return

      const href = tag.attributes.href
      const rel = tag.attributes.rel
      if (typeof href === 'string' && (rel === undefined || rel === 'alternate'))
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

const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid'])

function canonicalizeItemUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '')
    return undefined
  try {
    const url = new URL(value.trim())
    url.hash = ''
    for (const name of [...url.searchParams.keys()]) {
      if (name.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(name.toLowerCase()))
        url.searchParams.delete(name)
    }
    url.searchParams.sort()
    return url.href
  }
  catch {
    return undefined
  }
}

function itemExternalId(item: ParsedFeedItem, canonicalUrl: string | undefined): string {
  const guid = item.guid?.trim()
  if (guid !== undefined && guid !== '')
    return guid
  if (canonicalUrl !== undefined)
    return canonicalUrl
  return `sha256:${createHash('sha256').update(`${item.title}${item.link ?? ''}`).digest('hex')}`
}

function normalizedPublishedAt(rawFeedDate: string | undefined, fetchedAt: Date): Date {
  if (rawFeedDate === undefined)
    return fetchedAt
  const milliseconds = Date.parse(rawFeedDate)
  if (!Number.isFinite(milliseconds) || milliseconds > fetchedAt.getTime())
    return fetchedAt
  return new Date(milliseconds)
}

export type IngestionTransport = 'rss' | 'atom'
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
  now?: () => Date
  initialGraph?: PersistedGraph
  onSourceCommitted?: (source: IngestionSource, graph: PersistedGraph) => Promise<void>
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

function emptyGraph(sources: IngestionSource[]): PersistedGraph {
  return {
    sources: sources.map(cloneSource),
    items: [],
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

function putHttpCache(
  graph: PersistedGraph,
  url: string,
  response: SafeFetchResponse,
  fetchedAt: Date,
  preserveMissingValidators = false,
): void {
  const existing = graph.httpCache.find(record => record.url === url)
  const record: HttpCacheRecord = {
    url,
    etag: response.headers.etag ?? (preserveMissingValidators ? existing?.etag : null) ?? null,
    lastModified: response.headers['last-modified'] ?? (preserveMissingValidators ? existing?.lastModified : null) ?? null,
    lastStatus: response.status,
    fetchedAt,
  }
  if (existing === undefined)
    graph.httpCache.push(record)
  else
    Object.assign(existing, record)
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

async function ingestSource(
  graph: PersistedGraph,
  source: IngestionSource,
  fetch: ReturnType<typeof createCannedSafeFetch>,
  now: () => Date,
): Promise<void> {
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
        return
      }
      putHttpCache(graph, cacheKey, response, fetchedAt, true)
      source.consecutiveFailures = 0
      source.retryAfterAt = originDeferral
      addLog(graph, source.id, startedAt, now(), 'not_modified', {
        httpStatus: response.status,
        bytes: response.byteLength,
      })
      return
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
      return
    }

    const parsed = parseFeed(response.bytes)
    putHttpCache(graph, cacheKey, response, fetchedAt)
    source.consecutiveFailures = 0
    source.retryAfterAt = originDeferral
    let itemsNew = 0
    let newest: Date | null = null
    for (const item of parsed) {
      const url = canonicalizeItemUrl(item.link)
      const externalId = itemExternalId(item, url)
      const publishedAt = normalizedPublishedAt(item.rawFeedDate, fetchedAt)
      const existing = graph.items.find(candidate => candidate.sourceId === source.id && candidate.externalId === externalId)
      if (existing === undefined) {
        graph.items.push({
          id: randomUUID(),
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
        })
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
    const outcome = failureOutcome(error)
    const failedAt = now()
    const originDeferral = response === undefined ? undefined : responseDeferral(response.headers, failedAt)
    recordFailure(graph, source, startedAt, failedAt, outcome, error, response, originDeferral)
  }
}

/**
 * Issue #69's one behavioral seam: Sources plus canned egress responses in,
 * the persisted graph out. No fetch/parse/normalize stage is exported as a
 * separate seam.
 */
export async function runIngestion({
  sources,
  responses,
  fetch: liveFetch,
  now = () => new Date(),
  initialGraph,
  onSourceCommitted,
}: RunIngestionInput): Promise<PersistedGraph> {
  const graph = initialGraph ?? emptyGraph(sources)
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
        await ingestSource(graph, source, fetch, now)
        await onSourceCommitted?.(source, graph)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queues.length) }, () => worker()))
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
