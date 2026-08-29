import { SignJWT } from 'jose'
import { describe, expect, it, vi } from 'vitest'
import {
  issueSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
  sessionCookie,
  shouldRefreshSession,
  verifySessionToken,
} from './session'

vi.mock('server-only', () => ({}))

const TEST_SECRET = '0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'abcdef0123456789abcdef0123456789'
const USER_ID = '00000000-0000-4000-8000-000000000075'
const NOW = new Date('2026-08-29T08:00:00.000Z')
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)

async function tokenWith(payload: Record<string, unknown>, algorithm = 'HS256'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuer('zis')
    .setAudience('zis')
    .setSubject(USER_ID)
    .setIssuedAt(NOW_SECONDS)
    .setExpirationTime(NOW_SECONDS + SESSION_DURATION_SECONDS)
    .sign(new TextEncoder().encode(TEST_SECRET))
}

describe('the Zis session contract', () => {
  it('issues and verifies a minimal revocable HS256 session for ninety days', async () => {
    const token = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )

    await expect(verifySessionToken(token, { secret: TEST_SECRET, now: NOW }))
      .resolves
      .toEqual({
        userId: USER_ID,
        sessionVersion: 4,
        issuedAt: NOW_SECONDS,
        expiresAt: NOW_SECONDS + 90 * 24 * 60 * 60,
      })
  })

  it('mints a distinct token for every successful login, even in the same second', async () => {
    const first = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )
    const second = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )

    expect(first).not.toBe(second)
  })

  it('fails closed for tampering, another key, expiry, and malformed input', async () => {
    const token = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )
    const [header, payload, signature] = token.split('.') as [string, string, string]
    const tamperedPayload = `${payload.startsWith('a') ? 'b' : 'a'}${payload.slice(1)}`
    const tampered = `${header}.${tamperedPayload}.${signature}`
    const afterExpiry = new Date(NOW.getTime() + (SESSION_DURATION_SECONDS + 1) * 1000)

    await expect(verifySessionToken(tampered, { secret: TEST_SECRET, now: NOW })).resolves.toBeNull()
    await expect(verifySessionToken(token, { secret: OTHER_SECRET, now: NOW })).resolves.toBeNull()
    await expect(verifySessionToken(token, { secret: TEST_SECRET, now: afterExpiry })).resolves.toBeNull()
    await expect(verifySessionToken('not-a-jwt', { secret: TEST_SECRET, now: NOW })).resolves.toBeNull()
    await expect(verifySessionToken(undefined, { secret: TEST_SECRET, now: NOW })).resolves.toBeNull()
  })

  it('pins the algorithm and validates application claims at runtime', async () => {
    const wrongAlgorithm = await tokenWith({ sv: 4 }, 'HS384')
    const stringVersion = await tokenWith({ sv: '4' })
    const negativeVersion = await tokenWith({ sv: -1 })
    const missingVersion = await tokenWith({})
    const missingTokenId = await tokenWith({ sv: 4 })
    const invalidSubject = await new SignJWT({ sv: 4 })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('zis')
      .setAudience('zis')
      .setSubject('reader')
      .setIssuedAt(NOW_SECONDS)
      .setExpirationTime(NOW_SECONDS + SESSION_DURATION_SECONDS)
      .sign(new TextEncoder().encode(TEST_SECRET))

    for (const token of [
      wrongAlgorithm,
      stringVersion,
      negativeVersion,
      missingVersion,
      missingTokenId,
      invalidSubject,
    ]) {
      await expect(verifySessionToken(token, { secret: TEST_SECRET, now: NOW })).resolves.toBeNull()
    }
  })

  it('requires at least 256 bits of signing secret material', async () => {
    await expect(issueSession(
      { userId: USER_ID, sessionVersion: 0 },
      { secret: 'too-short', now: NOW },
    )).rejects.toThrow('at least 32 bytes')

    const token = await tokenWith({ sv: 0 })
    await expect(verifySessionToken(token, { secret: 'too-short', now: NOW })).resolves.toBeNull()
  })

  it('describes a host-only secure cookie with the token expiry', () => {
    const expiresAt = NOW_SECONDS + SESSION_DURATION_SECONDS
    const cookie = sessionCookie('signed-token', expiresAt)

    expect(SESSION_COOKIE_NAME).toBe('__Host-zis_session')
    expect(cookie).toEqual({
      name: '__Host-zis_session',
      value: 'signed-token',
      options: {
        expires: new Date(expiresAt * 1000),
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    })
    expect(cookie.options).not.toHaveProperty('domain')
  })

  it('refreshes a live session only after seven days', () => {
    const session = {
      userId: USER_ID,
      sessionVersion: 4,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + SESSION_DURATION_SECONDS,
    }

    expect(shouldRefreshSession(session, new Date(NOW.getTime() + (SESSION_REFRESH_AFTER_SECONDS - 1) * 1000)))
      .toBe(false)
    expect(shouldRefreshSession(session, new Date(NOW.getTime() + SESSION_REFRESH_AFTER_SECONDS * 1000)))
      .toBe(true)
  })
})
