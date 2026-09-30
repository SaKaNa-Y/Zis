import type { Database, DatabaseStatement } from '@/lib/db'
import type { SafeFetch } from '@/lib/safe-fetch'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import register from '../../../docs/source-register.json'
import { runNeonIngestion } from './postgres'

const databases: PGlite[] = []
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(databases.splice(0).map(database => database.close()))
})

const HN_VEHICLE = 'https://news.ycombinator.com/item?id=1'
const ASK_HN = 'https://news.ycombinator.com/item?id=2'
const HN_ALIAS = 'https://news.ycombinator.com/item?id=3'
const BLUESKY_VEHICLE = 'https://bsky.app/profile/did:plc:fixture/post/one'
const RSS_PUBLICATION = 'https://publisher.example/own'

async function fixture(withReader = false) {
  const published = new Date()
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  await pg.exec('TRUNCATE publisher, "user", http_cache, robots_cache, ingestion_checkpoint CASCADE')
  const database = Object.assign(drizzle(pg, { schema }), {
    commit: async (statements: DatabaseStatement[]) => pg.transaction(async (transaction) => {
      for (const statement of statements)
        await transaction.query(statement.sql, statement.params)
    }),
  }) as unknown as Database
  for (const [index, transport, endpointUrl, host] of [
    [1, 'rss', 'https://publisher.example/feed.xml', 'publisher.example'],
    [2, 'hn_firebase', 'https://hacker-news.firebaseio.com/v0/topstories.json', 'news.ycombinator.com'],
    [3, 'bluesky_feed', 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=did%3Aplc%3Afixture', null],
  ] as const) {
    const publisherId = `00000000-0000-4000-8000-00000000000${index}`
    await database.insert(schema.publishers).values({ id: publisherId, name: transport, slug: transport })
    if (host !== null)
      await database.insert(schema.publisherHosts).values({ publisherId, host })
    await database.insert(schema.sources).values({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      publisherId,
      transport,
      endpointUrl,
    })
  }
  if (withReader) {
    const userId = '00000000-0000-4000-8000-000000000099'
    await database.insert(schema.users).values({ id: userId, passphraseHash: '$argon2id$v=19$m=65536,t=3,p=1$fixture', timezone: 'UTC', cutHour: 6 })
    await database.insert(schema.interests).values({ userId, statement: 'Synthetic software interest' })
  }
  const fetcher: SafeFetch = async (url) => {
    let body: string
    let contentType = 'application/json'
    if (url.endsWith('/robots.txt')) {
      body = 'User-agent: *\nAllow: /'
      contentType = 'text/plain'
    }
    else if (url === 'https://publisher.example/feed.xml') {
      body = `<rss><channel><item><guid>own</guid><title>Original publication</title><link>${RSS_PUBLICATION}</link><description>Original technical body.</description><pubDate>${published.toUTCString()}</pubDate></item></channel></rss>`
      contentType = 'application/rss+xml'
    }
    else if (url.endsWith('topstories.json')) {
      body = JSON.stringify([1, 2, 3])
    }
    else if (url.includes('/item/')) {
      const id = Number(url.split('/').at(-1)!.split('.')[0])
      body = JSON.stringify({
        id,
        type: 'story',
        title: id === 2 ? 'Ask HN: an original question' : `Outside story ${id}`,
        time: Math.floor(published.getTime() / 1000),
        ...(id === 2 ? { text: 'Original question body.' } : { url: `https://target.example/story-${id}` }),
      })
    }
    else if (url.includes('getAuthorFeed')) {
      body = JSON.stringify({ feed: [{ post: {
        uri: 'at://did:plc:fixture/app.bsky.feed.post/one',
        author: { did: 'did:plc:fixture' },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'A pointer to another publication.',
          createdAt: published.toISOString(),
          embed: { $type: 'app.bsky.embed.external', external: { uri: 'https://target.example/bluesky', title: 'Linked publication' } },
        },
      } }] })
    }
    else {
      throw new Error(`Unexpected fixture request: ${url}`)
    }
    const bytes = new TextEncoder().encode(body)
    return { url, status: 200, headers: { 'content-type': contentType }, bytes, byteLength: bytes.length, text: () => body }
  }
  const embed = vi.fn(async (texts: readonly string[]) => texts.map(() =>
    Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0)))
  const provider = { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, version: EMBEDDING_VERSION, embed }
  const run = () => runNeonIngestion(new Date(), database, fetcher, provider)
  async function signalAt(url: string) {
    const [link] = await database.select().from(schema.links).where(eq(schema.links.url, url))
    expect(link).toBeDefined()
    const [signal] = await database.select().from(schema.signals).where(eq(schema.signals.targetLinkId, link!.id))
    expect(signal).toBeDefined()
    return signal!
  }
  async function corruptVehicle(url: string) {
    const signal = await signalAt(url)
    await database.update(schema.signals).set({
      textBasis: 'own',
      embeddingText: 'Incorrectly treated vehicle title.',
      embeddingTextExpiresAt: null,
    }).where(eq(schema.signals.id, signal.id))
  }
  return { database, run, embed, signalAt, corruptVehicle }
}

