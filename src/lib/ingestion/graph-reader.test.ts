import type { Database } from '@/lib/db'
import { readdirSync, readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { loadReaderScope, readSignalMetadata } from './graph-reader'
import { runIngestion } from './pipeline'

const databases: PGlite[] = []
const firstWake = new Date('2026-09-30T05:00:00Z')
const secondWake = new Date('2026-09-30T05:20:00Z')
const nextWake = new Date('2026-09-30T05:40:00Z')
const signalId = (number: number): string => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(databases.splice(0).map(database => database.close()))
})

async function fixture(count = 2001) {
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
  await pg.query(`INSERT INTO link(id,url,first_seen_at,created_at)
    SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'https://reader-scope.example/story-' || n,'2026-09-30T05:01:00Z','2026-09-30T05:01:00Z'
    FROM generate_series(1,$1::integer) AS n`, [count])
  await pg.exec(`INSERT INTO signal(id,target_link_id,created_at)
    SELECT id,id,'2026-09-30T05:01:00Z' FROM link`)
  const database = drizzle(pg, { schema }) as unknown as Database
  const graph = await runIngestion({ sources: [], responses: [], now: () => firstWake })
  return { pg, database, graph }
}

it('reads known identity pages once with one shared four-request bound and keeps bootstrap pagination complete', async () => {
  const { pg, database, graph } = await fixture()
  const original = pg.query.bind(pg)
  const queries: string[] = []
  let active = 0
  let maximumActive = 0
  vi.spyOn(pg, 'query').mockImplementation((async (...args: Parameters<typeof pg.query>) => {
    queries.push(args[0])
    active++
    maximumActive = Math.max(maximumActive, active)
    try {
      await setImmediate()
      return await original(...args)
    }
    finally {
      active--
    }
  }) as typeof pg.query)
  await loadReaderScope(database, graph, firstWake, secondWake)
  expect(graph.signals.map(signal => signal.id)).toEqual(Array.from({ length: 2001 }, (_, index) => signalId(index + 1)))
  expect(graph.links).toHaveLength(2001)
  expect(queries.filter(query => query.includes('from "signal"'))).toHaveLength(3)
  expect(maximumActive).toBe(4)
  expect(active).toBe(0)

  queries.length = 0
  const allMetadata = await readSignalMetadata(database)
  expect(allMetadata.map(signal => signal.id)).toEqual(graph.signals.map(signal => signal.id))
  expect(queries.filter(query => query.includes('from "signal"'))).toHaveLength(3)
})

it('drains in-flight reader requests after failure without dispatching queued reads or replacing the graph', async () => {
  const { pg, database, graph } = await fixture()
  const before = structuredClone(graph)
  const original = pg.query.bind(pg)
  const failedRead = Promise.withResolvers<void>()
  const releasePeers = Promise.withResolvers<void>()
  let active = 0
  let started = 0
  let failed = false
  vi.spyOn(pg, 'query').mockImplementation((async (...args: Parameters<typeof pg.query>) => {
    if (!args[0].startsWith('select'))
      return original(...args)
    active++
    started++
    const failThisRead = !failed && args[0].includes('from "signal"')
    failed ||= failThisRead
    try {
      if (failThisRead) {
        await setImmediate()
        failedRead.resolve()
        throw new Error('Injected reader failure')
      }
      await releasePeers.promise
      return await original(...args)
    }
    finally {
      active--
    }
  }) as typeof pg.query)
  let finished = false
  const running = loadReaderScope(database, graph, firstWake, secondWake)
    .then(() => ({ failed: false }), () => ({ failed: true }))
    .finally(() => { finished = true })
  await failedRead.promise
  await setImmediate()
  const finishedBeforeDrain = finished
  const startedBeforeDrain = started
  releasePeers.resolve()
  expect(await running).toEqual({ failed: true })
  expect(finishedBeforeDrain).toBe(false)
  expect(startedBeforeDrain).toBe(4)
  expect(started).toBe(4)
  expect(active).toBe(0)
  expect(graph).toEqual(before)
})

it('shrinks the first post-embedding scope after halfvec rematching and retains only recently eligible identities', async () => {
  const { pg, database, graph } = await fixture(1001)
  const embedding = `[${Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0).join(',')}]`
  await pg.query(`UPDATE signal SET text_basis='slug',embedding_text='Retained topic',embedding=$1::halfvec,
    embedding_model='bge-small-en-v1.5',embedding_dimensions=384,
    embedding_version='bge-small-en-v1.5:cls:l2:no-prefix:v1',embedded_at='2026-09-30T05:09:00Z'`, [embedding])
  await pg.exec(`INSERT INTO reader_match_profile(user_id,fingerprint) SELECT id,repeat('a',64) FROM "user";
    INSERT INTO reader_signal_match(user_id,signal_id,matched_at)
      SELECT u.id,s.id,'2026-09-30T05:09:00Z' FROM "user" u CROSS JOIN signal s;
    INSERT INTO item(source_id,external_id,title,published_at,fetched_at,created_at,updated_at)
      SELECT id,'recent-scope-item','Recent topic','2026-09-29T00:00:00Z','2026-09-29T00:00:00Z',
        '2026-09-29T00:00:00Z','2026-09-29T00:00:00Z' FROM source ORDER BY id LIMIT 1;
    INSERT INTO citation(item_id,source_id,link_id,kind,raw_url,first_seen_at)
      SELECT id,source_id,'00000000-0000-4000-8000-000000000001','outbound',
        'https://reader-scope.example/story-1','2026-09-29T00:00:00Z' FROM item;`)
  await loadReaderScope(database, graph, firstWake, secondWake)
  expect(graph.signals).toHaveLength(1001)
  await pg.exec(`UPDATE reader_signal_match SET matched_at='2026-09-30T05:20:00Z'`)
  await loadReaderScope(database, graph, secondWake, nextWake)
  expect(graph.signals.map(signal => signal.id)).toEqual([signalId(1)])
  expect(graph.items).toHaveLength(1)
  expect(graph.items[0]?.hasOutboundCitation).toBe(true)
  expect(graph.citations).toHaveLength(1)
  await loadReaderScope(database, graph, nextWake, new Date('2026-09-30T06:00:00Z'))
  expect(graph.signals.map(signal => signal.id)).toEqual([signalId(1)])
})
