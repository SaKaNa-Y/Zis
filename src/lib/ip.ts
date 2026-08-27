/**
 * Address classification for `safeFetch`.
 *
 * `security-model.md` §1.1 requires that every address a hostname resolves to is
 * validated — not the first — and that IPv6 is *validated* rather than blocked
 * wholesale, because refusing AAAA records silently drops hosts as the web moves
 * to v6. Both of those are decisions about a single address at a time, so they
 * live here with no I/O: the module that opens sockets is `safe-fetch.ts`, and
 * keeping the arithmetic out of it means the file the egress lint rule exempts
 * stays small.
 *
 * Everything is decided on **bytes**, never on text. `::ffff:169.254.169.254`
 * and `::ffff:a9fe:a9fe` are the same address, and a check that matches strings
 * catches the first and ships the second.
 */

export type IpFamily = 4 | 6

export interface ParsedIp {
  family: IpFamily
  /** 4 bytes for v4, 16 for v6. */
  bytes: Uint8Array
}

/**
 * A strict dotted quad: four decimal octets, no leading zeros, nothing else.
 *
 * Strictness is the point. `inet_aton` accepts `010.0.0.1` as octal and `127.1`
 * as a two-part form, so a lenient parser and the OS resolver disagree about
 * which address a string means — and the disagreement is always in the
 * attacker's favour (§7, test 6).
 */
export function parseIpv4(text: string): Uint8Array | undefined {
  const parts = text.split('.')
  if (parts.length !== 4)
    return undefined

  const bytes = new Uint8Array(4)
  for (const [index, part] of parts.entries()) {
    if (!/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith('0')))
      return undefined
    const value = Number(part)
    if (value > 255)
      return undefined
    bytes[index] = value
  }
  return bytes
}

/** An IPv6 literal, including the `::ffff:1.2.3.4` mixed form, as 16 bytes. */
export function parseIpv6(text: string): Uint8Array | undefined {
  if (text.includes('%'))
    // A zone index (`fe80::1%eth0`) is link-local by construction, and this
    // parser refusing it means `blockedReason` rejects it as unparseable.
    return undefined

  const halves = text.split('::')
  if (halves.length > 2)
    return undefined

  const [headText = '', tailText = ''] = halves
  const compressed = halves.length === 2

  const head = headText === '' ? [] : headText.split(':')
  const tail = tailText === '' ? [] : tailText.split(':')

  // The trailing group may be a dotted quad: `::ffff:169.254.169.254`.
  const groups: string[] = [...head, ...tail]
  const last = groups.at(-1)
  let embedded: Uint8Array | undefined
  if (last !== undefined && last.includes('.')) {
    embedded = parseIpv4(last)
    if (embedded === undefined)
      return undefined
    groups.pop()
    if (tail.length > 0)
      tail.pop()
    else
      head.pop()
  }

  const groupCount = groups.length + (embedded === undefined ? 0 : 2)
  if (compressed ? groupCount > 7 : groupCount !== 8)
    return undefined

  const bytes = new Uint8Array(16)
  let offset = 0

  function writeGroup(group: string): boolean {
    if (!/^[0-9a-f]{1,4}$/i.test(group))
      return false
    const value = Number.parseInt(group, 16)
    bytes[offset++] = value >> 8
    bytes[offset++] = value & 0xFF
    return true
  }

  for (const group of head) {
    if (!writeGroup(group))
      return undefined
  }

  const tailLength = tail.length * 2 + (embedded === undefined ? 0 : 4)
  offset = 16 - tailLength
  for (const group of tail) {
    if (!writeGroup(group))
      return undefined
  }
  if (embedded !== undefined)
    bytes.set(embedded, 12)

  return bytes
}

/** Either family, or `undefined` when the text is not an address at all. */
export function parseIp(text: string): ParsedIp | undefined {
  const v4 = parseIpv4(text)
  if (v4 !== undefined)
    return { family: 4, bytes: v4 }
  const v6 = parseIpv6(text)
  if (v6 !== undefined)
    return { family: 6, bytes: v6 }
  return undefined
}

interface Range {
  /** First octet(s) of the prefix. */
  prefix: number[]
  bits: number
  why: string
}

/** §1.1's IPv4 list, plus the reserved space it gathers up as "plus". */
const BLOCKED_V4: Range[] = [
  { prefix: [0], bits: 8, why: 'this-network 0.0.0.0/8' },
  { prefix: [10], bits: 8, why: 'private 10.0.0.0/8' },
  { prefix: [100, 64], bits: 10, why: 'carrier NAT 100.64.0.0/10' },
  { prefix: [127], bits: 8, why: 'loopback 127.0.0.0/8' },
  { prefix: [169, 254], bits: 16, why: 'cloud metadata 169.254.0.0/16' },
  { prefix: [172, 16], bits: 12, why: 'private 172.16.0.0/12' },
  { prefix: [192, 0, 0], bits: 24, why: 'IETF protocol assignments 192.0.0.0/24' },
  { prefix: [192, 0, 2], bits: 24, why: 'documentation 192.0.2.0/24' },
  { prefix: [192, 88, 99], bits: 24, why: '6to4 relay anycast 192.88.99.0/24' },
  { prefix: [192, 168], bits: 16, why: 'private 192.168.0.0/16' },
  { prefix: [198, 18], bits: 15, why: 'benchmarking 198.18.0.0/15' },
  { prefix: [198, 51, 100], bits: 24, why: 'documentation 198.51.100.0/24' },
  { prefix: [203, 0, 113], bits: 24, why: 'documentation 203.0.113.0/24' },
  { prefix: [224], bits: 4, why: 'multicast 224.0.0.0/4' },
  // `240.0.0.0/4` covers the broadcast address too, so there is no separate
  // `255.255.255.255` row — a row that can never be reached is a claim about
  // coverage that no test can check.
  { prefix: [240], bits: 4, why: 'reserved 240.0.0.0/4 (includes broadcast)' },
]

