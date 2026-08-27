import type { RobotsProbe } from './robots'
import { describe, expect, it } from 'vitest'
import {
  createInMemoryRobotsStore,
  createRobotsGate,
  isPathAllowed,
  parseRobotsTxt,
  recordFrom,
  ROBOTS_TTL_MS,
} from './robots'
import { SafeFetchError } from './safe-fetch'

/**
 * The robots gate: the parser, the response whitelist, and the cache.
 *
 * The two failure directions matter equally. A permissive parser causes a policy
 * violation; a naive one fails **closed** on the corpus's highest-yield Source.
 * So both directions are asserted here, and the whitelist is asserted as a
 * **table** rather than as branches — the table in `ingestion-pipeline.md` §8 is
 * the specification, and a per-branch test lets a row go missing silently.
 */

/** A probe result standing in for what `safeFetch` hands the gate back. */
function served(
  status: number,
  { body = '', contentType, headers = {} }: { body?: string, contentType?: string, headers?: Record<string, string> } = {},
): RobotsProbe {
  const bytes = new TextEncoder().encode(body)
  return {
    ok: true,
    response: {
      status,
      contentType,
      headers: contentType === undefined ? headers : { 'content-type': contentType, ...headers },
      byteLength: bytes.byteLength,
      text: () => body,
    },
  }
}

function failed(code: 'timeout' | 'transport_error' = 'timeout'): RobotsProbe {
  return { ok: false, error: new SafeFetchError(code, 'https://example.com/robots.txt', 'no answer') }
}

const AT = new Date('2026-08-23T09:00:00.000Z')

describe('the answerable-response whitelist, as a table', () => {
  /**
   * `ingestion-pipeline.md` §8 / ADR-0014, row for row. Only two responses yield
   * a verdict; every other row is `ambiguous`, which fails closed.
   */
  const table: { why: string, probe: RobotsProbe, verdict: string }[] = [
    { why: '200 + text/plain is the ruleset', probe: served(200, { body: 'User-agent: *\nDisallow: /private\n', contentType: 'text/plain' }), verdict: 'allow' },
    { why: '200 + text/plain with a charset is still text/plain', probe: served(200, { body: 'User-agent: *\nDisallow:\n', contentType: 'text/plain; charset=UTF-8' }), verdict: 'allow' },
    { why: 'any 404 allows', probe: served(404, { body: 'nope', contentType: 'text/plain' }), verdict: 'allow' },
    { why: 'a 404 serving html still allows', probe: served(404, { body: '<h1>Page not found</h1>', contentType: 'text/html' }), verdict: 'allow' },
    { why: 'a 404 with no content-type at all still allows', probe: served(404), verdict: 'allow' },
    { why: '200 + text/html is not a robots file', probe: served(200, { body: '<html>hi</html>', contentType: 'text/html' }), verdict: 'ambiguous' },
    { why: '200 + application/json is not a robots file', probe: served(200, { body: '{}', contentType: 'application/json' }), verdict: 'ambiguous' },
    { why: '200 with no content-type is not a robots file', probe: served(200, { body: 'Disallow: /' }), verdict: 'ambiguous' },
    { why: 'a zero-length 200 is not an empty ruleset', probe: served(200, { body: '', contentType: 'text/plain' }), verdict: 'ambiguous' },
    { why: 'a 2xx other than 200', probe: served(202, { body: 'x', contentType: 'text/plain' }), verdict: 'ambiguous' },
    { why: 'a 204', probe: served(204), verdict: 'ambiguous' },
    { why: 'a 301 that safeFetch could not resolve to a body', probe: served(301), verdict: 'ambiguous' },
    { why: 'a 403', probe: served(403, { body: 'no', contentType: 'text/plain' }), verdict: 'ambiguous' },
    { why: 'a 406 — feed.infoq.com', probe: served(406, { body: '{}', contentType: 'application/json' }), verdict: 'ambiguous' },
    { why: 'a 429', probe: served(429), verdict: 'ambiguous' },
    { why: 'a 500', probe: served(500, { body: 'oops', contentType: 'text/plain' }), verdict: 'ambiguous' },
    { why: 'a 503', probe: served(503), verdict: 'ambiguous' },
    { why: 'a timeout is not a verdict', probe: failed('timeout'), verdict: 'ambiguous' },
    { why: 'a TLS failure is not a verdict — hnrss.org failed a handshake once', probe: failed('transport_error'), verdict: 'ambiguous' },
  ]

  it.each(table)('$why → $verdict', ({ probe, verdict }) => {
    expect(recordFrom('example.com', probe, AT).verdict).toBe(verdict)
  })

  it('covers every row of the specified table', () => {
    // Three answerable rows and sixteen refusing ones. The count is asserted so
    // that deleting a row is a failing test rather than a silent narrowing.
    expect(table).toHaveLength(19)
    expect(table.filter(row => row.verdict === 'allow')).toHaveLength(5)
  })

  it('records a blanket disallow as `disallow`, not as `allow` with rules', () => {
    const record = recordFrom('lobste.rs', served(200, { body: 'User-agent: *\nDisallow: /\n', contentType: 'text/plain' }), AT)
    expect(record.verdict).toBe('disallow')
  })

  it('records `allow` when a blanket block leaves one path open, and denies the rest', () => {
    // The host-level word means "something here is reachable", which is the same
    // reading that keeps HN Firebase a Source. What a fetch may touch is a
    // per-path question, and it stays refused.
    const record = recordFrom(
      'example.com',
      served(200, { body: 'User-agent: *\nDisallow: /\nAllow: /favicon.ico\n', contentType: 'text/plain' }),
      AT,
    )
    expect(record.verdict).toBe('allow')
    expect(isPathAllowed(record.directives, '/favicon.ico')).toBe(true)
    expect(isPathAllowed(record.directives, '/feed.xml')).toBe(false)
  })
})

