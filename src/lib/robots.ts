/**
 * The `robots.txt` gate that stands in front of every fetch.
 *
 * Two failure directions matter equally, and this module is judged on both:
 *
 * - **Permissive.** `openhome.bilibili.com/robots.txt` answers 200 with
 *   `text/html`; a parser that trusts the status code finds no `Disallow` and
 *   concludes "allowed" (#16). So the answerable responses are a **positive
 *   whitelist** and everything else fails closed.
 * - **Naive.** `hacker-news.firebaseio.com` serves `Allow: /*.json$` above
 *   `Disallow: /`, so `/v0/topstories.json` is allowed **only** to a parser doing
 *   `*` wildcards, `$` anchoring, and longest-match-wins with Allow beating
 *   Disallow on ties. A line-prefix matcher fails *closed* on the highest-yield
 *   Source in the corpus (#29).
 *
 * Two decisions here are structural rather than incidental:
 *
 * - **A verdict belongs to the host that served it** (ADR-0014). No Publisher
 *   level, and no inference between hosts in **either** direction: a sibling's
 *   readable file cannot clear an unreadable one, and an unverifiable apex
 *   cannot condemn a subdomain that answered.
 * - **A verdict is perishable state, not a qualification.** Four ordinary tech
 *   hosts added a blanket `Disallow: /` inside three years, so the record carries
 *   an `expires_at` that lapses rather than a boolean that persists.
 *
 * `verdict` is **stored, not inferred from an empty `directives`**: an empty
 * ruleset and no obtainable ruleset are opposite facts, and `arstechnica.com`
 * returns the first while meaning the second.
 *
 * The record shape is `ingestion-pipeline.md` §8's `robots_cache`. Persisting it
 * to Postgres arrives with the slice that runs the pipeline; the store is an
 * interface here so that this module is verifiable with no schema at all.
 */

import type { SafeFetchResponse } from './safe-fetch'
import { mediaType, USER_AGENT } from './safe-fetch'

/** 24h (`ingestion-pipeline.md` §8). Expires; never renewed by being read. */
export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000

/**
 * The product token the register's verdicts were obtained under, taken from the
 * one User-Agent so the two can never drift.
 */
export const ROBOTS_USER_AGENT_TOKEN = USER_AGENT.split('/')[0] ?? 'ZisBot'

/** `'allow' | 'disallow' | 'ambiguous'` — `ambiguous` fails closed. */
export type RobotsVerdict = 'allow' | 'disallow' | 'ambiguous'

export interface RobotsRule {
  allow: boolean
  /** As written, `*` and trailing `$` included. */
  pattern: string
}

/** The `directives` jsonb: the group that applies to us, and nothing else. */
export interface RobotsDirectives {
  /** The `User-agent` value whose group was chosen, or `null` if none applied. */
  matchedUserAgent: string | null
  rules: RobotsRule[]
}

/** What the gate needs from a response — a `SafeFetchResponse` satisfies it. */
export type RobotsProbeResponse = Pick<SafeFetchResponse, 'status' | 'headers' | 'contentType' | 'byteLength' | 'text'>

/**
 * A probe either got a response or did not. A failure to obtain an answer is
 * never an answer: a timeout and a TLS handshake failure are `ambiguous`, and
 * `hnrss.org` failing a handshake once and allowing all on retry is why.
 */
export type RobotsProbe
  = | { ok: true, response: RobotsProbeResponse }
    | { ok: false, error: unknown }

/** `ingestion-pipeline.md` §8's `robots_cache`, one row per host. */
export interface RobotsCacheRecord {
  host: string
  verdict: RobotsVerdict
  directives: RobotsDirectives
  /** 0 when nothing was received at all. */
  status: number
  contentType?: string
  /** e.g. `'challenge'`, `'captcha'` — the evidence an exclusion would quote. */
  wafAction?: string
  /** Whether the response is in the whitelist, i.e. whether the host answered. */
  authoritative: boolean
  fetchedAt: Date
  expiresAt: Date
}

const EMPTY_DIRECTIVES: RobotsDirectives = { matchedUserAgent: null, rules: [] }

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `*` is any sequence; a trailing `$` anchors to the end of the path. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const source = body.split('*').map(escapeRegex).join('.*')
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path)
}

/**
 * Parses the group that applies to us out of a `robots.txt` body.
 *
 * Group selection is RFC 9309: the **most specific** `User-agent` that is still
 * a prefix of our product token wins, and only if none is, the `*` group
 * applies. A group naming some other crawler is not ours to read — The
 * Register's file allows `Claude-User` by name, and sending that token to clear
 * a default-deny is not permission (ADR-0014).
 */
