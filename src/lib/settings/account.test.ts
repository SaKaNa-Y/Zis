import { PGlite } from '@electric-sql/pglite'
import { hash, verify } from '@node-rs/argon2'
import { afterEach, expect, it, vi } from 'vitest'
import { runCredentialAttemptTransaction } from '@/lib/auth/postgres'
import { createAccountSettings } from './account'

vi.mock('server-only', () => ({}))

const USER_ID = '00000000-0000-4000-8000-000000000095'
const OLD = 'old-generated-test-secret-0123456789'
const NEW = 'new-generated-test-secret-0123456789'
const databases: PGlite[] = []
afterEach(async () => {
  await Promise.all(databases.splice(0).map(pg => pg.close()))
})

async function fixture() {
  const pg = await PGlite.create()
  databases.push(pg)
  await pg.exec(`CREATE TABLE "user" (
    id uuid PRIMARY KEY, passphrase_hash text NOT NULL,
    session_version integer NOT NULL DEFAULT 0,
    failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz
  )`)
  await pg.query('INSERT INTO "user" (id, passphrase_hash) VALUES ($1, $2)', [USER_ID, await hash(OLD)])
  const identity = { userId: USER_ID, sessionVersion: 0 }
  const settings = createAccountSettings({
    verifySession: async () => identity,
    withClient: operation => operation(pg),
  })
  const login = (secret: string) => runCredentialAttemptTransaction(pg, secret, verify)
  return { pg, settings, login, identity }
}

it('changes the credential and revokes all existing sessions together', async () => {
  const { settings, login } = await fixture()
  await settings.changePassphrase({ currentPassphrase: OLD, newPassphrase: NEW, confirmation: NEW })
  expect(await login(OLD)).toBeNull()
  expect(await login(NEW)).toEqual({ userId: USER_ID, sessionVersion: 1 })
  await expect(settings.changePassphrase({ currentPassphrase: NEW, newPassphrase: OLD, confirmation: OLD })).rejects.toThrow('session')
})

it('rejects mismatched, short and oversized new secrets without consuming a login attempt', async () => {
  const { settings, login } = await fixture()
  for (let attempt = 0; attempt < 4; attempt++)
    expect(await login('wrong')).toBeNull()
  for (const input of [
    { newPassphrase: NEW, confirmation: OLD },
    { newPassphrase: 'short', confirmation: 'short' },
    { newPassphrase: 'x'.repeat(1025), confirmation: 'x'.repeat(1025) },
  ]) {
    await expect(settings.changePassphrase({ currentPassphrase: 'wrong', ...input })).rejects.toThrow(/match|32|1024/)
  }
  expect(await login(OLD)).toEqual({ userId: USER_ID, sessionVersion: 0 })
})

it('shares the login lockout while allowing an authenticated reader to revoke every session', async () => {
  const { settings, login } = await fixture()
  for (let attempt = 0; attempt < 4; attempt++)
    expect(await login('wrong')).toBeNull()
  await expect(settings.changePassphrase({ currentPassphrase: 'wrong', newPassphrase: NEW, confirmation: NEW })).rejects.toThrow()
  expect(await login(OLD)).toBeNull()
  await expect(settings.changePassphrase({ currentPassphrase: OLD, newPassphrase: NEW, confirmation: NEW })).rejects.toThrow('locked')
  await settings.signOutEverywhere()
  await expect(settings.signOutEverywhere()).rejects.toThrow('session')
})

it('refuses a change that was authenticated before another request revoked the session', async () => {
  const { pg, settings, login, identity } = await fixture()
  let release: () => void = () => {}
  let reached: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const started = new Promise<void>((resolve) => {
    reached = resolve
  })
  const delayed = createAccountSettings({
    verifySession: async () => identity,
    withClient: async (operation) => {
      reached()
      await gate
      return operation(pg)
    },
  })
  const change = delayed.changePassphrase({ currentPassphrase: OLD, newPassphrase: NEW, confirmation: NEW })
  await started
  await settings.signOutEverywhere()
  release()
  await expect(change).rejects.toThrow('session')
  expect(await login(NEW)).toBeNull()
  expect(await login(OLD)).toEqual({ userId: USER_ID, sessionVersion: 1 })
})

it('rolls back credential replacement when the database cannot update the session version', async () => {
  const { pg, settings, login } = await fixture()
  await pg.exec('ALTER TABLE "user" ADD CONSTRAINT simulated_write_failure CHECK (session_version = 0)')
  await expect(settings.changePassphrase({ currentPassphrase: OLD, newPassphrase: NEW, confirmation: NEW })).rejects.toThrow()
  expect(await login(NEW)).toBeNull()
  expect(await login(OLD)).toEqual({ userId: USER_ID, sessionVersion: 0 })
})

it('accepts byte boundaries and shares the reset after a successful proof', async () => {
  const { settings, login } = await fixture()
  for (let attempt = 0; attempt < 4; attempt++)
    expect(await login('wrong')).toBeNull()
  const multibyte = `${'界'.repeat(10)}ab`
  await settings.changePassphrase({ currentPassphrase: OLD, newPassphrase: multibyte, confirmation: multibyte })
  expect(await login('wrong')).toBeNull()
  expect(await login(multibyte)).toEqual({ userId: USER_ID, sessionVersion: 1 })
})

it('requires authentication for both account mutations', async () => {
  const { pg, login } = await fixture()
  const settings = createAccountSettings({
    verifySession: async () => { throw new Error('unauthorized') },
    withClient: operation => operation(pg),
  })
  await expect(settings.signOutEverywhere()).rejects.toThrow('unauthorized')
  await expect(settings.changePassphrase({ currentPassphrase: OLD, newPassphrase: NEW, confirmation: NEW })).rejects.toThrow('unauthorized')
  expect(await login(OLD)).toEqual({ userId: USER_ID, sessionVersion: 0 })
})
