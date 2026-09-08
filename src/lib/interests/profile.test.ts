import type { Database, DatabaseStatement } from '@/lib/db'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { createInterestProfile } from './profile'

vi.mock('server-only', () => ({}))
const databases: PGlite[] = []
afterEach(async () => {
  await Promise.all(databases.splice(0).map(pg => pg.close()))
})

async function fixture() {
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  await pg.exec('TRUNCATE publisher CASCADE')
  const database = Object.assign(drizzle(pg, { schema }), {
    commit: async (statements: DatabaseStatement[]) => pg.transaction(async (tx) => {
      for (const statement of statements)
        await tx.query(statement.sql, statement.params)
    }),
  }) as unknown as Database
  const [reader] = await database.select().from(schema.users)
  let authenticated = true
  const profile = createInterestProfile({ database: () => database, verifySession: async () => {
    if (!authenticated)
      throw new Error('unauthorized')
    return { userId: reader!.id }
  } })
  return { database, profile, reader: reader!, signOut: () => {
    authenticated = false
  } }
}

it('persists individual Interests through the authenticated Profile interface', async () => {
  const { profile } = await fixture()
  await profile.save([{ statement: '  Database internals  ' }, { statement: 'Type systems' }])
  const first = await profile.read()
  expect(first.map(row => row.statement)).toEqual(['Database internals', 'Type systems'])
  await profile.save([{ ...first[0]!, statement: 'Postgres internals' }, { statement: 'Compilers' }])
  const reloaded = await profile.read()
  expect(reloaded.map(row => row.statement)).toEqual(['Postgres internals', 'Compilers'])
  expect(reloaded[0]!.id).toBe(first[0]!.id)
})

it('rejects invalid or foreign edits without changing either reader Profile', async () => {
  const { profile, database, reader } = await fixture()
  await profile.save([{ statement: 'Databases' }])
  const original = await profile.read()
  const [other] = await database.insert(schema.users).values({ passphraseHash: reader.passphraseHash }).returning()
  const [foreign] = await database.insert(schema.interests).values({ userId: other!.id, statement: 'Private statement' }).returning()
  for (const input of [[], [{ statement: ' ' }], [{ statement: 'x'.repeat(201) }], Array.from({ length: 21 }, () => ({ statement: 'Software' })), [{ id: foreign!.id, statement: 'Stolen' }], [original[0]!, original[0]!], [{ id: 'bad-id', statement: 'Software' }]]) {
    await expect(profile.save(input)).rejects.toThrow()
    expect(await profile.read()).toEqual(original)
  }
  const otherProfile = createInterestProfile({ database: () => database, verifySession: async () => ({ userId: other!.id }) })
  expect(await otherProfile.read()).toEqual([{ id: foreign!.id, statement: 'Private statement' }])
})

it('requires a verified reader for both read and save', async () => {
  const { profile, signOut } = await fixture()
  signOut()
  await expect(profile.read()).rejects.toThrow('unauthorized')
  await expect(profile.save([{ statement: 'Databases' }])).rejects.toThrow('unauthorized')
})

it('uses edited and removed Interests on the next ingestion without recutting a sealed Brief', async () => {
  const { runNeonIngestion } = await import('@/lib/ingestion/postgres')
  const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_VERSION } = await import('@/lib/embeddings/provider')
  const { profile, database } = await fixture()
  await profile.save([{ statement: 'Software' }, { statement: 'Databases' }])
  const at = new Date('2026-09-08T00:00:00Z')
  const sourceIds: string[] = []
  for (const name of ['origin', 'independent', 'another']) {
    const [publisher] = await database.insert(schema.publishers).values({ name, slug: name }).returning()
    await database.insert(schema.publisherHosts).values({ publisherId: publisher!.id, host: `${name}.example` })
    const [source] = await database.insert(schema.sources).values({ publisherId: publisher!.id, transport: 'rss', endpointUrl: `https://${name}.example/feed`, disabledAt: at }).returning()
    sourceIds.push(source!.id)
  }
  const signalIds: string[] = []
  for (const title of ['Software', 'Compilers']) {
    const url = `https://origin.example/${title.toLowerCase()}`
    const [link] = await database.insert(schema.links).values({ url, firstSeenAt: at }).returning()
    signalIds.push(link!.id)
    for (const [index, sourceId] of sourceIds.entries()) {
      const [item] = await database.insert(schema.items).values({ sourceId, externalId: title, url: index === 0 ? url : `https://${index === 1 ? 'independent' : 'another'}.example/${title}`, title, publishedAt: at, fetchedAt: at }).returning()
      await database.insert(schema.citations).values({ sourceId, itemId: item!.id, linkId: link!.id, kind: index === 0 ? 'self' : 'outbound', rawUrl: url, firstSeenAt: at })
    }
  }
  const embed = vi.fn(async (texts: readonly string[]) => texts.map(text => Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === (text.startsWith('Compilers') ? 2 : text === 'Databases' ? 1 : 0) ? 1 : 0)))
  const provider = { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, version: EMBEDDING_VERSION, embed }
  const first = await runNeonIngestion(new Date('2026-09-08T08:00:00Z'), database, undefined, provider)
  const sealed = structuredClone(first.briefs)
  expect(first.briefEntries).toHaveLength(1)
  expect(first.briefEntries[0]).toMatchObject({ signalId: signalIds[0], admittedBy: 'interest' })
  expect(first.briefEntries[0]!.whyText).toContain('Software')
  const whyText = structuredClone(first.briefEntries)
  const statements = await profile.read()
  await profile.save([{ ...statements[0]!, statement: 'Compilers' }])
  embed.mockClear()
  const sameDay = await runNeonIngestion(new Date('2026-09-08T09:00:00Z'), database, undefined, provider)
  expect(sameDay.interests).toHaveLength(1)
  expect(sameDay.interests[0]!.statement).toBe('Compilers')
  expect(embed.mock.calls.flatMap(call => call[0])).toContain('Compilers')
  expect(sameDay.readerSignalMatches.find(match => match.signalId === signalIds[0])).toMatchObject({ matchedInterestId: statements[0]!.id, relevance: 0 })
  expect(sameDay.briefs).toEqual(sealed)
  expect(sameDay.briefEntries).toEqual(whyText)
  const tomorrow = await runNeonIngestion(new Date('2026-09-09T08:00:00Z'), database, undefined, provider)
  expect(tomorrow.briefs.map(brief => brief.localDate)).toContain('2026-09-09')
  expect(tomorrow.briefEntries).toHaveLength(2)
  expect(tomorrow.briefEntries.find(entry => entry.signalId === signalIds[0])).toEqual(whyText[0])
  const nextEntry = tomorrow.briefEntries.find(entry => entry.signalId === signalIds[1])!
  expect(nextEntry.admittedBy).toBe('interest')
  expect(nextEntry.whyText).toContain('Compilers')
})

it('rolls back a stale ingestion rather than resurrecting a removed Interest', async () => {
  const { runNeonIngestion } = await import('@/lib/ingestion/postgres')
  const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_VERSION } = await import('@/lib/embeddings/provider')
  const { profile, database } = await fixture()
  await profile.save([{ statement: 'Old statement' }])
  const provider = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed: async (texts: readonly string[]) => {
      await profile.save([{ statement: 'Replacement' }])
      return texts.map(() => Float32Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0))
    },
  }
  await expect(runNeonIngestion(new Date('2026-09-08T08:00:00Z'), database, undefined, provider)).rejects.toThrow()
  expect((await profile.read()).map(row => row.statement)).toEqual(['Replacement'])
})
