import type { Database, DatabaseStatement } from '@/lib/db'
import type { SafeFetch } from '@/lib/safe-fetch'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { NeonDbError } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runNeonIngestion } from './postgres'

const databases: PGlite[] = []
const wakeAt = new Date('2026-09-30T06:00:00Z')
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(databases.splice(0).map(database => database.close()))
})

async function fixture(failure: 'source' | 'final', afterCommit: boolean) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(wakeAt)
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  await pg.exec('TRUNCATE publisher, "user", http_cache, robots_cache, ingestion_checkpoint CASCADE')
  let injected = false
  const batches: DatabaseStatement[][] = []
  const database = Object.assign(drizzle(pg, { schema }), {
    commit: async (statements: DatabaseStatement[]) => {
      const affected = statements.some(statement => statement.sql.includes(failure === 'source' ? 'insert into "source_fetch_log"' : 'insert into "ingestion_checkpoint"'))
      const fail = affected && !injected
      if (affected)
        batches.push(statements)
      if (fail)
        injected = true
      const error = new NeonDbError('Error connecting to database: fetch failed')
      error.sourceError = new TypeError('fetch failed')
      if (fail && !afterCommit)
        throw error
      await pg.transaction(async (tx) => {
        for (const statement of statements)
          await tx.query(statement.sql, statement.params)
      })
      // This failure happens after a real PostgreSQL commit, not instead of it.
      if (fail && afterCommit)
        throw error
    },
  }) as unknown as Database
  for (let index = 1; index <= 2; index++) {
    const id = `00000000-0000-4000-8000-00000000000${index}`
    await database.insert(schema.publishers).values({ id, name: `Publisher ${index}`, slug: `publisher-${index}` })
    await database.insert(schema.publisherHosts).values({ publisherId: id, host: `publisher${index}.example` })
    await database.insert(schema.sources).values({ id, publisherId: id, endpointUrl: `https://publisher${index}.example/feed.xml`, transport: 'rss' })
  }
  const reader = '00000000-0000-4000-8000-000000000010'
  await database.insert(schema.users).values({ id: reader, passphraseHash: '$argon2id$v=19$m=65536,t=3,p=1$fixture', timezone: 'UTC', cutHour: 6 })
  await database.insert(schema.interests).values({ userId: reader, statement: 'Shared article' })
  await database.insert(schema.briefs).values({ userId: reader, localDate: '2026-09-29', cutAt: new Date('2026-09-29T06:00:00Z') })
  const sealed = await database.select().from(schema.briefs)
  const fetcher: SafeFetch = vi.fn(async (url) => {
    const robots = url.endsWith('/robots.txt')
    const body = robots ? 'User-agent: *\nAllow: /' : `<rss><channel><item><guid>one</guid><link>${new URL(url).origin}/one</link><title>Shared article</title><pubDate>Wed, 30 Sep 2026 05:00:00 GMT</pubDate><description>&lt;a href="https://shared.example/article"&gt;Shared article&lt;/a&gt;</description></item></channel></rss>`
    const bytes = new TextEncoder().encode(body)
    const contentType = robots ? 'text/plain' : 'application/rss+xml'
    return { url, status: 200, headers: { 'content-type': contentType }, contentType, bytes, byteLength: bytes.length, text: () => body }
  })
  const provider = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed: async (texts: readonly string[]) => texts.map(() => Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0)),
  }
  return { pg, database, batches, fetcher, provider, sealed }
}

it.each(['source', 'final'] as const)('recovers a %s commit before submission without recutting or refetching', async (operation) => {
  const test = await fixture(operation, false)
  const waitBeforeDatabaseRetry = vi.fn(async () => {})
  const onDatabaseRetry = vi.fn()
  await runNeonIngestion(wakeAt, test.database, test.fetcher, test.provider, undefined, undefined, { waitBeforeDatabaseRetry, onDatabaseRetry })
  expect(onDatabaseRetry).toHaveBeenCalledExactlyOnceWith({ operation, attempt: 2, delayMs: 1000, reason: 'transport' })
  expect(test.batches.filter(batch => batch === test.batches[0])).toHaveLength(2)
  expect(waitBeforeDatabaseRetry).toHaveBeenCalledExactlyOnceWith(1000)
  expect(await test.database.select().from(schema.sourceFetchLogs)).toHaveLength(2)
  expect(await test.database.select().from(schema.briefEntries)).toHaveLength(1)
  expect(vi.mocked(test.fetcher).mock.calls.filter(([url]) => url.endsWith('/feed.xml'))).toHaveLength(2)
}, 30000)

it('keeps the original cut date and checkpoint when final commit recovery crosses midnight', async () => {
  const test = await fixture('final', true)
  await runNeonIngestion(wakeAt, test.database, test.fetcher, test.provider, undefined, undefined, {
    waitBeforeDatabaseRetry: async () => { vi.setSystemTime(new Date('2026-10-01T00:00:01Z')) },
  })
  expect((await test.database.select().from(schema.briefs)).map(brief => brief.localDate).sort()).toEqual(['2026-09-29', '2026-09-30'])
  expect((await test.database.select().from(schema.ingestionCheckpoints))[0]?.processedThrough).toEqual(wakeAt)
  expect(await test.database.select().from(schema.briefEntries)).toHaveLength(1)
}, 30000)

it.each(['source', 'final'] as const)('recovers a committed %s transaction whose acknowledgement was lost', async (operation) => {
  const test = await fixture(operation, true)
  const onDatabaseRetry = vi.fn()
  await runNeonIngestion(wakeAt, test.database, test.fetcher, test.provider, undefined, undefined, { waitBeforeDatabaseRetry: async () => {}, onDatabaseRetry })
  expect(onDatabaseRetry).toHaveBeenCalledExactlyOnceWith({ operation, attempt: 2, delayMs: 1000, reason: 'transport' })
  expect(await test.database.select().from(schema.sourceFetchLogs)).toHaveLength(2)
  expect(await test.database.select().from(schema.items)).toHaveLength(2)
  expect(await test.database.select().from(schema.citations)).toHaveLength(4)
  const briefs = await test.database.select().from(schema.briefs)
  expect(briefs).toHaveLength(2)
  expect(briefs.find(brief => brief.localDate === '2026-09-29')).toEqual(test.sealed[0])
  expect(briefs.find(brief => brief.localDate === '2026-09-30')?.cutAt).toEqual(wakeAt)
  expect(await test.database.select().from(schema.briefEntries)).toHaveLength(1)
  expect((await test.database.select().from(schema.ingestionCheckpoints))[0]?.processedThrough).toEqual(wakeAt)
  expect(vi.mocked(test.fetcher).mock.calls.filter(([url]) => url.endsWith('/feed.xml'))).toHaveLength(2)
}, 30000)
