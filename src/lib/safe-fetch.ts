/**
 * `safeFetch` — the only egress in Zis.
 *
 * `security-model.md` §1: **every** outbound HTTP request in the system goes
 * through this module. Not "every untrusted request" — every request, including
 * curated Sources like HN Firebase and GitHub GraphQL, "because an exemption
 * list is the shape a bypass path takes". This is the one file `eslint.config.ts`
 * exempts from the egress rule, which is why it is kept as thin as it can be:
 * address classification lives in `ip.ts` and the robots policy in `robots.ts`,
 * so neither of those files can grow a second way out unnoticed.
 *
 * The shape is a factory rather than a bare function, and that is a consequence
 * of the test list rather than a style choice. §1.2 requires the resolver to be
 * "injected, not imported" so that §7's test 2 — the rebinding test, "the only
 * test that would have caught the Budibase bug" — can be written at all. The
 * transport is injected on the same grounds: the guard has to be provable
 * without opening a socket, and a test that needs a live server is a test that
 * gets skipped.
 *
 * What this module refuses to do is as load-bearing as what it does:
 *
 * - It never truncates. An over-cap response is abandoned mid-transfer and
 *   raised as an error (§1.4), because downloading a body and *then* measuring
 *   it is the OOM the limit exists to prevent.
 * - It never trusts a hostname twice. Each hop resolves, validates **every**
 *   returned address, and connects to the address it validated (§1.1, §1.3).
 * - It never reports a failure to obtain an answer as an answer. Callers get a
 *   typed error, and `robots.ts` maps that to `ambiguous` rather than to allow.
 */

import type { IpFamily } from './ip'
import { Agent, fetch as undiciFetch } from 'undici'
import { blockedReason, numericHostReason, parseIp } from './ip'

/** §1.1. Everything else — `file:`, `data:`, `gopher:`, `blob:` — is refused. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** §1.3. Matching the shortener unwrapper's own limit. */
export const MAX_REDIRECTS = 3

/** §1.4. Enforced by streaming and aborting, never by truncating. */
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

/** §1.4. Total per fetch, not per hop. */
export const DEFAULT_TIMEOUT_MS = 20_000

/**
 * §1.5 asks for "a descriptive User-Agent with a contact URL". It is a constant
 * rather than a setting: the robots verdicts in the register were obtained under
 * a UA, and one that varies makes them unreproducible. Sending a UA that some
 * other crawler is allowed by name is not permission (ADR-0014).
 */
export const USER_AGENT = 'ZisBot/0.1 (+https://github.com/SaKaNa-Y/Zis)'

export interface ResolvedAddress {
  address: string
  family: IpFamily
}

/**
 * The DNS half, injected. Answers with every address for the hostname — all of
 * which are validated, because "a hostname with three A records where one is
 * private must be rejected" (§1.1).
 */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>

/**
 * One request, already validated and pinned to a single address.
 *
 * A transport receives an IP it must connect to and a name TLS must validate
 * against; it never gets to resolve anything itself.
 */
export interface PinnedRequest {
  url: string
  method: 'GET' | 'HEAD'
  headers: Record<string, string>
  /** The validated address the socket must connect to. */
  pinnedIp: string
  family: IpFamily
  /** For TLS SNI and certificate validation — the name, never the address. */
  servername: string
  signal: AbortSignal
}

export interface TransportResponse {
  status: number
  headers: Record<string, string>
  /** Streamed, so the byte cap can abort it. `null` for a bodiless response. */
  body: AsyncIterable<Uint8Array> | null
}

export type Transport = (request: PinnedRequest) => Promise<TransportResponse>

/**
 * Why a fetch produced no response. Callers branch on this rather than on
 * message text — `robots.ts` maps every one of them to `ambiguous`.
 *
 * - `blocked_scheme` — not `http:` or `https:`, or not a URL at all.
 * - `blocked_host` — a hostname that is an address in disguise (`2130706433`).
 * - `blocked_address` — blocked space, at any hop, in any returned record.
 * - `dns_failure` — the resolver threw, or answered with nothing.
 * - `redirect_loop`, `too_many_redirects` — §1.3.
 * - `too_large` — the cap was passed and the transfer abandoned (§1.4).
 * - `timeout` — the 20s budget ran out.
 * - `aborted` — the caller's own signal fired.
 * - `transport_error` — a TLS failure, a reset, a hang-up.
 */
