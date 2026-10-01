const MAX_EMBEDDING_TEXT_CHARS = 1200

export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function capEmbeddingText(text: string): string {
  if (text.length <= MAX_EMBEDDING_TEXT_CHARS)
    return text
  return Array.from(text).slice(0, MAX_EMBEDDING_TEXT_CHARS).join('')
}

export function decodeCharacterReferences(text: string): string {
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

/** Replace complete markup spans without retrying an unmatched opener at each byte. */
function stripDelimited(text: string, open: string, close: string): string {
  const parts: string[] = []
  let offset = 0
  for (;;) {
    const start = text.indexOf(open, offset)
    if (start === -1)
      break
    const end = text.indexOf(close, start + open.length)
    if (end === -1)
      break
    parts.push(text.slice(offset, start), ' ')
    offset = end + close.length
  }
  parts.push(text.slice(offset))
  return parts.join('')
}

export function plainText(text: string): string {
  const withoutComments = stripDelimited(text, '<!--', '-->')
  return collapse(decodeCharacterReferences(stripDelimited(withoutComments, '<', '>')))
}
