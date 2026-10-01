import { describe, expect, it } from 'vitest'
import { plainText } from './plain-text'

describe('untrusted markup extraction', () => {
  it('does not backtrack over repeated unclosed tag openers', () => {
    const input = '<'.repeat(100_000)
    expect(plainText(input) === input).toBe(true)
  })

  it('does not backtrack over repeated unclosed comment openers', () => {
    expect(plainText('<!--'.repeat(25_000)).length).toBe(100_000)
  })

  it.each([
    ['before<!-- hidden -->after', 'before after'],
    ['before<!-- hidden\nmore -->after', 'before after'],
    ['<b>bold</b> &amp; &#65;', 'bold & A'],
    ['before<<broken>after', 'before after'],
    ['before<unclosed', 'before<unclosed'],
    ['before<!-- unclosed', 'before<!-- unclosed'],
  ])('preserves text extraction for %s', (input, expected) => {
    expect(plainText(input)).toBe(expected)
  })
})
