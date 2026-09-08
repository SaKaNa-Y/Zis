import type { SQL } from 'drizzle-orm'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, expect, it, vi } from 'vitest'
import { createBriefSignalMutations } from '@/lib/briefs/postgres'
import { createSavedBookmarks } from './saved'

vi.mock('server-only', () => ({}))
const databases: PGlite[] = []
afterEach(async () => Promise.all(databases.splice(0).map(pg => pg.close())))

async function fixture() {
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  const reader = (await pg.query<{ id: string }>('SELECT id FROM "user" LIMIT 1')).rows[0]!.id
  const execute = async <T extends Record<string, unknown>>(statement: SQL) => {
    const query = new PgDialect().sqlToQuery(statement)
    return pg.query<T>(query.sql, query.params)
  }
  const publisher = (await pg.query<{ id: string }>('INSERT INTO publisher (name, slug) VALUES (\'Example\', \'saved-test\') RETURNING id')).rows[0]!.id
  const source = (await pg.query<{ id: string }>('INSERT INTO source (publisher_id, transport, endpoint_url) VALUES ($1, \'rss\', \'https://example.com/feed\') RETURNING id', [publisher])).rows[0]!.id
  let sessionReader = reader
  const saved = createSavedBookmarks({ execute, verifySession: async () => {
    if (!sessionReader)
      throw new Error('unauthorized')
    return { userId: sessionReader }
  }, undoSecret: () => 'test-bookmark-signing-key-at-least-32-bytes' })
  async function story(title: string, date = '2026-09-01', owner = reader) {
    const link = (await pg.query<{ id: string }>('INSERT INTO link (url, first_seen_at) VALUES ($1, now()) RETURNING id', [`https://example.com/${crypto.randomUUID()}`])).rows[0]!.id
    await pg.query('INSERT INTO signal (id, target_link_id, origin_publisher_id) VALUES ($1, $1, $2)', [link, publisher])
    const item = (await pg.query<{ id: string }>('INSERT INTO item (source_id, external_id, title, published_at, fetched_at) VALUES ($1, $2, $3, now(), now()) RETURNING id', [source, link, title])).rows[0]!.id
    await pg.query('INSERT INTO citation (item_id, source_id, link_id, kind, raw_url, first_seen_at) VALUES ($1, $2, $3, \'self\', \'https://example.com/story\', now())', [item, source, link])
    const brief = (await pg.query<{ id: string }>('INSERT INTO brief (user_id, local_date, cut_at) VALUES ($1, $2, now()) ON CONFLICT (user_id, local_date) DO UPDATE SET local_date = EXCLUDED.local_date RETURNING id', [owner, date])).rows[0]!.id
    await pg.query(`INSERT INTO brief_entry (brief_id, user_id, signal_id, position, admitted_by, why_text)
      VALUES ($1, $2, $3, (SELECT count(*) + 1 FROM brief_entry WHERE brief_id = $1), 'interest', 'matched databases')`, [brief, owner, link])
    return link
  }
  return { pg, reader, saved, story, mutations: createBriefSignalMutations(execute), signIn: (id: string) => {
    sessionReader = id
  } }
}

it('retrieves a saved Signal after reloading through the authenticated reader interface', async () => {
  const { saved, story, mutations, reader } = await fixture()
  expect((await saved.read()).entries).toEqual([])
  const signalId = await story('Database internals')
  await mutations.save(reader, signalId)
  const result = await saved.read()
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0]).toMatchObject({ signalId, entryId: signalId, title: 'Database internals', briefDate: '2026-09-01' })
  expect(result.entries[0]!.originUrl).toMatch(/^https:\/\/example.com\//)
  expect(result).toMatchObject({ page: 1, hasNext: false })
})

it('removes merged Bookmarks once and restores their latest timestamp without changing Briefs or Read State', async () => {
  const { pg, saved, story, mutations, reader } = await fixture()
  const first = await story('Original', '2026-09-01')
  const second = await story('Later entry', '2026-09-05')
  await pg.query('INSERT INTO bookmark (user_id, signal_id, saved_at) VALUES ($1, $2, \'2026-09-01T09:00:00Z\'), ($1, $3, \'2026-09-05T09:00:00Z\')', [reader, first, second])
  await mutations.markRead(reader, first)
  await pg.query('UPDATE signal SET merged_into_id = $1 WHERE id = $2', [first, second])
  const before = await saved.read()
  expect(before.entries).toHaveLength(1)
  expect(before.entries[0]).toMatchObject({ signalId: first, entryId: second, briefDate: '2026-09-05', savedDate: '2026-09-05' })
  const { createSignalProvenanceReader, signalProvenanceStatement } = await import('@/lib/signals/provenance')
  const provenance = createSignalProvenanceReader(async (userId, entryId) => {
    const query = new PgDialect().sqlToQuery(signalProvenanceStatement(userId, entryId))
    return (await pg.query<import('@/lib/signals/provenance').SignalProvenanceRow>(query.sql, query.params)).rows
  })
  expect(await provenance(reader, before.entries[0]!.entryId)).toMatchObject({
    signalId: first,
    entryId: second,
    briefDate: '2026-09-05',
    whyText: 'matched databases',
  })
  const receipt = await saved.remove(second)
  expect((await saved.read()).entries).toEqual([])
  await saved.undo(receipt!)
  expect(await saved.read()).toEqual(before)
  // Read through the existing Brief interface to prove sealed history and reader state survive.
  const { createDatedBriefReader, datedBriefStatement } = await import('@/lib/briefs/today')
  const readBrief = createDatedBriefReader(async (userId, date) => {
    const query = new PgDialect().sqlToQuery(datedBriefStatement(userId, date))
    return (await pg.query<import('@/lib/briefs/today').TodayBriefRow>(query.sql, query.params)).rows
  })
  expect((await readBrief(reader, '2026-09-01')).entries[0]).toMatchObject({ position: 1, entryId: first, isRead: true, isBookmarked: true, whyText: 'matched databases' })
  expect((await readBrief(reader, '2026-09-05')).entries[0]).toMatchObject({ position: 1, entryId: second, whyText: 'matched databases' })
})