export function parseRobotsTxt(text: string, userAgentToken: string = ROBOTS_USER_AGENT_TOKEN): RobotsDirectives {
  /** Rules by lowercased `User-agent` value; records naming one agent merge. */
  const groups = new Map<string, RobotsRule[]>()
  let agents: string[] = []
  let inAgentBlock = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? ''
    if (line === '')
      continue

    const separator = line.indexOf(':')
    if (separator === -1)
      continue
    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      if (!inAgentBlock) {
        agents = []
        inAgentBlock = true
      }
      if (value !== '')
        agents.push(value)
      continue
    }

    // Any other field closes the User-agent block, whether or not this module
    // reads it. `Crawl-delay` and `Content-Signal` are group fields Zis does not
    // act on yet; they still end the block, so the next `User-agent` starts a
    // new record rather than joining this one.
    inAgentBlock = false

    if (field !== 'allow' && field !== 'disallow')
      continue
    // An empty value is not a rule: `Disallow:` means "nothing is disallowed".
    if (value === '')
      continue

    for (const agent of agents) {
      const key = agent.toLowerCase()
      const rules = groups.get(key) ?? []
      rules.push({ allow: field === 'allow', pattern: value })
      groups.set(key, rules)
    }
  }

  const token = userAgentToken.toLowerCase()
  let matched: string | undefined
  for (const key of groups.keys()) {
    if (key === '*' || !token.startsWith(key))
      continue
    if (matched === undefined || key.length > matched.length)
      matched = key
  }
  matched ??= groups.has('*') ? '*' : undefined

  if (matched === undefined)
    return { ...EMPTY_DIRECTIVES }
  return { matchedUserAgent: matched, rules: groups.get(matched) ?? [] }
}

/**
 * Whether a path (with its query) is allowed by an obtained ruleset.
 *
 * Longest match wins; Allow beats Disallow on a tie. Both halves are what
 * `hacker-news.firebaseio.com` needs, and a ruleset nobody's rule matches allows
 * — which is only ever consulted for a host that *answered*, since `ambiguous`
 * is refused before this is called.
 */
export function isPathAllowed(directives: RobotsDirectives, path: string): boolean {
  let best: RobotsRule | undefined
  for (const rule of directives.rules) {
    if (!matches(rule.pattern, path))
      continue
    if (best === undefined || rule.pattern.length > best.pattern.length
      || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule
    }
  }
  return best?.allow ?? true
}

/**
 * Whether a ruleset leaves nothing at all open for us.
 *
 * This is what separates `disallow` from `allow` at host level, and the
 * definition is deliberate: **`disallow` means nothing on this host is
 * reachable**, not "the root is disallowed". HN Firebase disallows `/` and is
 * nonetheless a live Source, because `Allow: /*.json$` leaves the path Zis
 * actually fetches open — and `Disallow: /` beside a lone `Allow: /favicon.ico`
 * is the same shape, so it records as `allow` too.
 *
 * That is not the register saying such a host is usable. ADR-0014 settles
 * usability per path — "a Source is usable when **the hosts it actually fetches**
 * are cleared" — and the per-path answer is `isPathAllowed`, which refuses every
 * path but the one the file opened. The host-level word exists so a curator can
 * see at a glance which hosts have a quotable blanket block; it is never the
 * thing a fetch consults.
 */
function blanketDenies(directives: RobotsDirectives): boolean {
  if (directives.rules.some(rule => rule.allow))
    return false
  return !isPathAllowed(directives, '/')
}

function mediaTypeOf(response: RobotsProbeResponse): string | undefined {
  // Normalized even when the caller already normalized it: a `text/plain;
  // charset=UTF-8` that arrived unstripped must not read as a third media type.
  return mediaType(response.contentType ?? response.headers['content-type'])
}

/**
 * Turns one probe into the `robots_cache` row for that host.
 *
 * The whitelist, positively and exhaustively (ADR-0014):
 *
 * | response | verdict |
 * |---|---|
 * | 200 + `text/plain` | parse and obey |
 * | **any** 404 | allow — body and content-type irrelevant |
 * | 200 + any other content-type | ambiguous |
 * | 2xx other than 200, or a zero-length 2xx | ambiguous |
 * | any other 4xx, any 5xx, timeout, TLS failure | ambiguous |
 *
 * The asymmetry between the two answerable rows is the whole rule: **on a 200
 * the body *is* the ruleset**, so content-type is load-bearing; on a 404 there is
 * no ruleset to misparse, so the status alone carries the meaning and the body is
 * merely what the server shows humans. 18 of the corpus's 19 `404-ALLOWED` hosts
 * serve `text/html` there, one of them 518 KB of it.
 */
