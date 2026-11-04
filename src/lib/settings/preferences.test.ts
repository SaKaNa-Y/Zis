import { describe, expect, it } from 'vitest'
import { DEFAULT_READING, isInterfaceLanguage, isLanguage, isReadingStyle, parseReadingStyle, resolveLanguage } from './preferences'

describe('reader preferences', () => {
  it('respects explicit language and browser priorities without accepting arbitrary locales', () => {
    expect(resolveLanguage('en', 'zh-CN,en;q=0.8')).toBe('en')
    expect(resolveLanguage('system', 'fr,zh-TW;q=0.9,en;q=0.7')).toBe('zh')
    expect(resolveLanguage('system', 'zh;q=0,en;q=1')).toBe('en')
    expect(resolveLanguage('system', '')).toBe('en')
    expect(isInterfaceLanguage('system')).toBe(true)
    expect(isLanguage('system')).toBe(false)
    expect(isInterfaceLanguage('fr')).toBe(false)
  })
  it('restores browser style safely without allowing arbitrary CSS from cookies', () => {
    expect(parseReadingStyle('{bad')).toEqual(DEFAULT_READING)
    expect(parseReadingStyle(JSON.stringify({ size: '100', font: 'url(evil)' }))).toEqual(DEFAULT_READING)
    expect(parseReadingStyle(JSON.stringify({ size: 'large', font: 'serif' }))).toEqual({ size: 'large', font: 'serif' })
    expect(isReadingStyle(null)).toBe(false)
    expect(isReadingStyle({ size: 'extra-large', font: 'sans' })).toBe(true)
  })
})
