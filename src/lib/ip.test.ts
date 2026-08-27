import { describe, expect, it } from 'vitest'
import { blockedReason, numericHostReason, parseIp } from './ip'

/**
 * The address classifier, which is the half of `safeFetch` that has no I/O in
 * it. `security-model.md` §7 lists the bypasses it has to close; the ones that
 * are pure address arithmetic are tested here, and the ones that need a
 * resolver or a socket are in `safe-fetch.test.ts`.
 */

describe('parsing an ipv4 literal', () => {
  it('accepts a dotted quad', () => {
    expect(parseIp('93.184.216.34')?.family).toBe(4)
  })

  it.each([
    ['a leading zero, which inet_aton reads as octal', '010.0.0.1'],
    ['a short form, which inet_aton reads as 127.0.0.1', '127.1'],
    ['a bare integer', '2130706433'],
    ['a hex integer', '0x7f000001'],
    ['five parts', '1.2.3.4.5'],
    ['an octet out of range', '1.2.3.256'],
  ])('refuses %s', (_why, text) => {
    expect(parseIp(text)).toBeUndefined()
  })
})

describe('blocked ipv4 space', () => {
  it.each([
    ['cloud metadata — the range that leaks credentials', '169.254.169.254'],
    ['this-network', '0.0.0.0'],
    ['loopback', '127.0.0.1'],
    ['private 10/8', '10.0.0.7'],
    ['private 172.16/12', '172.20.10.1'],
    ['private 192.168/16', '192.168.1.1'],
    ['carrier NAT', '100.64.0.1'],
    ['multicast', '224.0.0.1'],
    ['reserved', '240.0.0.1'],
    ['broadcast', '255.255.255.255'],
  ])('rejects %s', (_why, address) => {
    expect(blockedReason(address)).toBeDefined()
  })

  it('allows an ordinary public address', () => {
    expect(blockedReason('93.184.216.34')).toBeUndefined()
  })
})

describe('blocked ipv6 space', () => {
  it.each([
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['unique local fc00::/7', 'fc00::1'],
    ['unique local fd00::/8', 'fd12:3456::1'],
    ['link local fe80::/10', 'fe80::1'],
    ['multicast', 'ff02::1'],
    ['documentation', '2001:db8::1'],
  ])('rejects %s', (_why, address) => {
    expect(blockedReason(address)).toBeDefined()
  })

  it('names the range it matched, because the reason is what an operator reads', () => {
    // `::1` and `::` are twelve leading zero bytes, which is also the shape of
    // the v4-compatible prefix. Reported as `0.0.0.1` they would be refused for
    // the wrong reason — blocked either way, and misleading in the log.
    expect(blockedReason('::1')).toMatch(/loopback/)
    expect(blockedReason('::')).toMatch(/unspecified/)
    expect(blockedReason('169.254.169.254')).toMatch(/metadata/)
    expect(blockedReason('::ffff:169.254.169.254')).toMatch(/IPv4-embedded.*metadata/)
  })

  it('allows a public address rather than blocking v6 wholesale', () => {
    // Refusing AAAA records entirely is simpler and wrong (§1.1): it silently
    // drops hosts as the web moves to v6.
    expect(blockedReason('2606:2800:220:1:248:1893:25c8:1946')).toBeUndefined()
  })
})

describe('ipv4-mapped and translated addresses are judged by the embedded v4', () => {
  it('rejects ::ffff:169.254.169.254 — the standard bypass', () => {
    expect(blockedReason('::ffff:169.254.169.254')).toBeDefined()
  })

  it('rejects the same address spelled in hex, which no dotted-quad check sees', () => {
    expect(blockedReason('::ffff:a9fe:a9fe')).toBeDefined()
  })

  it('rejects a mapped loopback', () => {
    expect(blockedReason('::ffff:127.0.0.1')).toBeDefined()
  })

  it('rejects a NAT64-translated metadata address', () => {
    expect(blockedReason('64:ff9b::a9fe:a9fe')).toBeDefined()
  })

  it('rejects a deprecated v4-compatible loopback', () => {
    expect(blockedReason('::127.0.0.1')).toBeDefined()
  })

  it('allows a mapped public address', () => {
    expect(blockedReason('::ffff:93.184.216.34')).toBeUndefined()
  })
})

describe('an unparseable address is not a public one', () => {
  it.each(['', 'not-an-address', '::ffff:', '1::2::3'])('rejects %s', (text) => {
    expect(blockedReason(text)).toBeDefined()
  })
})

describe('numeric host forms never reach the resolver', () => {
  it.each([
    ['a bare integer', '2130706433'],
    ['an octal-encoded octet', '010.0.0.1'],
    ['a two-part short form', '127.1'],
    ['a hex integer', '0x7f000001'],
  ])('refuses %s', (_why, host) => {
    expect(numericHostReason(host)).toBeDefined()
  })

  it('leaves an ordinary hostname alone', () => {
    expect(numericHostReason('hacker-news.firebaseio.com')).toBeUndefined()
  })

  it('leaves a dotted quad alone — that one is the classifier\'s job, not this one', () => {
    expect(numericHostReason('93.184.216.34')).toBeUndefined()
  })
})
