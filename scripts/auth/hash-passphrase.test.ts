import { verify } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'
import { hashPassphrase } from './hash-passphrase'

describe('the local passphrase hashing helper', () => {
  it('produces a production-cost Argon2id digest without retaining plaintext', async () => {
    const passphrase = 'test-only-generated-secret-000075'
    const digest = await hashPassphrase(passphrase)

    expect(digest).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/)
    await expect(verify(digest, passphrase)).resolves.toBe(true)
    expect(digest).not.toContain(passphrase)
  })

  it('refuses a short operator credential', async () => {
    await expect(hashPassphrase('too-short')).rejects.toThrow('at least 32 bytes')
  })
})