export type SafeFetchErrorCode
  = | 'blocked_scheme'
    | 'blocked_host'
    | 'blocked_address'
    | 'dns_failure'
    | 'redirect_loop'
    | 'too_many_redirects'
    | 'too_large'
    | 'timeout'
    | 'aborted'
    | 'transport_error'

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode
  readonly url: string

  constructor(code: SafeFetchErrorCode, url: string, message: string, options?: { cause?: unknown }) {
    super(`${message} (${url})`, options)
    this.name = 'SafeFetchError'
    this.code = code
    this.url = url
  }
}

export interface SafeFetchDeps {
  resolve: Resolver
  transport?: Transport
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD'
  headers?: Record<string, string>
  /** Total budget for the whole fetch including every hop. Defaults to 20s. */
  timeoutMs?: number
  signal?: AbortSignal
  /**
   * Acquire caller policy/concurrency state immediately before each network
   * hop. The returned release callback is always invoked after that hop's body
   * is consumed or discarded.
   */
  beforeRequest?: (url: string, signal: AbortSignal) => Promise<(() => void) | void>
}

export interface SafeFetchResponse {
  /** The final hop's URL, which is not the requested one when it redirected. */
  url: string
  status: number
  headers: Record<string, string>
  /** The media type alone, with any `charset` parameter stripped. */
  contentType?: string
  bytes: Uint8Array
  byteLength: number
  text: () => string
}

export type SafeFetch = (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResponse>

/** §1.3: 303 becomes a GET; the others keep the method. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * The media type alone, with any parameters dropped.
 *
 * Exported because `robots.ts` decides on it too — a 200 is a robots file only
 * when it is `text/plain`, and two implementations of "what type is this" is one
 * of them being subtly wrong.
 */
export function mediaType(contentTypeHeader: string | undefined): string | undefined {
  if (contentTypeHeader === undefined)
    return undefined
  return contentTypeHeader.split(';')[0]?.trim().toLowerCase()
}

/**
 * Every address the hostname answers with, validated, with the first returned
 * as the pin.
 *
 * An IP literal in the URL is validated and pinned without a lookup — asking the
 * resolver about an address it did not give us is the one place a rebind could
 * still be introduced. Hosts that are numeric forms rather than literals are
 * already gone: `parseTarget` refuses them as written, before `URL` normalizes
 * them into something that looks ordinary.
 */
async function pinAddress(url: URL, resolve: Resolver): Promise<ResolvedAddress> {
  // `URL.hostname` keeps the brackets on a v6 literal.
  const host = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname

  const literal = parseIp(host)
  if (literal !== undefined) {
    const reason = blockedReason(host)
    if (reason !== undefined)
      throw new SafeFetchError('blocked_address', url.href, `refusing ${host}: ${reason}`)
    return { address: host, family: literal.family }
  }

  let addresses: ResolvedAddress[]
  try {
    addresses = await resolve(host)
  }
  catch (cause) {
    throw new SafeFetchError('dns_failure', url.href, `could not resolve ${host}`, { cause })
  }

  // Every address, not the first. One private record poisons the host.
  for (const { address } of addresses) {
    const reason = blockedReason(address)
    if (reason !== undefined)
      throw new SafeFetchError('blocked_address', url.href, `${host} resolves to ${address}: ${reason}`)
  }

  const [pin] = addresses
  if (pin === undefined)
    throw new SafeFetchError('dns_failure', url.href, `${host} resolved to no addresses`)
  return pin
}

/**
 * The host exactly as it was written, before `URL` normalizes it.
 *
 * This is not redundant with `URL.hostname`, and the difference is §7's test 6.
 * The WHATWG parser *silently rewrites* numeric hosts: `http://2130706433/` and
 * `http://127.1/` both come back as `127.0.0.1`, and `http://010.0.0.1/` comes
 * back as **`8.0.0.1`** — a public address, reached by writing a private-looking
 * one. Judged after normalization, two of those look like an ordinary blocked
 * literal and the third looks like an ordinary allowed host. Judged as written,
 * all three are refused for what they are.
 */
function writtenHost(url: string): string | undefined {
  const match = /^[a-z][a-z0-9+.\-]*:\/\/(?:[^/?#@]*@)?(\[[^\]]*\]|[^/?#:]*)/i.exec(url)
  const host = match?.[1]
  return host === undefined || host === '' ? undefined : host
}

function parseTarget(url: string, base?: URL): URL {
  let parsed: URL
  try {
    parsed = new URL(url, base)
  }
  catch {
    throw new SafeFetchError('blocked_scheme', url, 'not a URL')
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol))
    throw new SafeFetchError('blocked_scheme', parsed.href, `scheme ${parsed.protocol} is not http or https`)

  // Fragments are client-side identifiers and must never be sent on the wire.
  parsed.hash = ''

  const written = writtenHost(url)
  if (written !== undefined) {
    const numeric = numericHostReason(written)
    if (numeric !== undefined)
      throw new SafeFetchError('blocked_host', url, `refusing host: ${numeric}`)
  }

  return parsed
}

/** Reads a streamed body, abandoning the transfer the moment it passes the cap. */
async function readCapped(
  body: AsyncIterable<Uint8Array>,
  url: string,
  signal: AbortSignal,
  aborted: () => SafeFetchError | undefined,
): Promise<Uint8Array> {
  const iterator = body[Symbol.asyncIterator]()
  const chunks: Uint8Array[] = []
  let total = 0

  // A body that stalls must hit the fetch's own deadline rather than hanging on
  // `iterator.next()` forever, so each pull races the abort signal.
  let onAbort: (() => void) | undefined
  const abortRace = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(aborted() ?? new SafeFetchError('aborted', url, 'aborted'))
    if (signal.aborted)
      onAbort()
    else
      signal.addEventListener('abort', onAbort, { once: true })
  })
  abortRace.catch(() => {})

  try {
    while (true) {
      const next = await Promise.race([iterator.next(), abortRace])
      if (next.done === true)
        break
      total += next.value.byteLength
      if (total > MAX_RESPONSE_BYTES)
        throw new SafeFetchError('too_large', url, `response exceeded ${MAX_RESPONSE_BYTES} bytes`)
      chunks.push(next.value)
    }
  }
  finally {
    if (onAbort !== undefined)
      signal.removeEventListener('abort', onAbort)
    // Cancels the read rather than draining it — and is deliberately **not
    // awaited**. Closing an iterator that is itself blocked on a stalled peer
    // never settles, so awaiting cleanup would hand the peer the hang that the
    // 20s deadline exists to take away.
    void Promise.resolve(iterator.return?.()).catch(() => {})
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * Discards a redirect's body without reading it into memory — and without
 * waiting for the peer to acknowledge, for the reason `readCapped` gives.
 */
function discard(body: AsyncIterable<Uint8Array> | null): void {
  if (body === null)
    return
  void Promise.resolve(body[Symbol.asyncIterator]().return?.()).catch(() => {})
}

async function acquireRequestLease(
  beforeRequest: SafeFetchOptions['beforeRequest'],
  url: string,
  signal: AbortSignal,
  aborted: () => SafeFetchError | undefined,
): Promise<(() => void) | void> {
  if (beforeRequest === undefined)
    return undefined

  const pending = beforeRequest(url, signal)
  let onAbort: (() => void) | undefined
  const abortRace = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(aborted() ?? new SafeFetchError('aborted', url, 'aborted before request'))
    if (signal.aborted)
      onAbort()
    else
      signal.addEventListener('abort', onAbort, { once: true })
  })
  abortRace.catch(() => {})

  try {
    return await Promise.race([pending, abortRace])
  }
  catch (error) {
    if (signal.aborted)
      void pending.then(release => release?.(), () => {})
    throw error
  }
  finally {
    if (onAbort !== undefined)
      signal.removeEventListener('abort', onAbort)
  }
}

