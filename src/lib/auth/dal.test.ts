import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVerifySession } from './dal'
import { issueSession, SESSION_DURATION_SECONDS } from './session'

vi.mock('server-only', () => ({}))

const TEST_SECRET = '0123456789abcdef0123456789abcdef'
const USER_ID = '00000000-0000-4000-8000-000000000075'
const NOW = new Date('2026-08-29T08:00:00.000Z')
const originalEnvironment = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnvironment }
  vi.useRealTimers()
})

function refuse(): never {
  throw new Error('redirect:/login')
}

describe('the authenticated data-access boundary', () => {
  it('returns only the user identity when the signed and stored versions agree', async () => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const token = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )
    const verifySession = createVerifySession({
      readSessionVersion: async () => 4,
      readToken: async () => token,
      unauthorized: refuse,
    })

    await expect(verifySession()).resolves.toEqual({ userId: USER_ID })
  })

  it('invalidates a live token as soon as the stored session version is bumped', async () => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const token = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )
    let storedVersion = 4
    const verifySession = createVerifySession({
      readSessionVersion: async () => storedVersion,
      readToken: async () => token,
      unauthorized: refuse,
    })

    await expect(verifySession()).resolves.toEqual({ userId: USER_ID })
    storedVersion = 5
    await expect(verifySession()).rejects.toThrow('redirect:/login')
  })

  it('refuses missing, malformed, expired, and unknown-user sessions alike', async () => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const liveToken = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      { secret: TEST_SECRET, now: NOW },
    )
    const expiredToken = await issueSession(
      { userId: USER_ID, sessionVersion: 4 },
      {
        secret: TEST_SECRET,
        now: new Date(NOW.getTime() - (SESSION_DURATION_SECONDS + 1) * 1000),
      },
    )

    const cases = [
      { token: undefined, version: 4 },
      { token: 'not-a-jwt', version: 4 },
      { token: expiredToken, version: 4 },
      { token: liveToken, version: null },
    ]

    for (const entry of cases) {
      const verifySession = createVerifySession({
        readSessionVersion: async () => entry.version,
        readToken: async () => entry.token,
        unauthorized: refuse,
      })

      await expect(verifySession(), String(entry.token)).rejects.toThrow('redirect:/login')
    }
  })
})
