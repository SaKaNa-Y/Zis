export type Language = 'en' | 'zh'
export type InterfaceLanguage = Language | 'system'
export type ReadingSize = 'small' | 'standard' | 'large' | 'extra-large'
export type ReadingFont = 'default' | 'sans' | 'serif'
export interface ReadingStyle { size: ReadingSize, font: ReadingFont }
export const READING_COOKIE = '__Host-zis_reading'
export const DEFAULT_READING: ReadingStyle = { size: 'standard', font: 'default' }
export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh'
}
export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === 'system' || isLanguage(value)
}
export function isReadingStyle(value: unknown): value is ReadingStyle {
  if (!value || typeof value !== 'object')
    return false
  const style = value as Record<string, unknown>
  return typeof style.size === 'string' && ['small', 'standard', 'large', 'extra-large'].includes(style.size)
    && typeof style.font === 'string' && ['default', 'sans', 'serif'].includes(style.font)
}
export function parseReadingStyle(value: string | undefined): ReadingStyle {
  try {
    const parsed: unknown = JSON.parse(value ?? '')
    return isReadingStyle(parsed) ? parsed : DEFAULT_READING
  }
  catch { return DEFAULT_READING }
}
export function resolveLanguage(preference: InterfaceLanguage, acceptLanguage: string): Language {
  if (preference !== 'system')
    return preference
  const languages = acceptLanguage.split(',').map((part) => {
    const [tag, weight] = part.trim().split(';')
    return { tag: (tag ?? '').toLowerCase(), weight: weight?.startsWith('q=') ? Number(weight.slice(2)) : 1 }
  }).filter(part => part.weight > 0).sort((a, b) => b.weight - a.weight)
  for (const { tag } of languages) {
    if (/^zh(?:-|$)/.test(tag))
      return 'zh'
    if (/^en(?:-|$)/.test(tag))
      return 'en'
  }
  return 'en'
}
