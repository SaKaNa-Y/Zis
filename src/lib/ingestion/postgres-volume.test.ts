import type { PoolClient } from '@neondatabase/serverless'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { Pool } from '@neondatabase/serverless'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { readerMatchProfiles, readerSignalMatches, signals as signalTable } from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runNeonIngestion } from './postgres'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it.each([
  { name: 'commits new embeddings larger than the Neon HTTP limit atomically', count: 6000, failWrite: false, withReader: false, stored: false },
  { name: 'rolls back new embeddings when a streamed statement fails', count: 6000, failWrite: true, withReader: false, stored: false },
  { name: 'keeps a large reader match set below the Postgres parameter limit', count: 12000, failWrite: false, withReader: true, stored: false },
  { name: 'pages missing-match vectors once and transfers none on the unchanged wake', count: 10000, failWrite: false, withReader: true, stored: true },
])('$name', async ({ count, failWrite, withReader, stored }) => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test')
  const database = db()
  const at = new Date('2026-09-05T08:00:00Z')
  const vector = Array.from(new Float32Array(EMBEDDING_DIMENSIONS).fill(withReader && !stored ? 0 : 1 / Math.sqrt(EMBEDDING_DIMENSIONS)))
  if (withReader && !stored)
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
  const initialResults = (): unknown[][] => [
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
  let results = initialResults()
  let warmGraph: Awaited<ReturnType<typeof runNeonIngestion>> | undefined
  const select = database.select.bind(database)
  vi.spyOn(database, 'select').mockImplementation(((fields: Parameters<typeof database.select>[0]) => {
    return { from: (table: unknown) => {
      if (table === signalTable)
        return select(fields).from(signalTable)
      const queued = results.shift() ?? []
      const result = Promise.resolve(table === readerMatchProfiles && warmGraph !== undefined
        ? warmGraph.readerMatchProfiles
        : table === readerSignalMatches && warmGraph !== undefined ? warmGraph.readerSignalMatches : queued)
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
  let vectorRowsRead = 0
  let vectorBytesRead = 0
  let metadataBytesRead = 0
  const writeQueries: string[] = []
  vi.spyOn(database.$client, 'query').mockImplementation(((query: string, params: unknown[]) => {
    if (query.startsWith('select')) {
      if (!query.includes('CASE WHEN')) {
        const rows = signals.filter(signal => params.includes(signal.id)).map(signal => [signal.id, JSON.stringify(vector)])
        vectorRowsRead += rows.length
        const bytes = Buffer.byteLength(JSON.stringify({ rows }))
        vectorBytesRead += bytes
        if (bytes > 64 * 1024 * 1024)
          throw new Error('HTTP response exceeds 67108864 bytes')
        return Promise.resolve({ rows })
      }
      const limit = query.includes(' limit ') ? Number(params.at(-1)) : signals.length
      const cursor = query.includes(' where ') ? String(params[0]) : ''
      const rows = signals.filter(signal => signal.id > cursor).slice(0, limit).map(signal => [
        signal.id,
        signal.targetLinkId,
        signal.mergedIntoId,
        signal.strength,
        signal.originPublisherId,
        stored ? signal.textBasis : null,
        stored ? signal.embeddingText : null,
        signal.embeddingTextExpiresAt,
        stored ? { stored: true } : null,
        stored ? signal.embeddingModel : null,
        stored ? signal.embeddingDimensions : null,
        stored ? signal.embeddingVersion : null,
        stored ? new Date(at.getTime() - 1000).toISOString() : null,
        at.toISOString(),
      ])
      const bytes = Buffer.byteLength(JSON.stringify({ rows }))
      metadataBytesRead += bytes
      if (bytes > 64 * 1024 * 1024)
        throw new Error('HTTP response exceeds 67108864 bytes')
      return Promise.resolve({ rows })
    }
    writeQueries.push(query)
    const data = { query, params }
    return data
  }) as unknown as typeof database.$client.query)
  vi.spyOn(database.$client, 'transaction').mockImplementation((async (queries: unknown) => {
    if (Buffer.byteLength(JSON.stringify({ queries })) > 64 * 1024 * 1024)
      throw new Error('HTTP 413: request is too large (max is 67108864 bytes)')
    return []
  }) as typeof database.$client.transaction)

  const run = () => runNeonIngestion(at, database, async () => {
    throw new Error('No fetch expected')
  }, {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed: async (texts) => {
      if (stored)
        throw new Error('Stored embeddings must be reused')
      return texts.map(() => new Float32Array(vector))
    },
  })

  if (failWrite) {
    const error = await run().then(() => null, error => error)
    expect(error?.message).toBe('Injected write failure')
    expect(commands.at(-1)).toBe('ROLLBACK')
    expect(commands).not.toContain('COMMIT')
    expect(release).toHaveBeenCalledWith(true)
    expect(end).toHaveBeenCalledOnce()
    return
  }
  const graph = await run()
  expect(graph.signals).toHaveLength(count)
  expect(graph.readerSignalMatches).toHaveLength(withReader ? count : 0)
  if (stored) {
    expect(vectorRowsRead).toBe(count)
    expect(vectorBytesRead).toBeGreaterThan(64 * 1024 * 1024)
    expect(metadataBytesRead).toBeLessThan(vectorBytesRead / 10)
    warmGraph = graph
    results = initialResults()
    vectorRowsRead = 0
    writeQueries.length = 0
    await run()
    expect(vectorRowsRead).toBe(0)
    expect(writeQueries.some(query => query.startsWith('insert'))).toBe(false)
    expect(commands).toEqual([])
    return
  }
  expect(commands[0]).toBe('BEGIN')
  expect(commands.at(-1)).toBe('COMMIT')
  expect(commands.filter(command => command === 'BEGIN')).toHaveLength(1)
  expect(commands.filter(command => command === 'COMMIT')).toHaveLength(1)
  expect(release).toHaveBeenCalledOnce()
  expect(release).toHaveBeenCalledWith(false)
  expect(end).toHaveBeenCalledOnce()
}, 20_000)