/**
 * §1.1's IPv6 list. The mapped, compatible and NAT64 prefixes are deliberately
 * absent: they are handled by `embeddedIpv4`, which re-judges them by their
 * embedded v4 value rather than as opaque v6.
 */
const BLOCKED_V6: Range[] = [
  { prefix: [0x01], bits: 8, why: 'reserved 100::/8' },
  { prefix: [0xFC], bits: 7, why: 'unique local fc00::/7' },
  { prefix: [0xFE, 0x80], bits: 10, why: 'link local fe80::/10' },
  { prefix: [0xFF], bits: 8, why: 'multicast ff00::/8' },
  { prefix: [0x20, 0x01, 0x0D, 0xB8], bits: 32, why: 'documentation 2001:db8::/32' },
]

function withinRange(bytes: Uint8Array, range: Range): boolean {
  for (let bit = 0; bit < range.bits; bit += 8) {
    const index = bit / 8
    const mask = 0xFF << Math.max(0, 8 - (range.bits - bit)) & 0xFF
    if (((bytes[index] ?? 0) & mask) !== ((range.prefix[index] ?? 0) & mask))
      return false
  }
  return true
}

function isAllZero(bytes: Uint8Array, until: number): boolean {
  for (let index = 0; index < until; index++) {
    if (bytes[index] !== 0)
      return false
  }
  return true
}

/**
 * The v4 address a v6 address is really carrying, if any.
 *
 * Three prefixes embed one: `::ffff:0:0/96` (mapped — the standard bypass),
 * `::/96` (the deprecated v4-compatible form), and `64:ff9b::/96` (NAT64). All
 * three are evaluated by the embedded value, "not as opaque v6" (§1.1).
 */
function embeddedIpv4(bytes: Uint8Array): Uint8Array | undefined {
  const tail = bytes.slice(12)

  if (isAllZero(bytes, 10) && bytes[10] === 0xFF && bytes[11] === 0xFF)
    return tail
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xFF && bytes[3] === 0x9B && isAllZero(bytes.slice(4), 8))
    return tail
  // The v4-compatible form, and the reason for the first-octet test: `::1` and
  // `::` are *also* twelve leading zero bytes, and reading them as `0.0.0.1` and
  // `0.0.0.0` would report loopback as this-network — blocked either way, but by
  // a reason that names the wrong range, which is what an operator reads.
  if (isAllZero(bytes, 12) && (tail[0] ?? 0) !== 0)
    return tail

  return undefined
}

/**
 * Why this address must not be connected to, or `undefined` if it may be.
 *
 * Unparseable text is *blocked*, not passed through. "I could not tell what this
 * address is" and "this address is public" are opposite facts, and only one of
 * them is safe to act on.
 */
export function blockedReason(address: string): string | undefined {
  const parsed = parseIp(address)
  if (parsed === undefined)
    return `not a parseable IP address: ${JSON.stringify(address)}`

  return parsed.family === 4 ? blockedV4Reason(parsed.bytes) : blockedV6Reason(parsed.bytes)
}

function blockedV4Reason(bytes: Uint8Array): string | undefined {
  for (const range of BLOCKED_V4) {
    if (withinRange(bytes, range))
      return range.why
  }
  return undefined
}

function blockedV6Reason(bytes: Uint8Array): string | undefined {
  // An embedded v4 is judged as the v4 it is, on its bytes — no round trip
  // through text, which is the whole discipline this module states up front.
  const embedded = embeddedIpv4(bytes)
  if (embedded !== undefined) {
    const reason = blockedV4Reason(embedded)
    return reason === undefined ? undefined : `IPv4-embedded ${reason}`
  }

  if (isAllZero(bytes, 15) && bytes[15] === 0)
    return 'unspecified ::'
  if (isAllZero(bytes, 15) && bytes[15] === 1)
    return 'loopback ::1'
  for (const range of BLOCKED_V6) {
    if (withinRange(bytes, range))
      return range.why
  }
  return undefined
}

/**
 * Why a hostname must not be handed to the resolver, or `undefined` if it may.
 *
 * `http://2130706433/` is §7 test 6: the URL parser keeps it as a hostname, the
 * OS resolver reads it as `127.0.0.1`, and a guard that only inspects *resolved*
 * addresses is relying on the resolver to agree with it. These forms are refused
 * before a lookup happens, so agreement is never needed. A real dotted quad
 * passes here and is judged by `blockedReason` instead.
 */
export function numericHostReason(host: string): string | undefined {
  if (parseIpv4(host) !== undefined || parseIpv6(host) !== undefined)
    return undefined

  if (/^0x[0-9a-f]+$/i.test(host))
    return `hex-encoded address: ${host}`

  if (/^[\d.]+$/.test(host))
    // Digits and dots that are not a strict dotted quad: a bare integer, an
    // octal octet, or a short form. All three are addresses in disguise.
    return `numeric host that is not a dotted quad: ${host}`

  return undefined
}
