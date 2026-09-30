import type { DatabaseStatement } from '@/lib/db'
import { NeonDbError } from '@neondatabase/serverless'
import { describe, expect, it, vi } from 'vitest'
import { commitIngestionStatements } from './database-retry'

function connectionFailure() {
  const error = new NeonDbError('Error connecting to database: fetch failed')
  error.sourceError = new TypeError('fetch failed')
  return error
}

const statements: DatabaseStatement[] = [{ sql: 'SELECT $1::text', params: ['private test value'] }]

describe('ingestion database commit recovery', () => {
  it('reuses one compiled batch for at most three attempts and reports only safe metadata', async () => {
    const error = connectionFailure()
    const database = { commit: vi.fn().mockRejectedValue(error) }
    const onDatabaseRetry = vi.fn()
    const waitBeforeDatabaseRetry = vi.fn(async () => {})
    await expect(commitIngestionStatements(database, statements, 'source', { onDatabaseRetry, waitBeforeDatabaseRetry })).rejects.toBe(error)
    expect(database.commit).toHaveBeenCalledTimes(3)
    for (const [batch] of database.commit.mock.calls)
      expect(batch).toBe(statements)
    expect(waitBeforeDatabaseRetry.mock.calls).toEqual([[1000], [3000]])
    expect(onDatabaseRetry.mock.calls).toEqual([
      [{ operation: 'source', attempt: 2, delayMs: 1000, reason: 'transport' }],
      [{ operation: 'source', attempt: 3, delayMs: 3000, reason: 'transport' }],
    ])
  })

  it.each([
    ['40001', 'serialization'],
    ['40P01', 'deadlock'],
    ['ECONNRESET', 'transport'],
    ['08006', 'transport'],
  ])('recovers a transient %s failure, including wrapped driver errors', async (code, reason) => {
    const failure = new Error('Database call failed', { cause: Object.assign(new Error('driver failure'), { code }) })
    const database = { commit: vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined) }
    const onDatabaseRetry = vi.fn()
    await commitIngestionStatements(database, statements, 'final', { onDatabaseRetry, waitBeforeDatabaseRetry: async () => {} })
    expect(database.commit).toHaveBeenCalledTimes(2)
    expect(onDatabaseRetry).toHaveBeenCalledExactlyOnceWith({ operation: 'final', attempt: 2, delayMs: 1000, reason })
  })

  it.each([
    Object.assign(new Error('unique violation'), { code: '23505' }),
    Object.assign(new Error('permission denied'), { code: '42501' }),
    Object.assign(new Error('syntax error'), { code: '42601' }),
    Object.assign(new Error('Interest Profile changed during computation; reload and retry'), { code: '22P02' }),
    Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' }),
    new TypeError('fetch failed'),
    new Error('programming failure'),
  ])('does not retry permanent or unrecognized failures: %s', async (failure) => {
    const database = { commit: vi.fn().mockRejectedValue(failure) }
    const waitBeforeDatabaseRetry = vi.fn(async () => {})
    const onDatabaseRetry = vi.fn()
    await expect(commitIngestionStatements(database, statements, 'final', { onDatabaseRetry, waitBeforeDatabaseRetry })).rejects.toBe(failure)
    expect(database.commit).toHaveBeenCalledTimes(1)
    expect(waitBeforeDatabaseRetry).not.toHaveBeenCalled()
    expect(onDatabaseRetry).not.toHaveBeenCalled()
  })

  it('does not retry a permanent TLS error hidden inside Neon fetch failed', async () => {
    const failure = connectionFailure()
    failure.sourceError!.cause = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
    const database = { commit: vi.fn().mockRejectedValue(failure) }
    await expect(commitIngestionStatements(database, statements, 'source')).rejects.toBe(failure)
    expect(database.commit).toHaveBeenCalledTimes(1)
  })
})
