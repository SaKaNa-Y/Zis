import type { PoolClient } from '@neondatabase/serverless'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { Pool } from '@neondatabase/serverless'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { signals as signalTable } from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runNeonIngestion } from './postgres'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it.each([
  { name: 'commits a corpus larger than the Neon HTTP limit atomically', count: 6000, failWrite: false, withReader: false },
  { name: 'rolls back a large graph when a streamed statement fails', count: 6000, failWrite: true, withReader: false },
  { name: 'keeps a large reader match set below the Postgres parameter limit', count: 12000, failWrite: false, withReader: true },
  { name: 'reads all persisted vectors when their response exceeds the Neon limit', count: 10000, failWrite: false, withReader: false },
])('$name', async ({ count, failWrite, withReader }) => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test')
  const database = db()
  const at = new Date('2026-09-05T08:00:00Z')
  const vector = Array.from(new Float32Array(EMBEDDING_DIMENSIONS).fill(withReader ? 0 : 1 / Math.sqrt(EMBEDDING_DIMENSIONS)))
  if (withReader)
    vector[0] = 1
  const links = Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-8000-8000-${String(index + 1).padStart(12, '0')}`,
    url: `https://example.com/releases/version-${index}`,
    firstSeenAt: at,
    createdAt: at,
  }))
  const signals = links.map(link => ({
    id: link.id,
    targetLinkId: link.id,
    mergedIntoId: null,
    strength: 0,
    originPublisherId: null,
    textBasis: 'slug',
    embeddingText: 'Version release',
    embeddingTextExpiresAt: null,
    embedding: vector,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embeddingVersion: EMBEDDING_VERSION,
    embeddedAt: at,
    createdAt: at,
  }))
  const user = { id: '00000000-0000-4000-8000-000000000001', timezone: 'UTC', cutHour: 23, createdAt: at }
  const statement = 'Software releases'
  const interest = {
    id: '00000000-0000-4000-8000-000000000002',
    userId: user.id,
    statement,
    embedding: vector,
    embeddingInputHash: createHash('sha256').update(statement).digest('hex'),
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embeddingVersion: EMBEDDING_VERSION,
    embeddedAt: at,
    createdAt: at,
    updatedAt: at,
  }
  const results: unknown[][] = [
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    links,
    [],
    withReader ? [user] : [],
    withReader ? [interest] : [],
    [],
    [],
    [],
    [],
    [],
  ]
  const select = database.select.bind(database)
  vi.spyOn(database, 'select').mockImplementation((() => {
    return { from: (table: unknown) => {
      if (table === signalTable)
        return select().from(signalTable)
      const result = Promise.resolve(results.shift() ?? [])
      return Object.assign(result, { innerJoin: () => result, where: () => result })
    } }
  }) as unknown as typeof database.select)

  const commands: string[] = []
  const release = vi.fn()
  const connection = {
    query: async (text: string, params: unknown[] = []) => {
      expect(params.length).toBeLessThanOrEqual(65535)
      commands.push(text)
      if (failWrite && commands.length === 3)
        throw new Error('Injected write failure')
      return { rows: [] }
    },
    release,
  } as unknown as PoolClient
  vi.spyOn(Pool.prototype, 'connect').mockImplementation((async () => connection) as unknown as typeof Pool.prototype.connect)
  const end = vi.spyOn(Pool.prototype, 'end').mockResolvedValue()
  vi.spyOn(database.$client, 'query').mockImplementation(((query: string, params: unknown[]) => {
    if (query.startsWith('select')) {
      const limit = query.includes(' limit ') ? Number(params.at(-1)) : signals.length
      const cursor = query.includes(' where ') ? String(params[0]) : ''
      const rows = signals.filter(signal => signal.id > cursor).slice(0, limit).map(signal => [
        signal.id,
        signal.targetLinkId,
        signal.mergedIntoId,
        signal.strength,
        signal.originPublisherId,
        signal.textBasis,
        signal.embeddingText,
        signal.embeddingTextExpiresAt,
        JSON.stringify(signal.embedding),
        signal.embeddingModel,
        signal.embeddingDimensions,
        signal.embeddingVersion,
        at.toISOString(),
        at.toISOString(),
      ])
      if (Buffer.byteLength(JSON.stringify({ rows })) > 64 * 1024 * 1024)
        throw new Error('HTTP response exceeds 67108864 bytes')
      return Promise.resolve({ rows })
    }
    const data = { query, params }
    return data
  }) as unknown as typeof database.$client.query)
  vi.spyOn(database.$client, 'transaction').mockImplementation((async (queries: unknown) => {
    if (Buffer.byteLength(JSON.stringify({ queries })) > 64 * 1024 * 1024)
      throw new Error('HTTP 413: request is too large (max is 67108864 bytes)')
    return []
  }) as typeof database.$client.transaction)

  const run = runNeonIngestion(at, database, async () => {
    throw new Error('No fetch expected')
  }, {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed: async () => { throw new Error('Stored embeddings must be reused') },
  })

  if (failWrite) {
    await expect(run).rejects.toThrow('Injected write failure')
    expect(commands.at(-1)).toBe('ROLLBACK')
    expect(commands).not.toContain('COMMIT')
    expect(release).toHaveBeenCalledWith(true)
    expect(end).toHaveBeenCalledOnce()
    return
  }
  const graph = await run
  expect(graph.signals).toHaveLength(count)
  expect(graph.readerSignalMatches).toHaveLength(withReader ? count : 0)
  expect(commands[0]).toBe('BEGIN')
  expect(commands.at(-1)).toBe('COMMIT')
  expect(commands.filter(command => command === 'BEGIN')).toHaveLength(1)
  expect(commands.filter(command => command === 'COMMIT')).toHaveLength(1)
  expect(release).toHaveBeenCalledOnce()
  expect(release).toHaveBeenCalledWith(false)
  expect(end).toHaveBeenCalledOnce()
}, 20_000)
