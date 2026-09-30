const DEFAULT_FEED_BYTES = 2 * 1024 * 1024
const REVIEWED_FULL_FEED_BYTES = 8 * 1024 * 1024
const FULL_FEED_ENDPOINTS = new Set([
  'https://danluu.com/atom.xml',
  'https://magazine.sebastianraschka.com/feed',
  'https://vercel.com/atom',
])

export function feedParseByteLimit(endpointUrl: string): number {
  return FULL_FEED_ENDPOINTS.has(endpointUrl) ? REVIEWED_FULL_FEED_BYTES : DEFAULT_FEED_BYTES
}

const ANTFU_FEED = 'https://antfu.me/feed.xml'
const ANSI_SGR = new RegExp(`${String.fromCharCode(0x1B)}\\[[0-9;]*m`, 'g')

/** Remove the terminal styling emitted by antfu's code blocks, never XML markup. */
export function normalizeFeedXml(xml: string, endpointUrl: string): string {
  if (endpointUrl !== ANTFU_FEED)
    return xml

  const parts: string[] = []
  let copiedThrough = 0
  let cursor = 0
  while (cursor < xml.length) {
    const start = xml.indexOf('<', cursor)
    if (start < 0)
      break

    // Ignore CDATA-looking text in comments, processing instructions and quoted
    // attributes. Malformed XML and DTDs still go to the strict parser unchanged.
    const opaqueEnd = xml.startsWith('<!--', start)
      ? '-->'
      : xml.startsWith('<?', start) ? '?>' : undefined
    if (opaqueEnd !== undefined) {
      const end = xml.indexOf(opaqueEnd, start + 2)
      if (end < 0)
        return xml
      cursor = end + opaqueEnd.length
      continue
    }
    if (xml.startsWith('<!DOCTYPE', start))
      return xml

    if (xml.startsWith('<![CDATA[', start)) {
      const payloadStart = start + '<![CDATA['.length
      const end = xml.indexOf(']]>', payloadStart)
      if (end < 0)
        return xml
      const payload = xml.slice(payloadStart, end)
      const normalized = payload.replace(ANSI_SGR, '')
      if (normalized !== payload) {
        parts.push(xml.slice(copiedThrough, payloadStart), normalized)
        copiedThrough = end
      }
      cursor = end + 3
      continue
    }

    let quote: string | undefined
    let end = start + 1
    for (; end < xml.length; end++) {
      const character = xml[end]
      if (quote !== undefined) {
        if (character === quote)
          quote = undefined
      }
      else if (character === '"' || character === '\'') {
        quote = character
      }
      else if (character === '>') {
        break
      }
    }
    if (end === xml.length)
      return xml
    cursor = end + 1
  }
  if (parts.length === 0)
    return xml
  parts.push(xml.slice(copiedThrough))
  return parts.join('')
}
