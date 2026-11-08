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

const rootBranch = { id: 'br-root', project_id: 'test-project', logical_size: 250_000_000 }

it('gets project-wide usage from the Free API for a project with one root branch', async () => {
  app.token = await issueSession({ userId: author, sessionVersion: 1 })
  app.fetch.mockResolvedValue({ status: 200, text: () => JSON.stringify({ branches: [rootBranch] }) })
  expect((await readStorage()).project).toEqual({ remainingBytes: 750_000_000 })
  expect(app.fetch.mock.lastCall?.[0]).toBe('https://console.neon.tech/api/v2/projects/test-project/branches?limit=2')
})

it.each([
  { branches: [rootBranch, { ...rootBranch, parent_id: rootBranch.id }] },
  { branches: [rootBranch], pagination: { next: 'cursor' } },
  { branches: [{ ...rootBranch, project_id: 'different-project' }] },
  { branches: [{ ...rootBranch, logical_size: null }] },
])('keeps database size when the project total cannot be established', async (payload) => {
  app.token = await issueSession({ userId: author, sessionVersion: 1 })
  app.fetch.mockResolvedValue({ status: 200, text: () => JSON.stringify(payload) })
  const storage = await readStorage()
  expect(storage.project).toBeNull()
  expect(storage.databaseBytes).toBeGreaterThan(0)
})
