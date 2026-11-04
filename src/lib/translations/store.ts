import type { ReadingText, TranslationResult } from './model'
import type { Language } from '@/lib/settings/preferences'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { isReadingText } from './model'

export function sourceKey(original: ReadingText): string {
  return createHash('sha256').update(JSON.stringify([original.title, original.summary, original.whyText])).digest('hex')
}
export function queueTranslationStatement(userId: string, language: Language, original: ReadingText, retry = false) {
  const key = sourceKey(original)
  return sql`
    INSERT INTO reading_translation (user_id, source_key, language, original)
    VALUES (${userId}::uuid, ${key}, ${language}, ${JSON.stringify(original)}::jsonb)
    ON CONFLICT (user_id, source_key, language) DO UPDATE SET
      state = CASE WHEN ${retry} AND reading_translation.state = 'failed' THEN 'queued' ELSE reading_translation.state END,
      updated_at = CASE WHEN ${retry} AND reading_translation.state = 'failed' THEN now() ELSE reading_translation.updated_at END
    RETURNING state, translated
  `
}
export async function queueTranslation(userId: string, language: Language, original: ReadingText, retry = false): Promise<TranslationResult> {
  const { rows } = await db().execute<{ state: string, translated: unknown }>(queueTranslationStatement(userId, language, original, retry))
  const row = rows[0]
  if (row?.state === 'ready' && isReadingText(row.translated))
    return { state: 'ready', text: row.translated }
  if (row?.state === 'queued' || row?.state === 'processing')
    return { state: row.state }
  return { state: 'failed' }
}
