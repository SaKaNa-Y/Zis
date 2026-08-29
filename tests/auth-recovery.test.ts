import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const securityModel = readFileSync(join(root, 'docs', 'security-model.md'), 'utf8')
const recoverySection = securityModel.slice(
  securityModel.indexOf('### 6.2 Recovery'),
  securityModel.indexOf('### 6.3'),
)

describe('credential recovery remains outside the application', () => {
  it('documents one revocation-safe Neon UPDATE', () => {
    expect(recoverySection.match(/UPDATE "user"/g)).toHaveLength(1)
    expect(recoverySection).toContain('"passphrase_hash" =')
    expect(recoverySection).toContain('"session_version" = "session_version" + 1')
    expect(recoverySection).toContain('"failed_attempts" = 0')
    expect(recoverySection).toContain('"locked_until" = NULL')
  })

  it('uses the stdin-only helper so plaintext never becomes a command argument', () => {
    expect(recoverySection).toContain('Read-Host')
    expect(recoverySection).toContain('scripts/auth/hash-passphrase.ts')
    expect(recoverySection).not.toContain('hash-passphrase.ts \'')
  })
})
