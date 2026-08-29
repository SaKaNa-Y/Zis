import type { Database } from '@/lib/db'
import { describe, expect, it } from 'vitest'
import { runNeonIngestion } from './postgres'

function databaseReturning(...results: unknown[][]): Database {
  const queued = [...results]
  return {
    select: () => {
      const result = Promise.resolve(queued.shift() ?? [])
      return Object.assign(result, {
        from: () => Object.assign(result, {
          innerJoin: () => result,
          where: () => result,
        }),
      })
    },
  } as unknown as Database
}

describe('the production ingestion startup assertion', () => {
  it('fails the run before selecting due Sources when an RSS Item host has no owner', async () => {
    const database = databaseReturning(
      [{
        itemUrl: 'https://unregistered.example/post',
        publisherId: 'publisher-1',
        sourceId: 'source-1',
        transport: 'rss',
      }],
      [],
    )

    await expect(
      runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database),
    )
      .rejects
      .toThrow('host ownership assertion failed')
  })

  it('reports an enabled dormant Source even when origin backoff makes it not due', async () => {
    const database = databaseReturning(
      [],
      [{ host: 'publisher.example', publisherId: 'publisher-1' }],
      [],
      [],
      [{ id: 'source-dormant' }],
    )

    const graph = await runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database)

    expect(graph.sources).toEqual([])
    expect(graph.dormantSourceIds).toEqual(['source-dormant'])
  })
})