export function recordFrom(host: string, probe: RobotsProbe, at: Date): RobotsCacheRecord {
  const base = {
    host,
    fetchedAt: at,
    expiresAt: new Date(at.getTime() + ROBOTS_TTL_MS),
  }

  if (!probe.ok) {
    return { ...base, verdict: 'ambiguous', directives: { ...EMPTY_DIRECTIVES }, status: 0, authoritative: false }
  }

  const { response } = probe
  const contentType = mediaTypeOf(response)
  const wafAction = response.headers['x-amzn-waf-action']
  const evidence = { status: response.status, contentType, wafAction }

  // Any 404 allows. The body is never evidence again — if a future guard wants
  // to reject a 404 it needs a property that is not body size, and the 18
  // HTML-on-404 hosts in the corpus are the test it has to pass.
  if (response.status === 404)
    return { ...base, ...evidence, verdict: 'allow', directives: { ...EMPTY_DIRECTIVES }, authoritative: true }

  if (response.status === 200 && contentType === 'text/plain' && response.byteLength > 0) {
    const directives = parseRobotsTxt(response.text())
    return {
      ...base,
      ...evidence,
      verdict: blanketDenies(directives) ? 'disallow' : 'allow',
      directives,
      authoritative: true,
    }
  }

  return { ...base, ...evidence, verdict: 'ambiguous', directives: { ...EMPTY_DIRECTIVES }, authoritative: false }
}

export interface RobotsStore {
  get: (host: string) => Promise<RobotsCacheRecord | undefined>
  put: (record: RobotsCacheRecord) => Promise<void>
}

/**
 * The store the tests and a single pipeline run use. The Postgres-backed one
 * arrives with the slice that has a schema; both satisfy `RobotsStore`, so the
 * TTL logic above is written once.
 */
export function createInMemoryRobotsStore(): RobotsStore {
  const records = new Map<string, RobotsCacheRecord>()
  return {
    get: async host => records.get(host),
    put: async (record) => {
      records.set(record.host, record)
    },
  }
}

export interface RobotsGateDeps {
  /** A `safeFetch` bound by the caller. This module never fetches directly. */
  fetchRobots: (url: string) => Promise<RobotsProbeResponse>
  store: RobotsStore
  now?: () => Date
}

export interface RobotsDecision {
  allowed: boolean
  /** Absent only when the URL itself could not be read. */
  record?: RobotsCacheRecord
  reason: string
}

export interface RobotsGate {
  decide: (url: string) => Promise<RobotsDecision>
  isAllowed: (url: string) => Promise<boolean>
}

/**
 * The gate: per host, before fetching, on a TTL that expires.
 *
 * `fetchRobots` is injected for the same reason `safeFetch`'s resolver is — the
 * whitelist has nineteen rows and every one of them has to be assertable without
 * a live host on the other end.
 */
export function createRobotsGate({ fetchRobots, store, now = () => new Date() }: RobotsGateDeps): RobotsGate {
  async function decide(url: string): Promise<RobotsDecision> {
    let target: URL
    try {
      target = new URL(url)
    }
    catch {
      return { allowed: false, reason: `not a URL: ${JSON.stringify(url)}` }
    }

    const at = now()
    const host = target.host
    let record = await store.get(host)

    // Past `expires_at` the entry is re-fetched rather than trusted. A verdict
    // that persisted as a boolean would never see a blanket block land.
    if (record === undefined || record.expiresAt.getTime() <= at.getTime()) {
      let probe: RobotsProbe
      try {
        probe = { ok: true, response: await fetchRobots(`${target.protocol}//${host}/robots.txt`) }
      }
      catch (error) {
        probe = { ok: false, error }
      }
      record = recordFrom(host, probe, at)
      await store.put(record)
    }

    if (record.verdict === 'ambiguous') {
      return {
        allowed: false,
        record,
        reason: `${host} yielded no verdict (status ${record.status}${record.wafAction === undefined ? '' : `, waf ${record.wafAction}`})`,
      }
    }

    const path = `${target.pathname}${target.search}`
    const allowed = isPathAllowed(record.directives, path)
    return {
      allowed,
      record,
      reason: allowed
        ? `${host} allows ${path}`
        : `${host} disallows ${path} (${record.directives.matchedUserAgent ?? 'no group'})`,
    }
  }

  return {
    decide,
    isAllowed: async url => (await decide(url)).allowed,
  }
}
