import type { CredentialTransactionClient } from './postgres'
import { describe, expect, it, vi } from 'vitest'
import {
  LOCKOUT_SECONDS,
  MAX_FAILED_ATTEMPTS,
  runCredentialAttemptTransaction,
} from './postgres'

vi.mock('server-only', () => ({}))

const USER_ID = '00000000-0000-4000-8000-000000000075'
const HASH = '$argon2id$v=19$m=65536,t=3,p=1$fixture'

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

class RecordingClient implements CredentialTransactionClient {
  commands: string[] = []
  locked = false
  failOnFailureUpdate = false

  async query(text: string, values: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    const command = normalized(text)
    this.commands.push(command)

    if (command.startsWith('SELECT')) {
      return {
        rows: this.locked
          ? []
          : [{ id: USER_ID, passphrase_hash: HASH, session_version: 7 }],
      }
    }

    if (command.includes('SET "failed_attempts" = 0')) {
      expect(values).toEqual([USER_ID, HASH, 7])
      return { rows: [{ id: USER_ID, session_version: 7 }] }
    }

    if (command.includes('SET "failed_attempts"')) {
      if (this.failOnFailureUpdate)
        throw new Error('database unavailable')
      expect(values).toEqual([USER_ID, MAX_FAILED_ATTEMPTS, LOCKOUT_SECONDS])
      return { rows: [] }
    }

    return { rows: [] }
  }
}

describe('the Postgres credential transaction', () => {
  it('holds the reader row lock through Argon2 verification and success reset', async () => {
    const client = new RecordingClient()
    const verifyHash = vi.fn(async () => {
      expect(client.commands).toHaveLength(2)
      expect(client.commands[0]).toBe('BEGIN')
      expect(client.commands[1]).toContain('FOR UPDATE')
      return true
    })

    await expect(runCredentialAttemptTransaction(client, 'generated secret', verifyHash))
      .resolves
      .toEqual({ userId: USER_ID, sessionVersion: 7 })
    expect(client.commands.at(-1)).toBe('COMMIT')
  })

  it('records a failed verification before committing the transaction', async () => {
    const client = new RecordingClient()

    await expect(runCredentialAttemptTransaction(client, 'wrong secret', async () => false))
      .resolves
      .toBeNull()
    expect(client.commands[2]).toContain('SET "failed_attempts"')
    expect(client.commands[2]).toContain('WHEN "locked_until" IS NOT NULL THEN 1')
    expect(client.commands[2]).toContain('>= $2')
    expect(client.commands[2]).toContain('make_interval(secs => $3::integer)')
    expect(client.commands.at(-1)).toBe('COMMIT')
  })

  it('counts a malformed stored digest as the same generic failed attempt', async () => {
    const client = new RecordingClient()

    await expect(runCredentialAttemptTransaction(client, 'generated secret', async () => {
      throw new Error('invalid hash')
    }))
      .resolves
      .toBeNull()
    expect(client.commands[2]).toContain('SET "failed_attempts"')
    expect(client.commands.at(-1)).toBe('COMMIT')
  })

  it('does no Argon2 work while the account is locked', async () => {
    const client = new RecordingClient()
    client.locked = true
    const verifyHash = vi.fn(async () => true)

    await expect(runCredentialAttemptTransaction(client, 'generated secret', verifyHash))
      .resolves
      .toBeNull()
    expect(verifyHash).not.toHaveBeenCalled()
    expect(client.commands).toEqual([
      'BEGIN',
      expect.stringContaining('FOR UPDATE'),
      'COMMIT',
    ])
  })

  it('rolls back database failures instead of swallowing them as a commit', async () => {
    const client = new RecordingClient()
    client.failOnFailureUpdate = true

    await expect(runCredentialAttemptTransaction(client, 'wrong secret', async () => false))
      .rejects
      .toThrow('database unavailable')
    expect(client.commands.at(-1)).toBe('ROLLBACK')
  })
})
