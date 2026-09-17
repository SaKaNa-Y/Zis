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

export function plainText(text: string): string {
  return collapse(decodeCharacterReferences(text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')))
}