it('keeps vehicle classification across bootstrap and two unchanged scoped wakes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-30T06:00:00Z'))
  const test = await fixture(true)
  await test.run()
  const briefs = await test.database.select().from(schema.briefs)
  const entries = await test.database.select().from(schema.briefEntries)
  const interests = await test.database.select().from(schema.interests)
  for (const hour of [7, 8]) {
    test.embed.mockClear()
    vi.setSystemTime(new Date(`2026-09-30T0${hour}:00:00Z`))
    await test.run()
    expect(test.embed).not.toHaveBeenCalled()
    expect((await test.signalAt(HN_VEHICLE)).textBasis).toBe('slug')
    expect((await test.signalAt(BLUESKY_VEHICLE)).textBasis).toBe('slug')
    expect((await test.signalAt(ASK_HN)).textBasis).toBe('own')
    expect((await test.signalAt(RSS_PUBLICATION)).textBasis).toBe('own')
  }
  expect(await test.database.select().from(schema.briefs)).toEqual(briefs)
  expect(await test.database.select().from(schema.briefEntries)).toEqual(entries)
  expect(await test.database.select().from(schema.interests)).toEqual(interests)
}, 30000)

it('repairs false own vehicle vectors once without downgrading lawful own text or sealed reader state', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-30T06:00:00Z'))
  const test = await fixture(true)
  await test.run()
  const rss = await test.signalAt(RSS_PUBLICATION)
  const ask = await test.signalAt(ASK_HN)
  const alias = await test.signalAt(HN_ALIAS)
  await test.database.update(schema.signals).set({ mergedIntoId: rss.id }).where(eq(schema.signals.id, alias.id))
  await test.corruptVehicle(HN_VEHICLE)
  await test.corruptVehicle(BLUESKY_VEHICLE)
  const briefs = await test.database.select().from(schema.briefs)
  const entries = await test.database.select().from(schema.briefEntries)
  const interests = await test.database.select().from(schema.interests)
  test.embed.mockClear()
  vi.setSystemTime(new Date('2026-09-30T07:00:00Z'))
  await test.run()
  expect(test.embed.mock.calls.flatMap(([texts]) => texts)).toHaveLength(2)
  for (const url of [HN_VEHICLE, BLUESKY_VEHICLE]) {
    const repaired = await test.signalAt(url)
    expect(repaired.textBasis).toBe('slug')
    expect(repaired.embeddingText).not.toBe('Incorrectly treated vehicle title.')
    expect(repaired.embeddedAt).toEqual(new Date())
  }
  // An alias component with both vehicle and genuine publication self edges
  // still has lawful own text. Ask HN without an outbound edge is also own.
  expect((await test.signalAt(RSS_PUBLICATION)).embeddedAt).toEqual(rss.embeddedAt)
  expect((await test.signalAt(RSS_PUBLICATION)).textBasis).toBe('own')
  expect((await test.signalAt(ASK_HN)).embeddedAt).toEqual(ask.embeddedAt)
  expect((await test.signalAt(ASK_HN)).textBasis).toBe('own')
  test.embed.mockClear()
  vi.setSystemTime(new Date('2026-09-30T08:00:00Z'))
  await test.run()
  expect(test.embed).not.toHaveBeenCalled()
  expect(await test.database.select().from(schema.briefs)).toEqual(briefs)
  expect(await test.database.select().from(schema.briefEntries)).toEqual(entries)
  expect(await test.database.select().from(schema.interests)).toEqual(interests)
}, 30000)

it('invalidates the deployed scope checkpoint to repair expired vehicles outside incremental scope', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T06:00:00Z'))
  const test = await fixture()
  const first = await test.run()
  await test.corruptVehicle(HN_VEHICLE)
  await test.database.update(schema.sources).set({ disabledAt: new Date() })
  // Reproduce the configuration identity written by the deployed v1 reader.
  const legacyHash = createHash('sha256').update(JSON.stringify([
    'incremental-graph-v1',
    register,
    [EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_VERSION],
    first.sources.map(row => [row.id, row.publisherId, row.transport, row.endpointUrl, row.isAggregator]).sort(),
    first.publisherHosts.map(row => [row.host, row.publisherId]).sort(),
    [],
    [],
  ])).digest('hex')
  await test.database.update(schema.ingestionCheckpoints).set({
    configurationHash: legacyHash,
    processedThrough: new Date('2026-09-29T06:00:00Z'),
  })
  test.embed.mockClear()
  vi.setSystemTime(new Date('2026-09-30T06:00:00Z'))
  await test.run()
  expect(test.embed.mock.calls.flatMap(([texts]) => texts)).toHaveLength(1)
  expect((await test.signalAt(HN_VEHICLE)).textBasis).toBe('slug')
  test.embed.mockClear()
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await test.run()
  expect(test.embed).not.toHaveBeenCalled()
}, 30000)
