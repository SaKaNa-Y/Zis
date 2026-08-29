import { blockedReason, numericHostReason, parseIp } from '@/lib/ip'

const TRACKING_SUBDOMAIN = /^(?:(?:www|www2|m|mobile|amp)\.)+/i

const BILIBILI_ALPHABET = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'
const BILIBILI_BASE = 58n
const BILIBILI_XOR = 23442827791579n
const BILIBILI_MAX_AID = 1n << 51n
const BILIBILI_AID_MASK = BILIBILI_MAX_AID - 1n
const BILIBILI_ENCODE_ORDER = [8, 7, 0, 5, 1, 3, 2, 4, 6] as const

const PARAM_DENYLIST = [
  /^utm_/i,
  /^ga_/i,
  /^_hs(?:enc|mi|_)/i,
  /^at_(?:medium|campaign|custom\d)$/i,
  /^guce_referrer/i,
  ...[
    'ref',
    'ref_src',
    'ref_url',
    'referrer',
    'referer',
    'fbclid',
    'gclid',
    'gclsrc',
    'dclid',
    'msclkid',
    'yclid',
    'twclid',
    'igshid',
    'igsh',
    'mibextid',
    'mc_cid',
    'mc_eid',
    'mkt_tok',
    '__s',
    'vero_id',
    'vero_conv',
    'sc_channel',
    'sc_campaign',
    'sc_publisher',
    'sc_content',
    'sc_geo',
    'hss_channel',
    'trk',
    'trkcampaign',
    'guccounter',
    'cmp',
    'cmpid',
    'campaign_id',
    'spm',
    'scm',
    'smid',
    'smtyp',
    'partner',
    'source_impression_id',
    'featured_on',
    'triedredirect',
    'giftcopy',
  ].map(name => new RegExp(`^${name}$`, 'i')),
]

interface ParamPolicy {
  allow?: readonly string[]
  allowByPath?: Readonly<Record<string, readonly string[]>>
}

const HOST_PARAM_POLICY: Readonly<Record<string, ParamPolicy>> = {
  'youtube.com': {
    allow: [],
    allowByPath: {
      '/playlist': ['list'],
      '/watch': ['v'],
    },
  },
  'news.ycombinator.com': { allow: ['id'] },
  'lobste.rs': { allow: [] },
  'medium.com': { allow: [] },
  'open.substack.com': { allow: [] },
  'reddit.com': { allow: [] },
  'twitter.com': { allow: [] },
  'x.com': { allow: [] },
}

/** Exact host-registry key shared by ingestion assertions and Citation filters. */
export function publisherHostKey(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '')
}

function isBlockedLiteralHost(hostname: string): boolean {
  const address = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
  const lower = address.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.internal'))
    return true
  if (numericHostReason(address) !== undefined)
    return true
  return parseIp(address) !== undefined && blockedReason(address) !== undefined
}