describe('a 404\'s body is never evidence', () => {
  it('allows a 518 KB html 404 — feeds.arstechnica.com', () => {
    const body = `<h1>Page not found | Ars Technica</h1>${'x'.repeat(518 * 1024)}`
    const record = recordFrom('feeds.arstechnica.com', served(404, { body, contentType: 'text/html' }), AT)
    expect(record.verdict).toBe('allow')
    expect(record.directives.rules).toEqual([])
    expect(isPathAllowed(record.directives, '/arstechnica/index')).toBe(true)
  })

  it('does not read the 404 body as directives, however robots-shaped it looks', () => {
    const record = recordFrom('example.com', served(404, { body: 'User-agent: *\nDisallow: /\n', contentType: 'text/plain' }), AT)
    expect(record.verdict).toBe('allow')
    expect(record.directives.rules).toEqual([])
  })
})

describe('the corpus responses that produced the rule', () => {
  it('denies openhome.bilibili.com — 200 with text/html', () => {
    // A parser trusting the status code finds no `Disallow` and concludes
    // "allowed". That is the fail-open bug the whitelist exists to close (#16).
    const record = recordFrom('openhome.bilibili.com', served(200, { body: '<!DOCTYPE html><title>bilibili</title>', contentType: 'text/html' }), AT)
    expect(record.verdict).toBe('ambiguous')
    expect(record.authoritative).toBe(false)
    expect(isPathAllowed(record.directives, '/')).toBe(true)
    // ...and yet the host is denied, because the verdict decides, not the rules.
    expect(record.verdict === 'allow').toBe(false)
  })

  it('denies arstechnica.com — 202, zero length, x-amzn-waf-action: challenge', () => {
    const record = recordFrom('arstechnica.com', served(202, { body: '', headers: { 'x-amzn-waf-action': 'challenge' } }), AT)
    expect(record.verdict).toBe('ambiguous')
    expect(record.wafAction).toBe('challenge')
    expect(record.status).toBe(202)
  })

  it('denies feed.infoq.com — 406 application/json — and keeps the evidence', () => {
    const record = recordFrom('feed.infoq.com', served(406, { body: '{"error":true}', contentType: 'application/json' }), AT)
    expect(record).toMatchObject({ verdict: 'ambiguous', status: 406, contentType: 'application/json' })
  })

  it('records a captcha WAF action from the apex — infoq.com', () => {
    const record = recordFrom('infoq.com', served(405, { headers: { 'x-amzn-waf-action': 'captcha' } }), AT)
    expect(record.wafAction).toBe('captcha')
  })
})

