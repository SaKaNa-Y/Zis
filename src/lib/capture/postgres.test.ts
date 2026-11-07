import type { CaptureInput, CaptureSource } from './model'
import type { CaptureDatabase } from './postgres'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canonicalUrl, CaptureValidationError } from './model'
import { createCaptureStore } from './postgres'

let pg: PGlite
let store: ReturnType<typeof createCaptureStore>
let source: CaptureSource
function input(id = '100', rest: Partial<CaptureInput> = {}): CaptureInput {
  return { sourceId: source.id, title: 'Original', author: 'OpenAI', posts: [{ url: `https://x.com/OpenAI/status/${id}`, body: 'Original full text '.repeat(200), publishedAt: new Date().toISOString() }], ...rest }
}
const png = { data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]), mimeType: 'image/png' as const, alt: 'Screenshot' }
function makeStore(options: Parameters<typeof createCaptureStore>[1] = {}) {
  const adapter: CaptureDatabase = { query: (sql, params) => pg.query(sql, params), transaction: work => pg.transaction(tx => work((sql, params) => tx.query(sql, params))) }
  return createCaptureStore(adapter, { checkDatabaseSize: false, ...options })
}
beforeEach(async () => {
  pg = new PGlite()
  await pg.exec(await readFile('drizzle/0013_information_capture.sql', 'utf8'))
  store = makeStore()
  source = (await store.listSources()).find(s => s.url === 'https://x.com/openai')!
})
afterEach(async () => {
  await pg.close()
})

