import type { ReadingText } from './model'
import type { Language } from '@/lib/settings/preferences'
import { sql } from 'drizzle-orm'
import { isReadingText } from './model'

export function claimTranslationStatement() {
  return sql`
    WITH candidate AS (
      SELECT user_id, source_key, language FROM reading_translation
      WHERE state = 'queued' OR (state = 'processing' AND updated_at < now() - interval '10 minutes')
      ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE reading_translation t SET state = 'processing', updated_at = now(), attempts = attempts + 1
    FROM candidate c WHERE t.user_id = c.user_id AND t.source_key = c.source_key AND t.language = c.language
    RETURNING t.user_id, t.source_key, t.language, t.original, t.attempts
  `
}
export interface TranslationJob { user_id: string, source_key: string, language: Language, original: unknown, attempts: number }
export function finishTranslationStatement(job: TranslationJob, translated: ReadingText | null) {
  return sql`UPDATE reading_translation SET state = ${translated ? 'ready' : 'failed'}, translated = ${translated ? JSON.stringify(translated) : null}::jsonb, updated_at = now()
    WHERE user_id = ${job.user_id}::uuid AND source_key = ${job.source_key} AND language = ${job.language}
      AND state = 'processing' AND attempts = ${job.attempts}`
}
export async function processTranslations(deps: {
  claim: () => Promise<TranslationJob | undefined>
  now?: () => number
  deadline?: number
  translate: (text: ReadingText, language: Language) => Promise<ReadingText>
  finish: (job: TranslationJob, text: ReadingText | null) => Promise<void>
}, limit = 50) {
  const now = deps.now ?? (() => performance.now())
  const deadline = deps.deadline ?? now() + 120_000
  let completed = 0
  let failed = 0
  for (let index = 0; index < limit; index++) {
    // Reserve the safeFetch 20-second timeout plus time to persist its result.
    if (now() + 25_000 > deadline)
      break
    const job = await deps.claim()
    if (!job)
      break
    let translated: ReadingText | null = null
    try {
      if (!isReadingText(job.original))
        throw new Error('Invalid translation input')
      translated = await deps.translate(job.original, job.language)
    }
    catch { failed++ }
    await deps.finish(job, translated)
    if (translated)
      completed++
  }
  return { completed, failed }
}
