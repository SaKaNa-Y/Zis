import type {
  CredentialIdentity,
  CredentialStore,
  HashVerifier,
  ReservedCredential,
} from './credentials'
import { Pool } from '@neondatabase/serverless'
import { hash } from '@node-rs/argon2'
import { databaseUrl } from '@/lib/env'
import 'server-only'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_SECONDS = 15 * 60

export interface CredentialTransactionClient {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>
}

export class CredentialActionError extends Error {}

interface PassphraseReplacement {
  identity: CredentialIdentity
  newPassphrase: string
}

function credentialFrom(row: Record<string, unknown> | undefined): ReservedCredential | null {
  if (row === undefined)
    return null
  if (typeof row.id !== 'string' || typeof row.passphrase_hash !== 'string')
    throw new Error('Stored credential has an invalid shape')
  if (!Number.isSafeInteger(row.session_version) || (row.session_version as number) < 0)
    throw new Error('Stored session version has an invalid shape')

  return {
    passphraseHash: row.passphrase_hash,
    sessionVersion: row.session_version as number,
    userId: row.id,
  }
}

function identityFrom(row: Record<string, unknown> | undefined): CredentialIdentity | null {
  if (row === undefined)
    return null
  if (typeof row.id !== 'string')
    throw new Error('Authenticated identity has an invalid shape')
  if (!Number.isSafeInteger(row.session_version) || (row.session_version as number) < 0)
    throw new Error('Authenticated session version has an invalid shape')

  return { userId: row.id, sessionVersion: row.session_version as number }
}

/**
 * Serializes every login against the single reader row. Argon2 intentionally
 * runs while the row lock is held, so a stale success cannot erase failures or
 * a lock created by a later attempt.
 */
export async function runCredentialAttemptTransaction(
  client: CredentialTransactionClient,
  passphrase: string,
  verifyHash: HashVerifier,
  replacement?: PassphraseReplacement,
): Promise<CredentialIdentity | null> {
  await client.query('BEGIN')

  try {
    const selected = await client.query(`
      SELECT "id", "passphrase_hash", "session_version"
      FROM "user"
      WHERE "id" = (SELECT singleton."id" FROM "user" AS singleton)
        AND ("locked_until" IS NULL OR "locked_until" <= CURRENT_TIMESTAMP)
      FOR UPDATE
    `)
    const credential = credentialFrom(selected.rows[0])

    if (credential === null) {
      await client.query('COMMIT')
      return null
    }

    if (replacement && (credential.userId !== replacement.identity.userId || credential.sessionVersion !== replacement.identity.sessionVersion))
      throw new CredentialActionError('Your session has expired. Sign in again.')

    let matches = false
    try {
      matches = await verifyHash(credential.passphraseHash, passphrase)
    }
    catch {
      // A malformed stored digest must fail exactly like a wrong credential and
      // still consume an attempt; the public surface reveals neither condition.
    }

    if (!matches) {
      await client.query(`
        UPDATE "user"
        SET
          "failed_attempts" = CASE
            WHEN "locked_until" IS NOT NULL THEN 1
            ELSE "failed_attempts" + 1
          END,
          "locked_until" = CASE
            WHEN (
              CASE
                WHEN "locked_until" IS NOT NULL THEN 1
                ELSE "failed_attempts" + 1
              END
            ) >= $2
              THEN CURRENT_TIMESTAMP + make_interval(secs => $3::integer)
            ELSE NULL
          END
        WHERE "id" = $1::uuid
      `, [credential.userId, MAX_FAILED_ATTEMPTS, LOCKOUT_SECONDS])
      await client.query('COMMIT')
      return null
    }

    const newHash = replacement
      ? await hash(replacement.newPassphrase, { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 1, outputLen: 32 })
      : undefined
    const completed = newHash === undefined
      ? await client.query(`
      UPDATE "user"
      SET "failed_attempts" = 0, "locked_until" = NULL
      WHERE "id" = $1::uuid
        AND "passphrase_hash" = $2
        AND "session_version" = $3
      RETURNING "id", "session_version"
    `, [credential.userId, credential.passphraseHash, credential.sessionVersion])
      : await client.query(`
      UPDATE "user"
      SET "passphrase_hash" = $4, "session_version" = "session_version" + 1,
          "failed_attempts" = 0, "locked_until" = NULL
      WHERE "id" = $1::uuid AND "passphrase_hash" = $2 AND "session_version" = $3
      RETURNING "id", "session_version"
    `, [credential.userId, credential.passphraseHash, credential.sessionVersion, newHash])
    const identity = identityFrom(completed.rows[0])
    await client.query('COMMIT')
    return identity
  }
  catch (error) {
    try {
      await client.query('ROLLBACK')
    }
    catch {
      // Preserve the original failure; the connection is discarded below.
    }
    throw error
  }
}

export async function withCredentialClient<T>(operation: (client: CredentialTransactionClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl() })

  try {
    const client = await pool.connect()
    try {
      return await operation({
        query: async (text, values) => {
          const result = await client.query(text, values)
          return { rows: result.rows as Record<string, unknown>[] }
        },
      })
    }
    finally {
      client.release()
    }
  }
  finally {
    await pool.end()
  }
}

export const postgresCredentialStore: CredentialStore = {
  authenticate: (passphrase, verifyHash) => withCredentialClient(client => runCredentialAttemptTransaction(client, passphrase, verifyHash)),
}