/** `net.LookupFunction`'s callback, in both of the shapes it may be called in. */
type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | { address: string, family: IpFamily }[],
  family?: number,
) => void

/**
 * The real transport: undici, with the pin carried by `dispatcher`.
 *
 * `dispatcher`, **never `agent`** — undici, which backs Node's global `fetch`,
 * silently ignores `agent`, so a guard built on a Node `http(s).Agent` with a
 * custom `lookup` compiles, runs, looks correct, and does nothing. That is
 * GHSA-v42f-v8xc-j435, shipped by Budibase (§1.2).
 *
 * A **fresh dispatcher per request**, because undici's `Agent` pools per origin
 * and a shared instance would leak pins between hosts. One allocation per fetch
 * is free at this volume.
 */
export const undiciTransport: Transport = async (request) => {
  const dispatcher = new Agent({
    connect: {
      // Both callback shapes, because which one `net.connect` uses depends on
      // whether it asked for `all` — and a lookup that answers only one of them
      // is a pin that silently stops applying.
      lookup: (_hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
        if (options.all === true)
          callback(null, [{ address: request.pinnedIp, family: request.family }])
        else
          callback(null, request.pinnedIp, request.family)
      },
      // TLS still validates the NAME, not the address it connected to.
      servername: request.servername,
    },
  })

  let response: Awaited<ReturnType<typeof undiciFetch>>
  try {
    response = await undiciFetch(request.url, {
      method: request.method,
      headers: request.headers,
      // Redirects are followed by `safeFetch` so every hop is revalidated.
      redirect: 'manual',
      signal: request.signal,
      dispatcher,
    })
  }
  catch (error) {
    await dispatcher.close()
    throw error
  }

  const headers: Record<string, string> = {}
  for (const [name, value] of response.headers.entries())
    headers[name.toLowerCase()] = value

  const upstream = response.body
  const body = upstream === null
    ? null
    : (async function* () {
        try {
          for await (const chunk of upstream)
            yield chunk as Uint8Array
        }
        finally {
          // The dispatcher outlives the fetch call because the body is read
          // after it returns; it dies with the body, not before it.
          await dispatcher.destroy()
        }
      })()

  if (body === null)
    await dispatcher.close()

  return { status: response.status, headers, body }
}

