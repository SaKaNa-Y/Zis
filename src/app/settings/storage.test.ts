import process from 'node:process'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { issueSession } from '@/lib/auth/session'
import { readArchivedBookmarks } from '@/lib/bookmarks/server'
import { readStorage } from '@/lib/settings/storage'
import { saveLanguage } from './actions'

const app = vi.hoisted(() => ({ fetch: vi.fn(), token: '', database: undefined as unknown }))
vi.mock('@/lib/safe-fetch', () => ({ safeFetch: app.fetch }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ db: () => app.database }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: app.token }) }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(path) },
  notFound: () => { throw new Error('not found') },
}))

const pg = new PGlite()
const author = '00000000-0000-4000-8000-000000000123'
const reader = '00000000-0000-4000-8000-000000000124'
beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32))
  vi.stubEnv('NEON_PROJECT_ID', 'test-project')
  vi.stubEnv('NEON_API_KEY', 'test')
  app.database = drizzle(pg)
  await pg.exec(`CREATE TABLE "user" (id uuid, role text, session_version int, revoked_at timestamptz);
    INSERT INTO "user" VALUES ('${author}', 'author', 1, NULL), ('${reader}', 'reader', 1, NULL)`)
})
afterAll(async () => {
  await pg.close()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('denies direct storage, bookmark and settings requests to a reader and redirects revoked sessions', async () => {
  app.token = await issueSession({ userId: reader, sessionVersion: 1 })
  await expect(readStorage()).rejects.toThrow('not found')
  await expect(readArchivedBookmarks(1)).rejects.toThrow('not found')
  await expect(saveLanguage('zh')).rejects.toThrow('not found')
  await pg.query('UPDATE "user" SET revoked_at = now() WHERE id = $1', [reader])
  await expect(readStorage()).rejects.toThrow('/login')
})

it('keeps the PostgreSQL reading when the provider cannot supply project usage', async () => {
  app.token = await issueSession({ userId: author, sessionVersion: 1 })
  app.fetch.mockResolvedValue({ status: 403 })
  const storage = await readStorage()
  expect(storage.databaseBytes).toBeGreaterThan(0)
  expect(storage.project).toBeNull()
})

it('uses the project reading and reports when the provider measured it', async () => {
  app.token = await issueSession({ userId: author, sessionVersion: 1 })
  const measuredAt = new Date(Date.now() - 3_600_000).toISOString()
  app.fetch.mockImplementation(async (url: string) => {
    expect(new URL(url).searchParams.get('project_ids')).toBe(process.env.NEON_PROJECT_ID)
    return { status: 200, text: () => JSON.stringify({ projects: [{ project_id: 'test-project', periods: [{
      consumption: [{ timeframe_end: measuredAt, logical_size_bytes: 250_000_000 }],
    }] }] }) }
  })
  expect((await readStorage()).project).toEqual({ remainingBytes: 750_000_000, measuredAt })
})
