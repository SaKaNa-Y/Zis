import { verify } from '@node-rs/argon2'
import { postgresCredentialStore } from './postgres'
import 'server-only'

export const MAX_PASSPHRASE_BYTES = 1024

export interface ReservedCredential {
  userId: string
  passphraseHash: string
  sessionVersion: number
}

export interface CredentialIdentity {
  userId: string
  sessionVersion: number
}

export type HashVerifier = (hash: string, passphrase: string) => Promise<boolean>

export interface CredentialStore {
  authenticate: (
    passphrase: string,
    verifyHash: HashVerifier,
  ) => Promise<CredentialIdentity | null>
}

export type AuthenticationResult = {
  authenticated: true
  userId: string
  sessionVersion: number
} | {
  authenticated: false
}

export interface AuthenticateDependencies {
  store: CredentialStore
  verifyHash?: HashVerifier
}

const failed = (): AuthenticationResult => ({ authenticated: false })

export async function authenticatePassphrase(
  passphrase: string,
  dependencies: AuthenticateDependencies = { store: postgresCredentialStore },
): Promise<AuthenticationResult> {
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength
  if (passphraseBytes === 0 || passphraseBytes > MAX_PASSPHRASE_BYTES)
    return failed()

  try {
    const identity = await dependencies.store.authenticate(
      passphrase,
      dependencies.verifyHash ?? verify,
    )
    if (identity === null)
      return failed()

    return { authenticated: true, ...identity }
  }
  catch {
    return failed()
  }
}
