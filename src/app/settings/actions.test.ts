import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readLocale } from '@/lib/i18n/server'
import { READING_COOKIE } from '@/lib/settings/preferences'
import { saveLanguage, saveReadingStyle } from './actions'

const state = vi.hoisted(() => ({
  database: undefined as unknown,
  cookieJar: new Map<string, string>(),
  cookieOptions: undefined as unknown,
  authenticated: true,
  sessionVersion: 0,
}))
const id = '00000000-0000-4000-8000-000000000001'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ db: () => state.database }))
vi.mock('@/lib/auth/dal', () => ({ verifySession: async () => {
  if (!state.authenticated)
    throw new Error('unauthorized')
  return { userId: id, sessionVersion: state.sessionVersion }
} }))
vi.mock('@/lib/auth/session', () => ({
  SESSION_COOKIE_NAME: 'session',
  verifySessionToken: async () => state.authenticated ? { userId: id, sessionVersion: state.sessionVersion } : null,
  sessionCookie: vi.fn(),
}))
vi.mock('@/lib/settings/server', () => ({ accountSettings: {}, appearanceSettings: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Map([['accept-language', 'en-GB']]),
  cookies: async () => ({
    get: (name: string) => ({ value: state.cookieJar.get(name) }),
    set: (name: string, value: string, options: unknown) => {
      state.cookieJar.set(name, value)
      state.cookieOptions = options
    },
  }),
}))
let pg: PGlite
beforeEach(async () => {
  pg = new PGlite()
  state.database = drizzle(pg)
  state.authenticated = true
  state.sessionVersion = 0
  state.cookieJar = new Map()
  await pg.exec('CREATE TABLE "user" (id uuid PRIMARY KEY, session_version int, interface_language text, content_language text)')
  await pg.query('INSERT INTO "user" VALUES ($1,0,$2,$3)', [id, 'system', 'zh'])
})
afterEach(async () => {
  await pg.close()
})

it('persists languages independently and resolves them in a second browser session', async () => {
  expect(await saveLanguage('interfaceLanguage', 'zh')).toEqual({})
  expect((await readLocale()).language).toBe('zh')
  expect(await saveLanguage('contentLanguage', 'en')).toEqual({})
  state.cookieJar = new Map()
  const secondBrowser = await readLocale()
  expect(secondBrowser.language).toBe('zh')
  expect(secondBrowser.contentLanguage).toBe('en')
  expect(secondBrowser.t('Saved', '已保存')).toBe('已保存')
})
it('keeps reading style browser-local and requires authentication', async () => {
  const style = { size: 'large', font: 'serif' }
  expect(await saveReadingStyle(style)).toEqual({})
  expect(JSON.parse(state.cookieJar.get(READING_COOKIE)!)).toEqual(style)
  expect(state.cookieOptions).toMatchObject({ httpOnly: true, secure: true, path: '/', sameSite: 'lax' })
  const firstBrowser = state.cookieJar
  state.cookieJar = new Map()
  expect(state.cookieJar.get(READING_COOKIE)).toBeUndefined()
  state.authenticated = false
  await expect(saveReadingStyle({ size: 'small', font: 'sans' })).rejects.toThrow('unauthorized')
  expect(firstBrowser.get(READING_COOKIE)).toBe(JSON.stringify(style))
})
it('does not load preferences from a revoked session or write invalid values', async () => {
  await saveLanguage('interfaceLanguage', 'zh')
  state.sessionVersion = 1
  expect((await readLocale()).language).toBe('en')
  expect(await saveLanguage('contentLanguage', 'system')).toHaveProperty('error')
  expect(await saveReadingStyle({ size: ['large'], font: 'serif' })).toHaveProperty('error')
  expect((await pg.query('SELECT content_language FROM "user"')).rows).toEqual([{ content_language: 'zh' }])
})
