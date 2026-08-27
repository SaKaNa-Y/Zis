import type { PinnedRequest, ResolvedAddress, Resolver, Transport, TransportResponse } from './safe-fetch'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSafeFetch, MAX_REDIRECTS, MAX_RESPONSE_BYTES, SafeFetchError } from './safe-fetch'

/**
 * The nine tests `security-model.md` §7 requires, in its own order, plus the
 * pieces of §1 they lean on.
 *
 * Every one of them runs against an **injected resolver and an injected
 * transport** — no socket is opened. That is not a testing convenience: §1.2
 * says the resolver is injected rather than imported precisely so that test 2,
 * "the only test that would have caught the Budibase bug", is possible to write
 * at all.
 */

const PUBLIC_IP = '93.184.216.34'
const METADATA_IP = '169.254.169.254'

/** A resolver that answers each lookup from a queue, so rebinding is testable. */
function resolverReturning(...answers: ResolvedAddress[][]): Resolver & { calls: string[] } {
  const calls: string[] = []
  const resolve = async (hostname: string): Promise<ResolvedAddress[]> => {
    calls.push(hostname)
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
    return answer ?? []
  }
  return Object.assign(resolve, { calls })
}

function publicResolver(): Resolver & { calls: string[] } {
  return resolverReturning([{ address: PUBLIC_IP, family: 4 }])
}

function ok(body = 'hello', headers: Record<string, string> = {}): TransportResponse {
  return {
    status: 200,
    headers: { 'content-type': 'text/plain', ...headers },
    body: (async function* () {
      yield new TextEncoder().encode(body)
    })(),
  }
}

/** A transport that records what it was asked to connect to. */
function transportRecording(
  respond: (request: PinnedRequest, hop: number) => TransportResponse,
): Transport & { requests: PinnedRequest[] } {
  const requests: PinnedRequest[] = []
  const transport = async (request: PinnedRequest): Promise<TransportResponse> => {
    requests.push(request)
    return respond(request, requests.length - 1)
  }
  return Object.assign(transport, { requests })
}

function redirectTo(location: string, status = 302): TransportResponse {
  return { status, headers: { location }, body: null }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'resolved'
  }
  catch (error) {
    if (error instanceof SafeFetchError)
      return error.code
    throw error
  }
}