describe('the parser, in the permissive direction', () => {
  it('reads a plain disallow', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /private\n')
    expect(isPathAllowed(directives, '/private/thing')).toBe(false)
    expect(isPathAllowed(directives, '/public')).toBe(true)
  })

  it('ignores comments and blank lines', () => {
    const directives = parseRobotsTxt('# hello\n\nUser-agent: *  # us\nDisallow: /x  # no\n')
    expect(isPathAllowed(directives, '/x')).toBe(false)
    expect(isPathAllowed(directives, '/y')).toBe(true)
  })

  it('treats an empty Disallow as allowing everything', () => {
    expect(isPathAllowed(parseRobotsTxt('User-agent: *\nDisallow:\n'), '/anything')).toBe(true)
  })

  it('obeys the group naming us over the wildcard group', () => {
    const text = 'User-agent: *\nDisallow:\n\nUser-agent: ZisBot\nDisallow: /\n'
    expect(isPathAllowed(parseRobotsTxt(text), '/feed')).toBe(false)
  })

  it('prefix-matches the product token, case-insensitively', () => {
    const text = 'User-agent: zis\nDisallow: /nope\n'
    expect(isPathAllowed(parseRobotsTxt(text), '/nope')).toBe(false)
  })

  it('ignores a group for some other crawler', () => {
    const text = 'User-agent: Claude-User\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n'
    // The Register allows `Claude-User` by name; Zis's crawler is not it, and
    // sending that UA to clear a default-deny is not permission (ADR-0014).
    expect(isPathAllowed(parseRobotsTxt(text), '/feed')).toBe(true)
    expect(isPathAllowed(parseRobotsTxt(text), '/admin')).toBe(false)
  })

  it('merges two records that name the same agent', () => {
    const text = 'User-agent: *\nDisallow: /a\n\nUser-agent: *\nDisallow: /b\n'
    expect(isPathAllowed(parseRobotsTxt(text), '/a')).toBe(false)
    expect(isPathAllowed(parseRobotsTxt(text), '/b')).toBe(false)
  })

  it('is case-insensitive about field names and tolerant of missing space', () => {
    expect(isPathAllowed(parseRobotsTxt('USER-AGENT:*\nDISALLOW:/x\n'), '/x')).toBe(false)
  })

  it('allows a path no rule mentions when the file has only Allow lines', () => {
    expect(isPathAllowed(parseRobotsTxt('User-agent: *\nAllow: /feed\n'), '/other')).toBe(true)
  })
})