describe('original capture lifecycle in PostgreSQL', () => {
  it('merges aliases and thread continuations, retains full text and deadline, resolves incomplete state', async () => {
    const first = input('100', { incompleteReason: 'Missing continuation' })
    const created = await store.saveCapture(first, [png])
    const original = (await store.listCards())[0]!
    const update = input('101', { threadUrl: 'https://twitter.com/OpenAI/status/100?s=20' })
    expect(await store.saveCapture(update)).toEqual({ id: created.id, created: false })
    const card = (await store.listCards())[0]!
    expect(card.posts).toHaveLength(2)
    expect(card.posts[0]!.body.length).toBeGreaterThan(1200)
    expect(card.expiresAt).toBe(original.expiresAt)
    expect(card.publishedAt).toBe(original.publishedAt)
    expect(card.incompleteReason).toBeNull()
    expect(card.images).toHaveLength(1)
    expect(await store.readImage(card.images[0]!.id)).toEqual({ data: png.data, mimeType: png.mimeType })
    expect((await store.saveCapture({ ...first, posts: [{ ...first.posts[0]!, url: 'https://mobile.twitter.com/OpenAI/status/100?anything=1' }] }, [png])).created).toBe(false)
    expect((await store.listCards())[0]!.images).toHaveLength(1)
  })
  it('hides expired bodies and images immediately; pruning preserves only identity and deadline', async () => {
    const { id } = await store.saveCapture(input(), [png])
    const imageId = (await store.listCards())[0]!.images[0]!.id
    await pg.query('UPDATE capture_card SET expires_at=now()-interval \'1 second\' WHERE id=$1', [id])
    expect(await store.listCards()).toEqual([])
    expect(await store.readImage(imageId)).toBeNull()
    expect(await store.prune()).toEqual({ cards: 1, images: 1 })
    expect((await pg.query('SELECT * FROM capture_post')).rows).toEqual([])
    expect(Object.keys((await pg.query('SELECT * FROM capture_receipt')).rows[0]!)).toEqual(['original_key', 'expires_at'])
    await expect(store.saveCapture(input())).rejects.toThrow('expired')
    await store.saveCapture(input('101', { threadUrl: 'https://x.com/OpenAI/status/100' }))
    const card = (await store.listCards())[0]!
    expect(card.continuationOf).toBe('https://x.com/i/status/100')
    expect(card.posts).toHaveLength(1)
  })
  it('rejects pretracking content, disabled sources and mismatched owners, accepts old root reference', async () => {
    const old = input()
    old.posts[0]!.publishedAt = '2001-01-01T00:00:00Z'
    await expect(store.saveCapture(old)).rejects.toThrow('predates')
    await expect(store.saveCapture(input('101', { posts: [{ ...input().posts[0]!, url: 'https://x.com/Google/status/100' }] }))).rejects.toThrow('match')
    await store.saveCapture(input('102', { threadUrl: 'https://x.com/OpenAI/status/1' }))
    await store.saveSource({ ...source, enabled: false })
    await expect(store.saveCapture(input())).rejects.toThrow('disabled')
  })
  it('starts tracking at activation and resets it on resume while allowing existing post repairs', async () => {
    const disabled = await store.saveSource({ name: 'Initially disabled', url: 'https://x.com/example', kind: 'x', enabled: false })
    await pg.query('UPDATE capture_source SET tracking_since=now()-interval \'1 day\' WHERE id=$1', [disabled.id])
    const beforeActivation = new Date(Date.now() - 1000).toISOString()
    const enabled = await store.saveSource({ ...disabled, enabled: true })
    expect(Date.parse(enabled.trackingSince)).toBeGreaterThan(Date.parse(beforeActivation))
    const candidate = input('500', { sourceId: enabled.id, posts: [{ url: 'https://x.com/example/status/500', body: 'Original', publishedAt: beforeActivation }] })
    await expect(store.saveCapture(candidate)).rejects.toThrow('predates source tracking')
    candidate.posts[0]!.publishedAt = new Date().toISOString()
    const saved = await store.saveCapture(candidate)
    await store.saveSource({ ...enabled, enabled: false })
    const resumed = await store.saveSource({ ...enabled, enabled: true })
    expect(Date.parse(resumed.trackingSince)).toBeGreaterThanOrEqual(Date.parse(enabled.trackingSince))
    candidate.posts[0]!.body = 'Repaired original'
    expect(await store.saveCapture(candidate)).toEqual({ id: saved.id, created: false })
    const pausedPost = { ...candidate, posts: [{ ...candidate.posts[0]!, url: 'https://x.com/example/status/501', publishedAt: beforeActivation }] }
    await expect(store.saveCapture(pausedPost)).rejects.toThrow('predates source tracking')
    const renamed = await store.saveSource({ ...resumed, name: 'Renamed', enabled: true })
    expect(renamed.trackingSince).toBe(resumed.trackingSince)
  })
  it('deduplicates across source records and rejects overlapping unrelated threads atomically', async () => {
    const one = await store.saveCapture(input())
    const second = await store.saveSource({ name: 'OpenAI articles', url: 'https://x.com/', kind: 'blog', enabled: true })
    expect(await store.saveCapture({ ...input(), sourceId: second.id })).toEqual({ id: one.id, created: false })
    await store.saveCapture(input('200'))
    await expect(store.saveCapture(input('200', { threadUrl: 'https://x.com/OpenAI/status/100' }))).rejects.toThrow('another card')
    expect(await store.listCards()).toHaveLength(2)
  })
  it('enforces image quotas with rollback, signature validation and idempotent retries', async () => {
    store = makeStore({ imageLimitBytes: png.data.length })
    await store.saveCapture(input(), [png])
    await store.saveCapture(input(), [png])
    await expect(store.saveCapture(input('200'), [png])).rejects.toBeInstanceOf(CaptureValidationError)
    expect(await store.listCards()).toHaveLength(1)
    expect((await store.storageUsage()).bytes).toBe(png.data.length)
    await expect(store.saveCapture(input('300'), [{ ...png, data: new Uint8Array([1, 2]) }])).rejects.toThrow('JPEG')
    store = makeStore({ checkDatabaseSize: true, databaseLimitBytes: 1 })
    await expect(store.saveCapture(input('400'))).rejects.toThrow('Database safety limit')
    expect(await store.listCards()).toHaveLength(1)
  })
  it('paginates equal publication times without omission and records explicit failures', async () => {
    const publishedAt = new Date().toISOString()
    for (const id of ['1', '2', '3']) await store.saveCapture(input(id, { posts: [{ ...input(id).posts[0]!, publishedAt }] }))
    const first = await store.listCards(2)
    const second = await store.listCards(2, `${first[1]!.publishedAt}|${first[1]!.id}`)
    expect(second).toHaveLength(1)
    expect(new Set([...first, ...second].map(c => c.id)).size).toBe(3)
    await store.recordRun({ sourceId: source.id, status: 'failed', addedCount: 0, message: 'Platform unavailable' })
    expect((await store.listRuns())[0]).toMatchObject({ status: 'failed', message: 'Platform unavailable' })
  })
  it('serializes concurrent retries and quota contention without duplicate content', async () => {
    const results = await Promise.all([store.saveCapture(input()), store.saveCapture(input())])
    expect(results.filter(r => r.created)).toHaveLength(1)
    expect(results[0]!.id).toBe(results[1]!.id)
    store = makeStore({ imageLimitBytes: png.data.length })
    const writes = await Promise.allSettled([store.saveCapture(input('200'), [png]), store.saveCapture(input('300'), [png])])
    expect(writes.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await store.storageUsage()).bytes).toBe(png.data.length)
  })
  it('retains original thread URL and image order for editable incomplete captures', async () => {
    const images = [png, { ...png, data: new Uint8Array([...png.data, 2]), alt: 'Second' }]
    const { id } = await store.saveCapture(input('200', { threadUrl: 'https://x.com/OpenAI/status/1', incompleteReason: 'Missing start' }), images)
    const card = (await store.getCard(id))!
    expect(card.threadUrl).toBe('https://x.com/OpenAI/status/1')
    expect(card.sourceKind).toBe('x')
    expect(card.images.map(i => i.alt)).toEqual(['Screenshot', 'Second'])
    await store.saveCapture({ ...input('200'), threadUrl: card.threadUrl })
    expect((await store.getCard(id))!.incompleteReason).toBeNull()
    await pg.query('UPDATE capture_card SET expires_at=now()-interval \'1 second\' WHERE id=$1', [id])
    expect(await store.getCard(id)).toBeNull()
  })
  it('rejects malformed input, future publication and duplicate sources with domain errors', async () => {
    await expect(store.saveCapture(null as unknown as CaptureInput)).rejects.toBeInstanceOf(CaptureValidationError)
    await expect(store.saveCapture(input('100', { posts: [{ ...input().posts[0]!, publishedAt: '2099-01-01T00:00:00Z' }] }))).rejects.toBeInstanceOf(CaptureValidationError)
    await expect(store.saveSource({ name: source.name, url: source.url, kind: source.kind, enabled: true })).rejects.toThrow('already exists')
  })
  it('accepts full blog images in bounded batches and caps the aggregate card count', async () => {
    const { id } = await store.saveCapture(input())
    for (let batch = 0; batch < 16; batch++) {
      await store.saveCapture(input(), Array.from({ length: 8 }, (_, n) => ({ ...png, data: new Uint8Array([...png.data, batch * 8 + n]) })))
    }
    expect((await store.getCard(id))!.images).toHaveLength(128)
    await expect(store.saveCapture(input(), [{ ...png, data: new Uint8Array([...png.data, 200]) }])).rejects.toThrow('128 images per card')
    expect((await store.getCard(id))!.images).toHaveLength(128)
  })
  it('canonicalizes X numeric identity without discarding meaningful blog query parameters', () => {
    expect(canonicalUrl('https://twitter.com/Other/status/123?s=1')).toBe('https://x.com/i/status/123')
    expect(canonicalUrl('https://example.com/article?id=1&utm_source=x')).toBe('https://example.com/article?id=1')
    expect(() => canonicalUrl('http://example.com')).toThrow()
    expect(() => canonicalUrl('https://x.com/OpenAI/status/notnumeric')).toThrow()
  })
})