/**
 * Builds a `safeFetch` over an injected resolver and transport.
 *
 * The pipeline and the app both call `safeFetch` below; tests build their own
 * instance, which is what makes §7's list assertable without a live server.
 */
export function createSafeFetch({ resolve, transport = undiciTransport }: SafeFetchDeps): SafeFetch {
  return async function safeFetch(url, options = {}) {
    const {
      method = 'GET',
      headers: extraHeaders = {},
      timeoutMs = DEFAULT_TIMEOUT_MS,
      signal: callerSignal,
      beforeRequest,
    } = options

    const controller = new AbortController()
    let abortError: SafeFetchError | undefined

    function abort(error: SafeFetchError): void {
      abortError ??= error
      controller.abort(error)
    }

    const timer = setTimeout(
      () => abort(new SafeFetchError('timeout', url, `no response within ${timeoutMs}ms`)),
      timeoutMs,
    )
    const onCallerAbort = (): void => abort(new SafeFetchError('aborted', url, 'the caller aborted the request'))
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
    if (callerSignal?.aborted === true)
      onCallerAbort()

    try {
      let target = parseTarget(url)
      let hopMethod = method
      const seen = new Set([target.href])

      for (let hop = 0; ; hop++) {
        if (abortError !== undefined)
          throw abortError

        const pin = await pinAddress(target, resolve)
        const release = await acquireRequestLease(beforeRequest, target.href, controller.signal, () => abortError)
        if (abortError !== undefined) {
          release?.()
          throw abortError
        }

        try {
          const requestHeaders: Record<string, string> = {
            'user-agent': USER_AGENT,
            'accept-encoding': 'gzip, deflate',
          }
          for (const [name, value] of Object.entries(extraHeaders))
            requestHeaders[name.toLowerCase()] = value

          const pinned: PinnedRequest = {
            url: target.href,
            method: hopMethod,
            headers: requestHeaders,
            pinnedIp: pin.address,
            family: pin.family,
            servername: target.hostname,
            signal: controller.signal,
          }

          let response: TransportResponse
          try {
            response = await transport(pinned)
          }
          catch (cause) {
            if (abortError !== undefined)
              throw abortError
            throw new SafeFetchError('transport_error', target.href, 'the transport failed', { cause })
          }

          const location = response.headers.location
          if (REDIRECT_STATUSES.has(response.status) && location !== undefined) {
            discard(response.body)

            if (hop >= MAX_REDIRECTS)
              throw new SafeFetchError('too_many_redirects', target.href, `more than ${MAX_REDIRECTS} redirects`)

            const next = parseTarget(location, target)
            if (seen.has(next.href))
              throw new SafeFetchError('redirect_loop', next.href, 'redirect loop')
            seen.add(next.href)

            hopMethod = response.status === 303 ? 'GET' : hopMethod
            target = next
            continue
          }

          const bytes = response.body === null
            ? new Uint8Array(0)
            : await readCapped(response.body, target.href, controller.signal, () => abortError)

          return {
            url: target.href,
            status: response.status,
            headers: response.headers,
            contentType: mediaType(response.headers['content-type']),
            bytes,
            byteLength: bytes.byteLength,
            text: () => new TextDecoder().decode(bytes),
          }
        }
        finally {
          release?.()
        }
      }
    }
    finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', onCallerAbort)
      if (!controller.signal.aborted)
        controller.abort(new SafeFetchError('aborted', url, 'the fetch finished'))
    }
  }
}

/**
 * The resolver the running system uses: the OS one, asked for **every** address.
 *
 * It is exported so call sites inject it explicitly. That keeps the seam §1.2
 * requires visible at each call rather than hidden in a default.
 */
export const systemResolver: Resolver = async (hostname) => {
  const { lookup } = await import('node:dns/promises')
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  return addresses.map(({ address, family }) => ({ address, family: family === 6 ? 6 : 4 }))
}

/** The system's `safeFetch`: OS resolver, undici transport, the pin in place. */
export const safeFetch: SafeFetch = createSafeFetch({ resolve: systemResolver, transport: undiciTransport })
