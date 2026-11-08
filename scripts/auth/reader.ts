import { readFileSync } from 'node:fs'
import process from 'node:process'
import { Pool } from '@neondatabase/serverless'
import { verify } from '@node-rs/argon2'
import { databaseUrl } from '../../src/lib/env'
import { hashPassphrase } from './hash-passphrase'

async function main() {
  const action = process.argv[2]
  if (process.argv.length !== 3 || (action !== 'issue' && action !== 'revoke'))
    throw new Error('Usage: tsx scripts/auth/reader.ts issue|revoke')
  if (action === 'issue' && process.stdin.isTTY)
    throw new Error('Pipe a securely prompted reader passphrase over stdin')
  const passphrase = action === 'issue' ? readFileSync(0, 'utf8').replace(/\r?\n$/, '') : ''
  const hash = action === 'issue' ? await hashPassphrase(passphrase) : null
  const pool = new Pool({ connectionString: databaseUrl() })
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Serialize issuance with account changes as well as other operators.
      await client.query('LOCK TABLE "user" IN EXCLUSIVE MODE')
      if (action === 'issue') {
        const { rows } = await client.query<{ passphrase_hash: string }>('SELECT passphrase_hash FROM "user" WHERE role = \'author\'')
        const [author] = rows
        if (!author || await verify(author.passphrase_hash, passphrase))
          throw new Error('A distinct reader passphrase and an existing author are required')
        await client.query(`
          INSERT INTO "user" (role, passphrase_hash) VALUES ('reader', $1)
          ON CONFLICT (role) DO UPDATE SET passphrase_hash = EXCLUDED.passphrase_hash,
            session_version = "user".session_version + 1, revoked_at = NULL,
            failed_attempts = 0, locked_until = NULL
        `, [hash])
      }
      else {
        await client.query(`UPDATE "user" SET revoked_at = now(), session_version = session_version + 1
          WHERE role = 'reader' AND revoked_at IS NULL`)
      }
      await client.query('COMMIT')
    }
    catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    finally {
      client.release()
    }
  }
  finally {
    await pool.end()
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Reader provisioning failed'}\n`)
  process.exitCode = 1
})