describe('1 — ipv4-mapped ipv6 from the resolver', () => {
  it('rejects ::ffff:169.254.169.254', async () => {
    const safeFetch = createSafeFetch({
      resolve: resolverReturning([{ address: `::ffff:${METADATA_IP}`, family: 6 }]),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('blocked_address')
  })
})

describe('2 — the pin, which is the only test that would have caught the budibase bug', () => {
  it('connects to the first lookup even though the second answers with metadata', async () => {
    const resolve = resolverReturning(
      [{ address: PUBLIC_IP, family: 4 }],
      [{ address: METADATA_IP, family: 4 }],
    )
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({ resolve, transport })

    const response = await safeFetch('https://example.com/feed.xml')

    expect(response.status).toBe(200)
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.pinnedIp).toBe(PUBLIC_IP)
    // Validated once, connected to that same answer. A second lookup at connect
    // time is exactly the window this closes.
    expect(resolve.calls).toEqual(['example.com'])
  })

  it('hands the transport a name for TLS to validate, not just an address', async () => {
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await safeFetch('https://example.com/feed.xml')
    expect(transport.requests[0]?.servername).toBe('example.com')
  })

  it('carries the pin into undici by `dispatcher`, never by `agent`', () => {
    // §1.2: undici silently ignores `agent`, so a guard built on a Node
    // `http(s).Agent` with a custom `lookup` compiles, runs, looks correct, and
    // does nothing (GHSA-v42f-v8xc-j435). The behavioural tests above run
    // against an injected transport and cannot see which option the real one
    // passes, so the real one is asserted here.
    const source = readFileSync(fileURLToPath(new URL('./safe-fetch.ts', import.meta.url)), 'utf8')
    expect(source).toMatch(/^\s*dispatcher[,:]/m)
    expect(source).not.toMatch(/^\s*agent[,:]/m)
    expect(source).toMatch(/^\s*servername:/m)
  })
})

describe('3 — multi-record dns', () => {
  it('rejects the host when one of several addresses is private', async () => {
    const safeFetch = createSafeFetch({
      resolve: resolverReturning([
        { address: PUBLIC_IP, family: 4 },
        { address: '10.0.0.7', family: 4 },
      ]),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('blocked_address')
  })

  it('does not connect at all when one address is bad', async () => {
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({
      resolve: resolverReturning([
        { address: PUBLIC_IP, family: 4 },
        { address: METADATA_IP, family: 4 },
      ]),
      transport,
    })
    await expect(safeFetch('https://example.com/')).rejects.toThrow(SafeFetchError)
    expect(transport.requests).toHaveLength(0)
  })

  it('rejects a host that resolves to nothing', async () => {
    const safeFetch = createSafeFetch({
      resolve: resolverReturning([]),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('dns_failure')
  })
})

describe('4 — per-hop revalidation', () => {
  it('rejects a second hop pointing at 127.0.0.1', async () => {
    const resolve = resolverReturning(
      [{ address: PUBLIC_IP, family: 4 }],
      [{ address: '127.0.0.1', family: 4 }],
    )
    const transport = transportRecording((_request, hop) =>
      hop === 0 ? redirectTo('https://internal.example.com/') : ok())
    const safeFetch = createSafeFetch({ resolve, transport })

    expect(await codeOf(safeFetch('https://example.com/'))).toBe('blocked_address')
    expect(transport.requests).toHaveLength(1)
  })

  it('resolves and pins every hop separately', async () => {
    const resolve = resolverReturning(
      [{ address: PUBLIC_IP, family: 4 }],
      [{ address: '151.101.1.1', family: 4 }],
    )
    const transport = transportRecording((_request, hop) =>
      hop === 0 ? redirectTo('https://elsewhere.example.com/final') : ok())
    const safeFetch = createSafeFetch({ resolve, transport })

    const response = await safeFetch('https://example.com/')

    expect(resolve.calls).toEqual(['example.com', 'elsewhere.example.com'])
    expect(transport.requests.map(request => request.pinnedIp)).toEqual([PUBLIC_IP, '151.101.1.1'])
    expect(response.url).toBe('https://elsewhere.example.com/final')
  })

  it('rejects a redirect that leaves the scheme allowlist', async () => {
    const transport = transportRecording(() => redirectTo('file:///etc/passwd'))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('blocked_scheme')
  })
})

describe('5 — the scheme allowlist', () => {
  it.each(['file:///etc/passwd', 'data:text/plain,hi', 'gopher://example.com/', 'blob:https://example.com/x'])(
    'rejects %s',
    async (url) => {
      const safeFetch = createSafeFetch({
        resolve: publicResolver(),
        transport: transportRecording(() => ok()),
      })
      expect(await codeOf(safeFetch(url))).toBe('blocked_scheme')
    },
  )

  it('rejects text that is not a url at all', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('example.com/feed'))).toBe('blocked_scheme')
  })

  it('allows http as well as https — many feeds are still plain', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ok()),
    })
    await expect(safeFetch('http://example.com/')).resolves.toMatchObject({ status: 200 })
  })
})

describe('6 — encoding tricks', () => {
  it.each([
    ['a bare integer, which the resolver reads as 127.0.0.1', 'http://2130706433/'],
    ['an octal octet', 'http://010.0.0.1/'],
    ['a two-part short form', 'http://127.1/'],
    ['a hex integer', 'http://0x7f000001/'],
  ])('rejects %s without a lookup', async (_why, url) => {
    const resolve = publicResolver()
    const safeFetch = createSafeFetch({ resolve, transport: transportRecording(() => ok()) })
    expect(await codeOf(safeFetch(url))).toBe('blocked_host')
    expect(resolve.calls).toEqual([])
  })

  it('rejects 0.0.0.0 as a literal', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('http://0.0.0.0/'))).toBe('blocked_address')
  })

  it('accepts a public literal without asking the resolver', async () => {
    const resolve = publicResolver()
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({ resolve, transport })
    await expect(safeFetch(`http://${PUBLIC_IP}/`)).resolves.toMatchObject({ status: 200 })
    expect(resolve.calls).toEqual([])
    expect(transport.requests[0]?.pinnedIp).toBe(PUBLIC_IP)
  })
})

