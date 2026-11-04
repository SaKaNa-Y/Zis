import type { Language } from '@/lib/settings/preferences'

export interface ReadingText { title: string, summary: string | null, whyText: string }
export type TranslationResult = { state: 'queued' | 'processing' | 'failed' } | { state: 'ready', text: ReadingText }
export type TranslationAction = (entryId: string, language: Language, retry?: boolean) => Promise<TranslationResult>
export function isReadingText(value: unknown): value is ReadingText {
  if (!value || typeof value !== 'object')
    return false
  const text = value as Record<string, unknown>
  return typeof text.title === 'string' && text.title.trim().length > 0 && text.title.length <= 16000
    && (text.summary === null || (typeof text.summary === 'string' && text.summary.trim().length > 0 && text.summary.length <= 16000))
    && typeof text.whyText === 'string' && text.whyText.trim().length > 0 && text.whyText.length <= 16000
}