describe('the parser, in the fail-closed direction', () => {
  /**
   * `hacker-news.firebaseio.com` serves `Allow: /*.json$` **above**
   * `Disallow: /`. A line-prefix matcher fails *closed* on the highest-yield
   * Source in the corpus, which is the other half of "both directions have to be
   * right" (#29).
   */
  const HN = 'User-agent: *\nAllow: /*.json$\nDisallow: /\n'

  it('does not fail closed on hacker-news.firebaseio.com', () => {
    const directives = parseRobotsTxt(HN)
    expect(isPathAllowed(directives, '/v0/topstories.json')).toBe(true)
    expect(isPathAllowed(directives, '/v0/item/12345.json')).toBe(true)
  })

  it('still obeys the blanket Disallow for everything else on that host', () => {
    const directives = parseRobotsTxt(HN)
    expect(isPathAllowed(directives, '/v0/topstories')).toBe(false)
    expect(isPathAllowed(directives, '/')).toBe(false)
    // `$` anchors: a path merely containing `.json` is not allowed.
    expect(isPathAllowed(directives, '/v0/topstories.json/raw')).toBe(false)
  })

  it('records the host as `allow`, because a fetched path is reachable', () => {
    const record = recordFrom('hacker-news.firebaseio.com', served(200, { body: HN, contentType: 'text/plain' }), AT)
    expect(record.verdict).toBe('allow')
    expect(isPathAllowed(record.directives, '/v0/topstories.json')).toBe(true)
  })

  it('handles `*` in the middle of a pattern', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /a/*/secret\n')
    expect(isPathAllowed(directives, '/a/b/secret')).toBe(false)
    expect(isPathAllowed(directives, '/a/b/c/secret')).toBe(false)
    expect(isPathAllowed(directives, '/a/secret-ish')).toBe(true)
  })

  it('anchors `$` to the end of the path', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$\n')
    expect(isPathAllowed(directives, '/doc.pdf')).toBe(false)
    expect(isPathAllowed(directives, '/doc.pdf.html')).toBe(true)
  })

  it('gives the longest match the decision', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /feed\nAllow: /feed/atom\n')
    expect(isPathAllowed(directives, '/feed/atom.xml')).toBe(true)
    expect(isPathAllowed(directives, '/feed/rss.xml')).toBe(false)
  })

  it('gives Allow the decision on a tie', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /feed\nAllow: /feed\n')
    expect(isPathAllowed(directives, '/feed')).toBe(true)
  })

  it('treats regex metacharacters in a pattern as literals', () => {
    const directives = parseRobotsTxt('User-agent: *\nDisallow: /a+b(c)\n')
    expect(isPathAllowed(directives, '/a+b(c)')).toBe(false)
    expect(isPathAllowed(directives, '/aab')).toBe(true)
  })
})

describe('the cache record', () => {
  it('is keyed by host and holds the evidence, not just the answer', () => {
    const record = recordFrom('arstechnica.com', served(202, { body: '', headers: { 'x-amzn-waf-action': 'challenge' } }), AT)
    expect(record).toMatchObject({
      host: 'arstechnica.com',
      verdict: 'ambiguous',
      status: 202,
      wafAction: 'challenge',
      authoritative: false,
      fetchedAt: AT,
    })
    expect(record.expiresAt.getTime() - AT.getTime()).toBe(ROBOTS_TTL_MS)
  })

  it('expires in 24 hours, because a verdict is perishable state', () => {
    expect(ROBOTS_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('stores the verdict rather than leaving it inferable from empty directives', () => {
    // The whole point of the column: an empty ruleset and no obtainable ruleset
    // are opposite facts, and one host returns the first while meaning the
    // second.
    const absent = recordFrom('fly.io', served(404, { body: '<h1>404</h1>', contentType: 'text/html' }), AT)
    const unanswerable = recordFrom('arstechnica.com', served(202, { body: '' }), AT)
    expect(absent.directives).toEqual(unanswerable.directives)
    expect(absent.verdict).not.toBe(unanswerable.verdict)
  })

  it('marks only whitelisted responses authoritative', () => {
    expect(recordFrom('remix.run', served(404), AT).authoritative).toBe(true)
    expect(recordFrom('example.com', served(200, { body: 'Disallow:\n', contentType: 'text/plain' }), AT).authoritative).toBe(true)
    expect(recordFrom('example.com', served(500), AT).authoritative).toBe(false)
  })
})

describe('the gate', () => {
  interface Answer { status: number, body?: string, contentType?: string }

  function gateOver(answers: Record<string, Answer>, clock: { at: Date }) {
    const fetched: string[] = []
    const gate = createRobotsGate({
      store: createInMemoryRobotsStore(),
      now: () => clock.at,
      fetchRobots: async (url) => {
        fetched.push(url)
        const answer = answers[new URL(url).host]
        if (answer === undefined)
          throw new SafeFetchError('timeout', url, 'no answer')
        const bytes = new TextEncoder().encode(answer.body ?? '')
        const headers: Record<string, string> = {}
        if (answer.contentType !== undefined)
          headers['content-type'] = answer.contentType
        return {
          url,
          status: answer.status,
          headers,
          contentType: answer.contentType,
          bytes,
          byteLength: bytes.byteLength,
          text: () => answer.body ?? '',
        }
      },
    })
    return { gate, fetched }
  }

  const hnFile = 'User-agent: *\nAllow: /*.json$\nDisallow: /\n'

  it('asks the host itself, over its own scheme, at /robots.txt', async () => {
    const clock = { at: AT }
    const { gate, fetched } = gateOver({ 'example.com': { status: 404 } }, clock)
    await gate.isAllowed('https://example.com/feed.xml')
    expect(fetched).toEqual(['https://example.com/robots.txt'])
  })

  it('allows the HN Firebase path that a prefix matcher would refuse', async () => {
    const clock = { at: AT }
    const { gate } = gateOver(
      { 'hacker-news.firebaseio.com': { status: 200, body: hnFile, contentType: 'text/plain' } },
      clock,
    )
    expect(await gate.isAllowed('https://hacker-news.firebaseio.com/v0/topstories.json')).toBe(true)
    expect(await gate.isAllowed('https://hacker-news.firebaseio.com/v0/topstories')).toBe(false)
  })

  it('denies a host whose file cannot be read', async () => {
    const clock = { at: AT }
    const { gate } = gateOver({ 'arstechnica.com': { status: 202 } }, clock)
    expect(await gate.isAllowed('https://arstechnica.com/feed')).toBe(false)
  })

  it('denies a host that never answered at all', async () => {
    const clock = { at: AT }
    const { gate } = gateOver({}, clock)
    expect(await gate.isAllowed('https://silent.example.com/feed')).toBe(false)
  })

  it('reuses a live entry rather than re-probing per fetch', async () => {
    const clock = { at: AT }
    const { gate, fetched } = gateOver({ 'example.com': { status: 404 } }, clock)
    await gate.isAllowed('https://example.com/a')
    await gate.isAllowed('https://example.com/b')
    expect(fetched).toHaveLength(1)
  })

  it('re-fetches an entry past its expiry rather than trusting it', async () => {
    const clock = { at: AT }
    const answers: Record<string, Answer> = { 'example.com': { status: 404 } }
    const { gate, fetched } = gateOver(answers, clock)
    expect(await gate.isAllowed('https://example.com/a')).toBe(true)

    // A blanket Disallow lands, as it did on four ordinary tech hosts inside
    // three years. A boolean that persisted would never see it.
    answers['example.com'] = { status: 200, body: 'User-agent: *\nDisallow: /\n', contentType: 'text/plain' }
    clock.at = new Date(AT.getTime() + ROBOTS_TTL_MS + 1)

    expect(await gate.isAllowed('https://example.com/a')).toBe(false)
    expect(fetched).toHaveLength(2)
  })

  it('keeps one host\'s verdict off another, in both directions', async () => {
    const clock = { at: AT }
    const { gate } = gateOver({
      'feeds.arstechnica.com': { status: 404, body: '<h1>404</h1>', contentType: 'text/html' },
      'arstechnica.com': { status: 202 },
    }, clock)

    // The unverifiable apex does not condemn the subdomain that answered...
    expect(await gate.isAllowed('https://feeds.arstechnica.com/arstechnica/index')).toBe(true)
    // ...and the subdomain that answered does not clear the apex.
    expect(await gate.isAllowed('https://arstechnica.com/feed')).toBe(false)
  })

  it('hands back the record, so a caller can log why it was refused', async () => {
    const clock = { at: AT }
    const { gate } = gateOver({ 'arstechnica.com': { status: 202 } }, clock)
    const decision = await gate.decide('https://arstechnica.com/feed')
    expect(decision.allowed).toBe(false)
    expect(decision.record).toMatchObject({ host: 'arstechnica.com', verdict: 'ambiguous', status: 202 })
  })

  it('refuses a URL it cannot even parse', async () => {
    const clock = { at: AT }
    const { gate, fetched } = gateOver({}, clock)
    expect(await gate.isAllowed('not a url')).toBe(false)
    expect(fetched).toEqual([])
  })
})
