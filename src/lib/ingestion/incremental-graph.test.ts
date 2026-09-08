import type { Database, DatabaseStatement } from '@/lib/db'
import type { SafeFetch } from '@/lib/safe-fetch'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runNeonIngestion } from './postgres'

const databases: PGlite[] = []
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(databases.splice(0).map(database => database.close()))
})

async function fixture() {
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  await pg.exec('TRUNCATE publisher, "user", http_cache, robots_cache, ingestion_checkpoint CASCADE')
  let failFinalCommit = false
  const writes = { affectedRows: 0, committedStatements: 0, compiledWriteBytes: 0, websocketCommits: 0 }
  const database = Object.assign(drizzle(pg, { schema }), {
    writeMetrics: () => ({ ...writes }),
    commit: async (statements: DatabaseStatement[]) => {
      const affected = await pg.transaction(async (tx) => {
        let rows = 0
        for (const statement of statements) {
          rows += (await tx.query(statement.sql, statement.params)).affectedRows ?? 0
          if (failFinalCommit && statement.sql.includes('ingestion_checkpoint')) {
            failFinalCommit = false
            throw new Error('Injected final transaction failure')
          }
        }
        return rows
      })
      writes.affectedRows += affected
      writes.committedStatements += statements.length
    },
  }) as unknown as Database
  const publisher = '00000000-0000-4000-8000-000000000001'
  await database.insert(schema.publishers).values({ id: publisher, name: 'Example', slug: 'example' })
  await database.insert(schema.publisherHosts).values({ publisherId: publisher, host: 'example.com' })
  await database.insert(schema.sources).values({
    id: '00000000-0000-4000-8000-000000000002',
    publisherId: publisher,
    endpointUrl: 'https://example.com/feed.xml',
    transport: 'rss',
  })
  let unchanged = false
  let feed = '<rss><channel><item><guid>one</guid><link>https://example.com/one</link><title>One</title><pubDate>Sat, 01 Aug 2026 05:00:00 GMT</pubDate></item></channel></rss>'
  const fetcher: SafeFetch = async (url) => {
    const robots = url.endsWith('/robots.txt')
    const body = robots ? 'User-agent: *\nAllow: /' : feed
    const bytes = new TextEncoder().encode(body)
    return { url, status: !robots && unchanged ? 304 : 200, headers: { 'content-type': robots ? 'text/plain' : 'application/rss+xml', 'etag': '"same"' }, contentType: robots ? 'text/plain' : 'application/rss+xml', bytes, byteLength: bytes.byteLength, text: () => body }
  }
  const provider = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed: async (texts: readonly string[]) => texts.map(() => Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0)),
  }
  return {
    database,
    pg,
    fetcher,
    provider,
    failFinalCommit: () => { failFinalCommit = true },
    unchanged: () => { unchanged = true },
    feed: (body: string) => {
      feed = body
      unchanged = false
    },
  }
}

it.each([200, 304])('leaves unchanged expired corpus metadata in Postgres after HTTP %i', async (status) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-01T06:00:00Z'))
  const test = await fixture()
  const first = await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  expect(first.signals).toHaveLength(1)
  if (status === 304)
    test.unchanged()
  vi.setSystemTime(new Date('2026-09-08T06:00:00Z'))
  // One overlapping wake proves no work was lost around the previous cursor.
  await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  vi.setSystemTime(new Date('2026-09-09T06:00:00Z'))
  const report = vi.fn()
  const warm = await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider, report)
  expect(warm.signals).toHaveLength(0)
  expect(warm.items).toHaveLength(0)
  expect(warm.citations).toHaveLength(0)
  expect(warm.corpusCounts?.items).toBe(1)
  // Only the Source, validators, fetch log, checkpoint, and (for 200) fetchedAt.
  expect(report.mock.calls[0]![0].affectedRows).toBeLessThanOrEqual(status === 304 ? 5 : 6)
}, 30000)

it('invalidates expired Signal matches after an Interest edit while preserving another reader matches', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-01T06:00:00Z'))
  const test = await fixture()
  for (const suffix of ['1', '2']) {
    const id = `00000000-0000-4000-8000-00000000001${suffix}`
    await test.database.insert(schema.users).values({ id, passphraseHash: '$argon2id$v=19$m=65536,t=3,p=1$fixture', timezone: 'UTC', cutHour: 6 })
    await test.database.insert(schema.interests).values({ id, userId: id, statement: 'One' })
  }
  const provider = { ...test.provider, embed: async (texts: readonly string[]) => texts.map(text => Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === (text === 'Other' ? 1 : 0) ? 1 : 0)) }
  await runNeonIngestion(new Date(), test.database, test.fetcher, provider)
  test.unchanged()
  vi.setSystemTime(new Date('2026-09-08T06:00:00Z'))
  const settled = await runNeonIngestion(new Date(), test.database, test.fetcher, provider)
  const untouched = settled.readerSignalMatches.find(match => match.userId.endsWith('12'))!
  vi.setSystemTime(new Date('2026-09-09T06:00:00Z'))
  await test.database.update(schema.interests).set({ statement: 'Other', updatedAt: new Date() }).where(eq(schema.interests.id, '00000000-0000-4000-8000-000000000011'))
  const changed = await runNeonIngestion(new Date(), test.database, test.fetcher, provider)
  expect(changed.readerSignalMatches.find(match => match.userId.endsWith('11'))!.relevance).toBe(0)
  expect(changed.readerSignalMatches.find(match => match.userId.endsWith('12'))).toEqual(untouched)
}, 30000)