function normalizePath(url: URL): void {
  let path = url.pathname.replace(/\/{2,}/g, '/')
  let previous: string
  do {
    previous = path
    path = path.replace(/\/index\.(?:html?|php)$/i, '/')
    path = path.replace(/\/amp\/?$/i, '') || '/'
    path = path.replace(/^\/amp\//i, '/') || '/'
    if (path.length > 1)
      path = path.replace(/\/+$/, '')
  } while (path !== previous)
  url.pathname = path || '/'
}

function normalizeParams(url: URL): boolean {
  const policy = HOST_PARAM_POLICY[url.hostname]
  const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
  const isBilibiliVideo = url.hostname === 'bilibili.com' && /^\/video\/[^/]+$/.test(path)
  const pathAllow = policy?.allowByPath?.[path]
  const allow = isBilibiliVideo ? [] : pathAllow ?? policy?.allow
  const kept: Array<[string, string]> = []

  for (const [name, value] of url.searchParams) {
    const lower = name.toLowerCase()
    if (allow !== undefined) {
      if (allow.includes(lower))
        kept.push([name, value])
      continue
    }
    if (lower === 'amp' && value === '1')
      continue
    if (PARAM_DENYLIST.some(pattern => pattern.test(name)))
      continue
    kept.push([name, value])
  }

  if (pathAllow?.some(identifier => !kept.some(([name, value]) =>
    name.toLowerCase() === identifier && value !== '',
  ))) {
    return false
  }

  const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
  kept.sort(([leftName, leftValue], [rightName, rightValue]) => {
    const byName = compareCodeUnits(leftName, rightName)
    return byName === 0 ? compareCodeUnits(leftValue, rightValue) : byName
  })
  url.search = ''
  for (const [name, value] of kept)
    url.searchParams.append(name, value)
  return true
}

function encodeBilibiliAid(aid: bigint): string | undefined {
  if (aid <= 0n || aid >= BILIBILI_MAX_AID)
    return undefined

  let value = (BILIBILI_MAX_AID | aid) ^ BILIBILI_XOR
  const payload = Array.from({ length: BILIBILI_ENCODE_ORDER.length }).fill('') as string[]
  for (let digit = 0; digit < BILIBILI_ENCODE_ORDER.length; digit++) {
    const position = BILIBILI_ENCODE_ORDER[digit]!
    payload[position] = BILIBILI_ALPHABET.charAt(Number(value % BILIBILI_BASE))
    value /= BILIBILI_BASE
  }
  return `BV1${payload.join('')}`
}

function decodeBilibiliVideoId(videoId: string): bigint | undefined {
  if (!/^BV1.{9}$/.test(videoId))
    return undefined
  const payload = videoId.slice(3)
  let value = 0n
  for (let digit = BILIBILI_ENCODE_ORDER.length - 1; digit >= 0; digit--) {
    const character = payload.charAt(BILIBILI_ENCODE_ORDER[digit]!)
    const index = BILIBILI_ALPHABET.indexOf(character)
    if (index === -1)
      return undefined
    value = value * BILIBILI_BASE + BigInt(index)
  }
  if (value < BILIBILI_MAX_AID || value >= BILIBILI_MAX_AID * 2n)
    return undefined
  const aid = (value & BILIBILI_AID_MASK) ^ BILIBILI_XOR
  return encodeBilibiliAid(aid) === videoId ? aid : undefined
}

function canonicalBilibiliVideoId(videoId: string): string {
  const legacy = videoId.match(/^av(\d+)$/i)
  if (legacy?.[1] !== undefined) {
    const digits = legacy[1].replace(/^0+(?=\d)/, '')
    if (digits.length <= 16)
      return encodeBilibiliAid(BigInt(digits)) ?? videoId
  }
  const aid = decodeBilibiliVideoId(videoId)
  return aid === undefined ? videoId : encodeBilibiliAid(aid) ?? videoId
}

function applyShapeAliases(url: URL): URL {
  if (url.hostname === 'youtu.be') {
    const videoId = url.pathname.split('/').filter(Boolean)[0]
    if (videoId !== undefined) {
      const canonical = new URL('https://youtube.com/watch')
      canonical.searchParams.set('v', videoId)
      canonical.hash = url.hash
      return canonical
    }
  }

  if (url.hostname === 'youtube.com') {
    const video = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/i)
    if (video?.[1] !== undefined) {
      const canonical = new URL('https://youtube.com/watch')
      canonical.searchParams.set('v', video[1])
      canonical.hash = url.hash
      return canonical
    }
  }

  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      parts[0] = parts[0]!.toLowerCase()
      const repository = parts[1]!.toLowerCase().replace(/(?:\.git)+$/i, '')
      parts[1] = repository === '' ? parts[1]!.toLowerCase() : repository
      if (parts[2]?.toLowerCase() === 'tree' && parts.length === 4)
        parts.length = 2
      if (parts[2]?.toLowerCase() === 'releases' && parts[3]?.toLowerCase() === 'latest')
        parts.length = 3
      url.pathname = `/${parts.join('/')}`
    }
  }

  if (url.hostname === 'bilibili.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'video')
      url.pathname = `/video/${canonicalBilibiliVideoId(parts[1]!)}`
  }

  return url
}

/** Pure, idempotent canonicalization layers L1-L3. */
export function canonicalizeLink(rawUrl: string | undefined, baseUrl?: string): string | undefined {
  if (rawUrl === undefined || rawUrl.trim() === '')
    return undefined

  let url: URL
  try {
    url = baseUrl === undefined
      ? new URL(rawUrl.trim())
      : new URL(rawUrl.trim(), baseUrl)
  }
  catch {
    return undefined
  }

  if (url.protocol === 'http:')
    url.protocol = 'https:'
  if (url.protocol !== 'https:')
    return undefined

  url.username = ''
  url.password = ''
  url.hostname = publisherHostKey(url.hostname)
  url.hostname = url.hostname.replace(TRACKING_SUBDOMAIN, '')
  if (url.hostname === '' || isBlockedLiteralHost(url.hostname))
    return undefined

  if (url.hash !== '' && !url.hash.startsWith('#!'))
    url.hash = ''

  normalizePath(url)
  if (!normalizeParams(url))
    return undefined
  return applyShapeAliases(url).href
}
