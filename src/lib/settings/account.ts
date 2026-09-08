import type { CredentialIdentity } from '@/lib/auth/credentials'
import type { CredentialTransactionClient } from '@/lib/auth/postgres'
import { verify } from '@node-rs/argon2'
import { MAX_PASSPHRASE_BYTES } from '@/lib/auth/credentials'
import { CredentialActionError, runCredentialAttemptTransaction } from '@/lib/auth/postgres'
import 'server-only'

export interface PassphraseChange {
  currentPassphrase: string
  newPassphrase: string
  confirmation: string
}

export function createAccountSettings(dependencies: {
  verifySession: () => Promise<CredentialIdentity>
  withClient: <T>(operation: (client: CredentialTransactionClient) => Promise<T>) => Promise<T>
}) {
  return {
    async signOutEverywhere() {
      const identity = await dependencies.verifySession()
      const result = await dependencies.withClient(client => client.query(`
        UPDATE "user" SET "session_version" = "session_version" + 1
        WHERE "id" = $1::uuid AND "session_version" = $2 RETURNING "id"
      `, [identity.userId, identity.sessionVersion]))
      if (result.rows.length !== 1)
        throw new CredentialActionError('Your session has expired. Sign in again.')
    },
    async changePassphrase(input: PassphraseChange) {
      const identity = await dependencies.verifySession()
      const encoder = new TextEncoder()
      const size = encoder.encode(input.newPassphrase).byteLength
      if (size < 32 || size > MAX_PASSPHRASE_BYTES)
        throw new CredentialActionError('Use a password-manager-generated passphrase of 32–1024 UTF-8 bytes (32 or more ASCII characters).')
      if (input.newPassphrase !== input.confirmation)
        throw new CredentialActionError('The new passphrases must match.')
      if (input.currentPassphrase === '' || encoder.encode(input.currentPassphrase).byteLength > MAX_PASSPHRASE_BYTES)
        throw new CredentialActionError('Enter your current passphrase (up to 1024 UTF-8 bytes).')
      const changed = await dependencies.withClient(client => runCredentialAttemptTransaction(client, input.currentPassphrase, verify, { identity, newPassphrase: input.newPassphrase }))
      if (changed === null)
        throw new CredentialActionError('The current passphrase is incorrect or verification is temporarily locked. If locked, try again in 15 minutes.')
    },
  }
}