it('isolates readers and rejects foreign, forged and unauthenticated mutations', async () => {
  const { pg, reader, saved, story, signIn, mutations } = await fixture()
  const signal = await story('Private bookmark')
  await mutations.save(reader, signal)
  const receipt = await saved.remove(signal)
  const other = (await pg.query<{ id: string }>('INSERT INTO "user" (passphrase_hash) SELECT passphrase_hash FROM "user" LIMIT 1 RETURNING id')).rows[0]!.id
  signIn(other)
  expect((await saved.read()).entries).toEqual([])
  await expect(saved.remove(signal)).rejects.toThrow('not authorized')
  await expect(saved.undo(receipt!)).rejects.toThrow('Invalid Bookmark Undo')
  signIn(reader)
  await expect(saved.undo(`${receipt!.slice(0, -8)}forged00`)).rejects.toThrow()
  expect((await saved.read()).entries).toEqual([])
  await saved.undo(receipt!)
  signIn(other)
  expect((await saved.read()).entries).toEqual([])
  signIn('')
  await expect(saved.read()).rejects.toThrow('unauthorized')
  await expect(saved.remove(signal)).rejects.toThrow('unauthorized')
  await expect(saved.undo(receipt!)).rejects.toThrow('unauthorized')
})

it('uses stable pages of 20 with the latest saved first and current titles', async () => {
  const { pg, reader, saved, story } = await fixture()
  const ids: string[] = []
  for (let index = 0; index < 41; index++) {
    const id = await story(`Story ${index}`)
    ids.push(id)
    await pg.query('INSERT INTO bookmark (user_id, signal_id, saved_at) VALUES ($1, $2, $3)', [reader, id, new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()])
  }
  await pg.query('UPDATE item SET title = $1 WHERE external_id = $2', ['Updated original', ids[40]])
  const first = await saved.read()
  const second = await saved.read(2)
  const third = await saved.read(3)
  expect(first.entries).toHaveLength(20)
  expect(first.entries[0]).toMatchObject({ signalId: ids[40], title: 'Updated original' })
  expect(first.hasNext).toBe(true)
  expect(second.entries).toHaveLength(20)
  expect(second.hasNext).toBe(true)
  expect(third.entries.map(entry => entry.signalId)).toEqual([ids[0]])
  expect(third.hasNext).toBe(false)
  expect(new Set([...first.entries, ...second.entries, ...third.entries].map(entry => entry.signalId)).size).toBe(41)
  expect(await saved.read(1)).toEqual(first)
  expect(await saved.read(-1)).toEqual(first)
  expect((await saved.read(4)).entries).toEqual([])
})

it('resolves further merges during Undo and does not overwrite a newer Save', async () => {
  const { pg, reader, saved, story, mutations } = await fixture()
  const alias = await story('Alias')
  const root = await story('Root', '2026-09-02')
  await pg.query('INSERT INTO bookmark (user_id, signal_id, saved_at) VALUES ($1, $2, \'2026-09-01T09:00:00Z\')', [reader, alias])
  const receipt = await saved.remove(alias)
  await pg.query('UPDATE signal SET merged_into_id = $1 WHERE id = $2', [root, alias])
  await saved.undo(receipt!)
  expect((await saved.read()).entries[0]).toMatchObject({ signalId: root, savedDate: '2026-09-01' })
  await saved.remove(root)
  await mutations.save(reader, alias)
  const newer = await saved.read()
  await saved.undo(receipt!)
  expect(await saved.read()).toEqual(newer)
  await mutations.save(reader, root)
  expect(await saved.read()).toEqual(newer)
})

it('rejects an unsafe original address instead of exposing an executable link', async () => {
  const { pg, reader, saved, story, mutations } = await fixture()
  const id = await story('Unsafe address')
  await mutations.save(reader, id)
  await pg.query('UPDATE link SET url = $1 WHERE id = $2', ['javascript:alert(1)', id])
  await expect(saved.read()).rejects.toThrow('Invalid Bookmark origin')
})
