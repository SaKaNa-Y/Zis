import type {
  CredentialIdentity,
  CredentialStore,
  HashVerifier,
  ReservedCredential,
} from './credentials'
import { describe, expect, it, vi } from 'vitest'
import {
  authenticatePassphrase,
  MAX_PASSPHRASE_BYTES,
} from './credentials'

vi.mock('server-only', () => ({}))

const USER_ID = '00000000-0000-4000-8000-000000000075'
const PASSPHRASE_HASH = '$argon2id$v=19$m=8192,t=1,p=1$MDEyMzQ1Njc4OWFiY2RlZg$E00YDK579zCFKHdylDWWbt4Db/32fqyFEYPCGpqFXXw'

class MemoryCredentialStore implements CredentialStore {
  private credential: ReservedCredential | null

  constructor(credential: ReservedCredential | null) {
    this.credential = credential
  }

  async authenticate(
    passphrase: string,
    verifyHash: HashVerifier,
  ): Promise<CredentialIdentity | null> {
    const attempt = this.credential === null ? null : { ...this.credential }
    if (attempt === null)
      return null

    let matches = false
    try {
      matches = await verifyHash(attempt.passphraseHash, passphrase)
    }
    catch {
      return null
    }

    if (!matches
      || this.credential === null
      || this.credential.userId !== attempt.userId
      || this.credential.passphraseHash !== attempt.passphraseHash
      || this.credential.sessionVersion !== attempt.sessionVersion) {
      return null
    }

    return {
      userId: attempt.userId,
      sessionVersion: attempt.sessionVersion,
    }
  }

  recover(newHash: string): void {
    if (this.credential === null)
      return
    this.credential = {
      ...this.credential,
      passphraseHash: newHash,
      sessionVersion: this.credential.sessionVersion + 1,
    }
  }
}

function availableStore(): MemoryCredentialStore {
  return new MemoryCredentialStore({
    passphraseHash: PASSPHRASE_HASH,
    sessionVersion: 4,
    userId: USER_ID,
  })
}

describe('single-reader passphrase authentication', () => {
  it('returns the current revocation version for a valid Argon2id credential', async () => {
    const result = await authenticatePassphrase('correct horse battery staple', {
      store: availableStore(),
    })

    expect(result).toEqual({
      authenticated: true,
      sessionVersion: 4,
      userId: USER_ID,
    })
  })

  it('returns one generic failure for a wrong passphrase, a lock, or a malformed hash', async () => {
    const cases = [
      authenticatePassphrase('wrong passphrase', { store: availableStore() }),
      authenticatePassphrase('correct horse battery staple', {
        store: new MemoryCredentialStore(null),
      }),
      authenticatePassphrase('correct horse battery staple', {
        store: new MemoryCredentialStore({
          passphraseHash: 'not-an-argon2-hash',
          sessionVersion: 4,
          userId: USER_ID,
        }),
      }),
    ]

    await expect(Promise.all(cases)).resolves.toEqual([
      { authenticated: false },
      { authenticated: false },
      { authenticated: false },
    ])
  })

  it('does not authenticate an old credential across a recovery version bump', async () => {
    const store = availableStore()
    const result = await authenticatePassphrase('correct horse battery staple', {
      store,
      verifyHash: async () => {
        store.recover('$argon2id$v=19$m=65536,t=3,p=1$replacement')
        return true
      },
    })

    expect(result).toEqual({ authenticated: false })
  })

  it('rejects empty and oversized input before Argon2 work', async () => {
    const store = availableStore()
    const verifyHash = vi.fn(async () => true)

    await expect(authenticatePassphrase('', { store, verifyHash }))
      .resolves
      .toEqual({ authenticated: false })
    await expect(authenticatePassphrase('a'.repeat(MAX_PASSPHRASE_BYTES + 1), { store, verifyHash }))
      .resolves
      .toEqual({ authenticated: false })
    expect(verifyHash).not.toHaveBeenCalled()
  })
})
