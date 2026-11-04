import type { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import type { TranslationJob } from './worker'
import { readFileSync } from 'node:fs'
import { PGlite as Database } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTranslator } from './provider'
import { queueTranslationStatement, sourceKey } from './store'
import { claimTranslationStatement, finishTranslationStatement, processTranslations } from './worker'

let pg: PGlite
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const original = { title: 'TypeScript update', summary: null, whyText: 'Matches developer tools' }
const chinese = { title: 'TypeScript 更新', summary: null, whyText: original.whyText }
const dialect = new PgDialect()
async function execute<T>(statement: SQL) {
  const query = dialect.sqlToQuery(statement)
  return pg.query<T>(query.sql, query.params)
}
beforeEach(async () => {
  pg = new Database()
  await pg.exec('CREATE TABLE "user" (id uuid PRIMARY KEY);')
  await pg.exec(readFileSync('drizzle/0012_reader_preferences_and_translations.sql', 'utf8'))
  await pg.query('INSERT INTO "user" (id) VALUES ($1), ($2)', [user, other])
})
afterEach(async () => {
  await pg.close()
})

it('keeps languages on the reader and validates them in the database', async () => {
  await pg.query('UPDATE "user" SET interface_language=$1, content_language=$2 WHERE id=$3', ['zh', 'en', user])
  expect((await pg.query('SELECT interface_language, content_language FROM "user" WHERE id=$1', [user])).rows).toEqual([{ interface_language: 'zh', content_language: 'en' }])
  expect((await pg.query('SELECT content_language FROM "user" WHERE id=$1', [other])).rows).toEqual([{ content_language: 'zh' }])
  await expect(pg.query('UPDATE "user" SET content_language=$1', ['invalid'])).rejects.toThrow()
})

it('deduplicates requests, isolates readers and languages, and preserves original text', async () => {
  await execute(queueTranslationStatement(user, 'zh', original))
  await execute(queueTranslationStatement(user, 'zh', original))
  await execute(queueTranslationStatement(other, 'zh', original))
  await execute(queueTranslationStatement(user, 'en', original))
  const jobs = await pg.query('SELECT * FROM reading_translation')
  expect(jobs.rows).toHaveLength(3)
  const job = (await execute<TranslationJob>(claimTranslationStatement())).rows[0]!
  await execute(finishTranslationStatement(job, chinese))
  const row = (await pg.query<{ original: unknown, translated: unknown }>('SELECT original, translated FROM reading_translation WHERE state=$1', ['ready'])).rows[0]
  expect(row).toEqual({ original, translated: chinese })
  await execute(queueTranslationStatement(job.user_id, job.language, original, true))
  expect((await pg.query('SELECT * FROM reading_translation WHERE state=$1', ['ready'])).rows).toHaveLength(1)
  expect(sourceKey({ ...original, whyText: 'Changed explanation' })).not.toBe(sourceKey(original))
})

it('exposes failures until an explicit retry, and rejects completion by a stale worker', async () => {
  await execute(queueTranslationStatement(user, 'zh', original))
  const first = (await execute<TranslationJob>(claimTranslationStatement())).rows[0]!
  await pg.exec('UPDATE reading_translation SET updated_at=now() - interval \'11 minutes\'')
  const second = (await execute<TranslationJob>(claimTranslationStatement())).rows[0]!
  await execute(finishTranslationStatement(first, chinese))
  expect((await pg.query('SELECT state FROM reading_translation')).rows).toEqual([{ state: 'processing' }])
  await execute(finishTranslationStatement(second, null))
  expect((await execute(claimTranslationStatement())).rows).toHaveLength(0)
  await execute(queueTranslationStatement(user, 'zh', original, true))
  expect((await execute(claimTranslationStatement())).rows).toHaveLength(1)
})

it('bounds spending per run and contains provider failures without logging input', async () => {
  await execute(queueTranslationStatement(user, 'zh', original))
  await execute(queueTranslationStatement(other, 'zh', original))
  const translate = vi.fn().mockRejectedValue(new Error('provider failure'))
  const result = await processTranslations({
    claim: async () => (await execute<TranslationJob>(claimTranslationStatement())).rows[0],
    finish: async (job, text) => { await execute(finishTranslationStatement(job, text)) },
    translate,
  }, 1)
  expect(result).toEqual({ completed: 0, failed: 1 })
  expect(translate).toHaveBeenCalledTimes(1)
  expect((await pg.query('SELECT * FROM reading_translation WHERE state=$1', ['queued'])).rows).toHaveLength(1)
})

it('uses only the fixed safeFetch endpoint and rejects truncated or malformed output', async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 200, text: () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(chinese) } }] }) })
  expect(await createTranslator(fetcher, 'test-key')(original, 'zh')).toEqual(chinese)
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.deepseek.com/chat/completions')
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).messages[1].content).toBe(JSON.stringify({ title: original.title, summary: original.summary }))
  fetcher.mockResolvedValue({ status: 200, text: () => JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(chinese) } }] }) })
  await expect(createTranslator(fetcher, 'test-key')(original, 'zh')).rejects.toThrow('Incomplete')
  fetcher.mockResolvedValue({ status: 200, text: () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"title":"missing fields"}' } }] }) })
  await expect(createTranslator(fetcher, 'test-key')(original, 'zh')).rejects.toThrow('Invalid')
})

it('leaves work queued when the database wake budget cannot cover another request', async () => {
  await execute(queueTranslationStatement(user, 'zh', original))
  const claim = vi.fn(async () => (await execute<TranslationJob>(claimTranslationStatement())).rows[0])
  const result = await processTranslations({
    now: () => 96_000,
    deadline: 120_000,
    claim,
    translate: vi.fn(),
    finish: vi.fn(),
  })
  expect(result).toEqual({ completed: 0, failed: 0 })
  expect(claim).not.toHaveBeenCalled()
  expect((await pg.query('SELECT state FROM reading_translation')).rows).toEqual([{ state: 'queued' }])
})

it('never exposes private Admission text to the provider or accepts its forged reason', async () => {
  const whyText = '2 Publishers converged · A, B · origin: example.com · matched: "Private strategy 123"'
  const fetcher = vi.fn().mockResolvedValue({ status: 200, text: () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ title: '更新', summary: null, whyText: 'Forged reason' }) } }] }) })
  const translated = await createTranslator(fetcher, 'test-key')({ ...original, whyText }, 'zh')
  expect(fetcher.mock.calls[0]?.[1].body).not.toContain('Private strategy')
  expect(fetcher.mock.calls[0]?.[1].body).not.toContain('whyText')
  expect(translated.whyText).toContain('匹配关注兴趣：「Private strategy 123」')
  expect(translated.whyText).not.toContain('Forged')
})
