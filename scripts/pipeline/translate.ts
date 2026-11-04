import type { TranslationJob } from '@/lib/translations/worker'
import process from 'node:process'
import { sql } from 'drizzle-orm'
import { briefStatement } from '@/lib/briefs/projection'
import { db } from '@/lib/db'
import { deepseekApiKey } from '@/lib/env'
import { safeFetch } from '@/lib/safe-fetch'
import { isLanguage } from '@/lib/settings/preferences'
import { isReadingText } from '@/lib/translations/model'
import { createTranslator } from '@/lib/translations/provider'
import { queueTranslation } from '@/lib/translations/store'
import { claimTranslationStatement, finishTranslationStatement, processTranslations } from '@/lib/translations/worker'

async function main() {
  const translate = createTranslator(safeFetch, deepseekApiKey())
  const deadline = performance.now() + 120_000
  const database = db()
  // Prewarm today's Brief. Older entries are queued when the reader opens them.
  const readers = await database.execute<{ id: string, content_language: string }>(sql`SELECT id, content_language FROM "user"`)
  for (const reader of readers.rows) {
    if (performance.now() + 25_000 > deadline)
      break
    if (!isLanguage(reader.content_language))
      continue
    const entries = await database.execute<{ title: string, summary: string | null, why_text: string }>(briefStatement(reader.id, sql`(now() AT TIME ZONE reader_user.timezone)::date`))
    for (const entry of entries.rows) {
      if (performance.now() + 25_000 > deadline)
        break
      const original = { title: entry.title, summary: entry.summary, whyText: entry.why_text }
      if (isReadingText(original))
        await queueTranslation(reader.id, reader.content_language, original)
    }
  }
  const result = await processTranslations({
    deadline,
    claim: async () => (await database.execute<TranslationJob & Record<string, unknown>>(claimTranslationStatement())).rows[0],
    translate,
    finish: async (job, text) => { await database.execute(finishTranslationStatement(job, text)) },
  })
  process.stdout.write(`Translations: ${result.completed} completed, ${result.failed} failed.\n`)
  if (result.failed)
    process.exitCode = 1
}
main().catch(() => {
  process.stderr.write('Translation task failed. Check database access and the Actions-only DeepSeek key.\n')
  process.exitCode = 1
})