describe('7 — the byte cap aborts mid-stream', () => {
  /** A body that reports how much of it was actually pulled. */
  function oversizedBody(): { response: TransportResponse, pulled: () => number, closed: () => boolean } {
    const chunk = new Uint8Array(1024 * 1024)
    let pulled = 0
    let closed = false
    const body = (async function* () {
      try {
        // Ten times the cap. A generator, so nothing exists until it is asked for.
        for (let index = 0; index < 10 + MAX_RESPONSE_BYTES / chunk.byteLength; index++) {
          pulled++
          yield chunk
        }
      }
      finally {
        closed = true
      }
    })()
    return {
      response: { status: 200, headers: { 'content-type': 'text/plain' }, body },
      pulled: () => pulled,
      closed: () => closed,
    }
  }

  it('throws rather than returning a truncated body', async () => {
    const oversized = oversizedBody()
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => oversized.response),
    })
    expect(await codeOf(safeFetch('https://example.com/big'))).toBe('too_large')
  })

  it('stops reading within a chunk of the cap rather than downloading it all', async () => {
    const oversized = oversizedBody()
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => oversized.response),
    })
    await expect(safeFetch('https://example.com/big')).rejects.toThrow(SafeFetchError)

    const cappedChunks = MAX_RESPONSE_BYTES / (1024 * 1024)
    expect(oversized.pulled()).toBeLessThanOrEqual(cappedChunks + 1)
    // The transfer is abandoned, not read to the end and then measured — which
    // is the OOM this limit exists to prevent (§1.4).
    expect(oversized.closed()).toBe(true)
  })

  it('aborts the request signal so the socket is not left draining', async () => {
    const oversized = oversizedBody()
    const transport = transportRecording(() => oversized.response)
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await expect(safeFetch('https://example.com/big')).rejects.toThrow(SafeFetchError)
    expect(transport.requests[0]?.signal.aborted).toBe(true)
  })

  it('lets a body exactly at the cap through', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ({
        status: 200,
        headers: {},
        body: (async function* () {
          yield new Uint8Array(MAX_RESPONSE_BYTES)
        })(),
      })),
    })
    const response = await safeFetch('https://example.com/exactly')
    expect(response.byteLength).toBe(MAX_RESPONSE_BYTES)
  })
})

describe('8 — XXE and billion-laughs are NOT tested here, and cannot be yet', () => {
  /**
   * §7's test 8 is "XXE and billion-laughs payloads **against the chosen
   * parser**", and Zis has no feed parser: §2 says the rule is settled and the
   * **library is #8's choice**, still unmade. So test 8 is **outstanding**, owned
   * by the ticket that picks the parser — not quietly satisfied by what follows.
   *
   * What §2 asks of *this* module is the byte cap "before parsing, not after",
   * and that half is assertable today: no caller can ever be handed an over-cap
   * body to parse, because it is refused rather than truncated.
   */
  it('never hands a caller more than the cap to parse', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ({
        status: 200,
        headers: {},
        body: (async function* () {
          yield new Uint8Array(MAX_RESPONSE_BYTES)
          yield new Uint8Array(1)
        })(),
      })),
    })
    expect(await codeOf(safeFetch('https://example.com/xxe'))).toBe('too_large')
  })
})

describe('9 — hop limits and loops terminate cleanly', () => {
  it('exhausts the hop limit rather than following forever', async () => {
    const transport = transportRecording((_request, hop) => redirectTo(`https://example.com/hop-${hop + 1}`))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })

    expect(await codeOf(safeFetch('https://example.com/hop-0'))).toBe('too_many_redirects')
    expect(transport.requests).toHaveLength(MAX_REDIRECTS + 1)
  })

  it('detects a two-hop loop before the limit', async () => {
    const transport = transportRecording(request =>
      redirectTo(request.url.endsWith('/a') ? 'https://example.com/b' : 'https://example.com/a'))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    expect(await codeOf(safeFetch('https://example.com/a'))).toBe('redirect_loop')
  })

  it('detects a redirect to itself', async () => {
    const transport = transportRecording(() => redirectTo('https://example.com/self'))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    expect(await codeOf(safeFetch('https://example.com/self'))).toBe('redirect_loop')
  })

  it('follows a relative location against the hop it came from', async () => {
    const transport = transportRecording((_request, hop) =>
      hop === 0 ? redirectTo('/moved') : ok())
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    const response = await safeFetch('https://example.com/original')
    expect(response.url).toBe('https://example.com/moved')
  })

  it('treats a 3xx with no location as the response itself', async () => {
    const transport = transportRecording(() => ({ status: 304, headers: { etag: '"x"' }, body: null }))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await expect(safeFetch('https://example.com/')).resolves.toMatchObject({ status: 304 })
  })
})