it('retries an old Signal Text Basis improvement after the final transaction rolls back', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const old = new Date('2026-08-01T06:00:00Z')
  vi.setSystemTime(old)
  const test = await fixture()
  const id = '00000000-0000-4000-8000-000000000099'
  await test.database.insert(schema.links).values({ id, url: 'https://example.com/late-own', firstSeenAt: old, createdAt: old })
  await test.database.insert(schema.signals).values({ id, targetLinkId: id, createdAt: old })
  const first = await runNeonIngestion(old, test.database, test.fetcher, test.provider)
  expect(first.signals.find(signal => signal.id === id)!.textBasis).toBe('slug')
  test.unchanged()
  vi.setSystemTime(new Date('2026-09-08T06:00:00Z'))
  await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  vi.setSystemTime(new Date('2026-09-09T06:00:00Z'))
  test.feed('<rss><channel><item><guid>late</guid><link>https://example.com/late-own</link><title>Own text arrives later</title><pubDate>Sat, 01 Aug 2026 05:00:00 GMT</pubDate></item></channel></rss>')
  test.failFinalCommit()
  await expect(runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)).rejects.toThrow('Injected final transaction failure')
  test.unchanged()
  vi.setSystemTime(new Date('2026-09-10T06:00:00Z'))
  const retried = await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  expect(retried.signals.find(signal => signal.id === id)!.textBasis).toBe('own')
  expect(retried.items.find(item => item.externalId === 'late')!.title).toBe('Own text arrives later')
}, 30000)

it('resolves an old release alias to a new target without showing its saved Signal again', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const firstAt = new Date('2026-09-07T06:00:00Z')
  vi.setSystemTime(firstAt)
  const test = await fixture()
  const reader = '00000000-0000-4000-8000-000000000010'
  await test.database.insert(schema.users).values({ id: reader, passphraseHash: '$argon2id$v=19$m=65536,t=3,p=1$fixture', timezone: 'UTC', cutHour: 6 })
  await test.database.insert(schema.interests).values({ userId: reader, statement: 'One' })
  const tagId = '00000000-0000-4000-8000-000000000020'
  const tag = 'https://github.com/example/project/releases/tag/v1'
  await test.database.insert(schema.links).values({ id: tagId, url: tag, firstSeenAt: firstAt, createdAt: firstAt })
  await test.database.insert(schema.signals).values({ id: tagId, targetLinkId: tagId, createdAt: firstAt })
  for (let index = 1; index <= 2; index++) {
    const publisherId = `00000000-0000-4000-8000-00000000003${index}`
    const sourceId = `00000000-0000-4000-8000-00000000004${index}`
    const itemId = `00000000-0000-4000-8000-00000000005${index}`
    await test.database.insert(schema.publishers).values({ id: publisherId, slug: `voice-${index}`, name: `Voice ${index}` })
    await test.database.insert(schema.sources).values({ id: sourceId, publisherId, transport: 'rss', endpointUrl: `https://voice${index}.com/feed`, disabledAt: firstAt })
    await test.database.insert(schema.items).values({ id: itemId, sourceId, externalId: 'vote', title: 'Independent coverage', publishedAt: firstAt, fetchedAt: firstAt, createdAt: firstAt, updatedAt: firstAt })
    await test.database.insert(schema.citations).values({ itemId, sourceId, linkId: tagId, kind: 'outbound', rawUrl: tag, anchorText: 'One', firstSeenAt: firstAt, createdAt: firstAt })
  }
  const announcement = (slug: string, date: string) => `<rss><channel><item><guid>${slug}</guid><link>https://example.com/${slug}</link><title>One</title><description><![CDATA[<a href="${tag}">One</a>]]></description><pubDate>${date}</pubDate></item></channel></rss>`
  test.feed(announcement('z-old', 'Mon, 07 Sep 2026 05:00:00 GMT'))
  const first = await runNeonIngestion(firstAt, test.database, test.fetcher, test.provider)
  expect(first.briefEntries).toHaveLength(1)
  const shown = first.briefEntries[0]!
  test.unchanged()
  vi.setSystemTime(new Date('2026-09-08T05:00:00Z'))
  await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  test.feed(announcement('a-new', 'Tue, 08 Sep 2026 05:30:00 GMT'))
  vi.setSystemTime(new Date('2026-09-08T06:00:00Z'))
  const next = await runNeonIngestion(new Date(), test.database, test.fetcher, test.provider)
  const root = next.signals.find(signal => signal.mergedIntoId === null)!
  expect(next.links.find(link => link.id === root.targetLinkId)!.url).toBe('https://example.com/a-new')
  expect(root.strength).toBe(2)
  expect(next.signals.find(signal => signal.id === shown.signalId)!.mergedIntoId).toBe(root.id)
  expect(next.briefEntries).toEqual([shown])
  expect(next.briefs.find(brief => brief.localDate === '2026-09-08')).toBeDefined()
}, 30000)
