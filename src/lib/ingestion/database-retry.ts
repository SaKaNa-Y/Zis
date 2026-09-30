import type { Database, DatabaseStatement } from '@/lib/db'
import { setTimeout } from 'node:timers/promises'
import { NeonDbError } from '@neondatabase/serverless'

export interface DatabaseRetryEvent {
  operation: 'source' | 'final' | 'retention' | 'robots'
  /** The attempt about to start; the initial attempt is 1. */
  attempt: 2 | 3
  delayMs: number
  reason: 'transport' | 'serialization' | 'deadlock'
}

export interface IngestionDatabaseRetryOptions {
  onDatabaseRetry?: (event: DatabaseRetryEvent) => void
  waitBeforeDatabaseRetry?: (delayMs: number) => Promise<void>
}

const transportCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  '08000',
  '08001',
  '08003',
  '08006',
  '08007',
])

function retryReason(error: unknown): DatabaseRetryEvent['reason'] | undefined {
  const seen = new Set<unknown>()
  let current = error
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    const code = 'code' in current ? current.code : undefined
    if (code === '40001')
      return 'serialization'
    if (code === '40P01')
      return 'deadlock'
    if (typeof code === 'string' && transportCodes.has(code))
      return 'transport'
    // A SQL error is a server verdict, not a lost transport acknowledgement.
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code))
      return undefined
    if (current instanceof NeonDbError
      && current.sourceError instanceof TypeError
      && current.sourceError.message === 'fetch failed'
      && current.sourceError.cause === undefined) {
      return 'transport'
    }
    if (current.message === 'Connection terminated unexpectedly'
      || current.message === 'Connection terminated due to connection timeout') {
      return 'transport'
    }
    current = current instanceof NeonDbError ? current.sourceError ?? current.cause : current.cause
  }
  return undefined
}

/** Only call for ingestion batches whose entire transaction is replay-safe. */
export async function commitIngestionStatements(
  database: Pick<Database, 'commit'>,
  statements: DatabaseStatement[],
  operation: DatabaseRetryEvent['operation'],
  options: IngestionDatabaseRetryOptions = {},
): Promise<void> {
  const delays = [1000, 3000] as const
  for (let attempt = 0; ; attempt++) {
    try {
      // Keep the exact compiled SQL, parameters, IDs and timestamps on replay.
      await database.commit(statements)
      return
    }
    catch (error) {
      const reason = retryReason(error)
      const delayMs = delays[attempt]
      if (reason === undefined || delayMs === undefined)
        throw error
      options.onDatabaseRetry?.({ operation, attempt: attempt === 0 ? 2 : 3, delayMs, reason })
      await (options.waitBeforeDatabaseRetry ?? setTimeout)(delayMs)
    }
  }
}