describe('what the caller gets back', () => {
  it('reports the status, headers and body of the final hop', async () => {
    const transport = transportRecording(() => ok('Disallow: /', { 'x-amzn-waf-action': 'challenge' }))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })

    const response = await safeFetch('https://example.com/robots.txt')

    expect(response.status).toBe(200)
    expect(response.contentType).toBe('text/plain')
    expect(response.headers['x-amzn-waf-action']).toBe('challenge')
    expect(response.text()).toBe('Disallow: /')
    expect(response.byteLength).toBe(11)
  })

  it('returns a 404 rather than throwing — an error status is an answer', async () => {
    const transport = transportRecording(() => ({
      status: 404,
      headers: { 'content-type': 'text/html' },
      body: (async function* () {
        yield new TextEncoder().encode('<h1>Page not found</h1>')
      })(),
    }))
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await expect(safeFetch('https://example.com/robots.txt')).resolves.toMatchObject({ status: 404 })
  })

  it('sends the descriptive user-agent the fetch policy requires', async () => {
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await safeFetch('https://example.com/')
    const userAgent = transport.requests[0]?.headers['user-agent'] ?? ''
    expect(userAgent).toMatch(/Zis/)
    expect(userAgent).toMatch(/https?:\/\//)
    // Compression is asked for explicitly, to spend less of a Publisher's
    // bandwidth. It does not weaken the cap: the bytes counted are the ones
    // actually read, after undici has decompressed them, so a compression bomb
    // aborts on the same threshold as anything else.
    expect(transport.requests[0]?.headers['accept-encoding']).toBe('gzip, deflate')
  })

  it('lets a caller add conditional-request headers without losing the defaults', async () => {
    const transport = transportRecording(() => ok())
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    await safeFetch('https://example.com/', { headers: { 'if-none-match': '"abc"' } })
    expect(transport.requests[0]?.headers['if-none-match']).toBe('"abc"')
    expect(transport.requests[0]?.headers['user-agent']).toBeDefined()
  })
})

describe('the timeout and the caller\'s own abort', () => {
  it('gives up on a transport that never answers', async () => {
    const transport: Transport = async request =>
      new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(new Error('the socket was closed')))
      })
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    expect(await codeOf(safeFetch('https://example.com/', { timeoutMs: 10 }))).toBe('timeout')
  })

  it('gives up on a body that stalls halfway', async () => {
    const transport: Transport = async () => ({
      status: 200,
      headers: {},
      body: (async function* () {
        yield new TextEncoder().encode('some')
        await new Promise(() => {})
      })(),
    })
    const safeFetch = createSafeFetch({ resolve: publicResolver(), transport })
    expect(await codeOf(safeFetch('https://example.com/', { timeoutMs: 10 }))).toBe('timeout')
  })

  it('honours a signal the caller already aborted', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('https://example.com/', { signal: AbortSignal.abort() }))).toBe('aborted')
  })
})

describe('a resolver that fails', () => {
  it('is a dns failure, not a pass', async () => {
    const safeFetch = createSafeFetch({
      resolve: async () => {
        throw new Error('ENOTFOUND')
      },
      transport: transportRecording(() => ok()),
    })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('dns_failure')
  })
})

describe('a transport that fails', () => {
  it('surfaces as a transport error rather than as a status', async () => {
    const safeFetch = createSafeFetch({
      resolve: publicResolver(),
      transport: async () => {
        throw new Error('socket hang up')
      },
    })
    expect(await codeOf(safeFetch('https://example.com/'))).toBe('transport_error')
  })
})
