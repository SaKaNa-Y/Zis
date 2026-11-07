import type { CaptureCard, CaptureRun, CaptureSource, CaptureStore } from './model'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { neon, Pool } from '@neondatabase/serverless'
import { databaseUrl } from '@/lib/env'
import { canonicalUrl, CaptureValidationError, DATABASE_LIMIT_BYTES, httpsUrl, IMAGE_LIMIT_BYTES, sourceUrl, validateImage } from './model'

export interface CaptureQuery { <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface CaptureDatabase { query: CaptureQuery, transaction: <T>(work: (query: CaptureQuery) => Promise<T>) => Promise<T> }
interface Options { imageLimitBytes?: number, databaseLimitBytes?: number, checkDatabaseSize?: boolean }
const cardSelect = `SELECT c.id,c.source_id AS "sourceId",s.name AS "sourceName",s.kind AS "sourceKind",c.title,c.author,c.original_url AS "originalUrl",c.thread_url AS "threadUrl",c.published_at AS "publishedAt",c.captured_at AS "capturedAt",c.expires_at AS "expiresAt",c.updated_at AS "updatedAt",c.incomplete_reason AS "incompleteReason",c.continuation_of AS "continuationOf",(SELECT coalesce(jsonb_agg(jsonb_build_object('url',p.url,'publishedAt',p.published_at,'body',p.body) ORDER BY p.published_at,p.original_key),'[]') FROM capture_post p WHERE p.card_id=c.id) AS posts,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'alt',i.alt) ORDER BY i.position),'[]') FROM capture_image i WHERE i.card_id=c.id) AS images FROM capture_card c JOIN capture_source s ON s.id=c.source_id WHERE c.expires_at>now()`
const sourceSelect = 'id,name,url,kind,enabled,tracking_since AS "trackingSince"'
function dates<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as T
}
export function createCaptureStore(db: CaptureDatabase, options: Options = {}): CaptureStore {
  const imageLimit = options.imageLimitBytes ?? IMAGE_LIMIT_BYTES
  const databaseLimit = options.databaseLimitBytes ?? DATABASE_LIMIT_BYTES
  async function write<T>(work: (q: CaptureQuery) => Promise<T>): Promise<T> {
    return db.transaction(async (q) => {
      await q('SELECT pg_advisory_xact_lock(72834109)')
      return work(q)
    })
  }
  async function capacity(q: CaptureQuery, additionalBytes = 0) {
    if (options.checkDatabaseSize !== false) {
      const { rows } = await q('SELECT pg_database_size(current_database()) AS bytes')
      const used = Number(rows[0]?.bytes)
      if (!Number.isFinite(used) || used + additionalBytes >= databaseLimit)
        throw new CaptureValidationError('Database safety limit reached; capture is paused')
    }
  }
  async function prune(q: CaptureQuery) {
    const counts = await q(`SELECT count(DISTINCT c.id)::int AS cards,count(i.id)::int AS images FROM capture_card c LEFT JOIN capture_image i ON i.card_id=c.id WHERE c.expires_at <= now()`)
    await q(`INSERT INTO capture_receipt(original_key,expires_at) SELECT p.original_key,c.expires_at FROM capture_post p JOIN capture_card c ON c.id=p.card_id WHERE c.expires_at <= now() ON CONFLICT DO NOTHING`)
    await q(`INSERT INTO capture_receipt(original_key,expires_at) SELECT thread_key,expires_at FROM capture_card WHERE expires_at <= now() ON CONFLICT DO NOTHING`)
    await q('DELETE FROM capture_card WHERE expires_at <= now()')
    await q('DELETE FROM capture_run WHERE started_at < now() - interval \'7 days\'')
    return { cards: Number(counts.rows[0]?.cards), images: Number(counts.rows[0]?.images) }
  }
  return {
    async listSources() {
      return (await db.query(`SELECT ${sourceSelect} FROM capture_source ORDER BY tracking_since,name`)).rows.map(r => dates<CaptureSource>(r))
    },
    async allowBackfill(since) {
      if (typeof since !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/.test(since))
        throw new CaptureValidationError('Choose a valid start date in Beijing time.')
      const timestamp = Date.parse(since)
      if (!Number.isFinite(timestamp) || timestamp > Date.now() || new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) !== since.slice(0, 10))
        throw new CaptureValidationError('Choose a valid start date no later than today in Beijing time.')
      return write(async (q) => {
        const result = await q('UPDATE capture_source SET tracking_since=$1::timestamptz WHERE enabled=true AND tracking_since>$1::timestamptz RETURNING id', [since])
        return result.rows.length
      })
    },
    async saveSource(input) {
      if (!input || typeof input.name !== 'string' || typeof input.url !== 'string' || !input.name.trim() || input.name.length > 200 || !['x', 'blog'].includes(input.kind) || typeof input.enabled !== 'boolean')
        throw new CaptureValidationError('Invalid source')
      const url = sourceUrl(input.url, input.kind)
      return write(async (q) => {
        await capacity(q, 8192)
        if (input.id) {
          const result = await q(`UPDATE capture_source SET name=$2,tracking_since=CASE WHEN NOT enabled AND $3 THEN now() ELSE tracking_since END,enabled=$3 WHERE id=$1 AND url=$4 AND kind=$5 RETURNING ${sourceSelect}`, [input.id, input.name.trim(), input.enabled, url, input.kind])
          if (!result.rows[0])
            throw new CaptureValidationError('Source does not exist or its URL was changed; add a new source instead')
          return dates<CaptureSource>(result.rows[0])
        }
        if ((await q('SELECT id FROM capture_source WHERE url=$1', [url])).rows.length)
          throw new CaptureValidationError('This source already exists')
        const result = await q(`INSERT INTO capture_source(name,url,kind,enabled) VALUES($1,$2,$3,$4) RETURNING ${sourceSelect}`, [input.name.trim(), url, input.kind, input.enabled])
        return dates<CaptureSource>(result.rows[0]!)
      })
    },
    async getCard(id) {
      const result = await db.query(`${cardSelect} AND c.id=$1`, [id])
      return result.rows[0] ? dates<CaptureCard>(result.rows[0]) : null
    },
    async listCards(limit = 30, before) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new CaptureValidationError('Invalid page size')
      const cursor = before?.split('|')
      if (cursor && (cursor.length !== 2 || !Number.isFinite(Date.parse(cursor[0]!)) || !/^[\da-f-]{36}$/i.test(cursor[1]!)))
        throw new CaptureValidationError('Invalid page cursor')
      const result = await db.query(`${cardSelect} ${cursor ? 'AND (c.published_at,c.id)<($2::timestamptz,$3::uuid)' : ''} ORDER BY c.published_at DESC,c.id DESC LIMIT $1`, cursor ? [limit, ...cursor] : [limit])
      return result.rows.map(r => dates<CaptureCard>(r))
    },
    async saveCapture(input, images = []) {
      if (!input || typeof input.sourceId !== 'string' || typeof input.title !== 'string' || typeof input.author !== 'string' || !Array.isArray(input.posts) || (input.threadUrl !== undefined && typeof input.threadUrl !== 'string') || (input.incompleteReason !== undefined && typeof input.incompleteReason !== 'string') || !input.title.trim() || !input.author.trim() || !input.posts.length || input.title.length > 2000 || input.author.length > 500 || (input.incompleteReason?.length ?? 0) > 2000)
        throw new CaptureValidationError('Title, author and original content are required')
      if (!Array.isArray(images) || images.length > 8)
        throw new CaptureValidationError('Upload at most eight images per save; add further images in subsequent updates')
      images.forEach(validateImage)
      if (input.posts.some(p => !p || typeof p.url !== 'string' || typeof p.body !== 'string' || typeof p.publishedAt !== 'string' || !Number.isFinite(Date.parse(p.publishedAt)) || Date.parse(p.publishedAt) > Date.now()))
        throw new CaptureValidationError('A valid original publication time is required')
      const posts = input.posts.map(p => ({ ...p, key: canonicalUrl(p.url), publishedAt: new Date(p.publishedAt).toISOString() }))
      if (posts.some(p => !p.body.trim()))
        throw new CaptureValidationError('Each post must contain original content')
      if (new Set(posts.map(p => p.key)).size !== posts.length)
        throw new CaptureValidationError('Duplicate posts in capture')
      const root = canonicalUrl(input.threadUrl ?? posts[0]!.url)
      return write(async (q) => {
        await prune(q)
        const sourceRow = (await q(`SELECT ${sourceSelect} FROM capture_source WHERE id=$1 AND enabled=true`, [input.sourceId])).rows[0]
        if (!sourceRow)
          throw new CaptureValidationError('Source does not exist or is disabled')
        const source = dates<CaptureSource>(sourceRow)
        const sourceAddress = new URL(source.url)
        for (const url of [...posts.map(p => p.url), ...(input.threadUrl ? [input.threadUrl] : [])]) {
          const address = httpsUrl(url)
          if (source.kind === 'x') {
            if (!/^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(address.hostname) || address.pathname.split('/')[1]?.toLowerCase() !== sourceAddress.pathname.slice(1).toLowerCase())
              throw new CaptureValidationError('Post author URL must match its source account')
          }
          else if (source.url === 'https://claude.com/resources/articles?products=claude-code' ? !['claude.com', 'www.anthropic.com', 'claude.dev'].includes(address.hostname) : address.hostname !== sourceAddress.hostname) {
            throw new CaptureValidationError('Article URL must belong to its source section')
          }
        }
        if (source.kind === 'blog' && (posts.length !== 1 || input.threadUrl))
          throw new CaptureValidationError('Blog cards contain one article')
        const existing = (await q('SELECT * FROM capture_card WHERE thread_key=$1', [root])).rows[0]
        const rootExpired = (await q('SELECT original_key FROM capture_receipt WHERE original_key=$1', [root])).rows.length > 0
        const known = await q('SELECT original_key,card_id FROM capture_post WHERE original_key = ANY($1::text[])', [posts.map(p => p.key)])
        if (known.rows.some(r => existing && r.card_id !== existing.id) || (!existing && known.rows.length)) {
          // Never combine independent cards merely because an import overlaps one post.
          if (!existing && known.rows.length === posts.length && new Set(known.rows.map(r => r.card_id)).size === 1)
            return { id: String(known.rows[0]!.card_id), created: false }
          throw new CaptureValidationError('A post already belongs to another card; use its original thread URL')
        }
        const receipts = await q('SELECT original_key FROM capture_receipt WHERE original_key=ANY($1::text[])', [posts.map(p => p.key)])
        const expired = new Set(receipts.rows.map(r => r.original_key))
        const fresh = posts.filter(p => !expired.has(p.key))
        if (!fresh.length)
          throw new CaptureValidationError('This content expired and cannot be imported again.')
        const previouslyKnown = new Set(known.rows.map(r => r.original_key))
        if (fresh.some(p => !previouslyKnown.has(p.key) && Date.parse(p.publishedAt) < Date.parse(source.trackingSince)))
          throw new CaptureValidationError('Content predates source tracking; provide an older thread root only as its URL')
        const imageBytes = images.reduce((n, i) => n + i.data.byteLength, 0)
        await capacity(q, imageBytes * 2 + Buffer.byteLength(JSON.stringify(input)) * 2 + 65536)
        let id = existing?.id as string | undefined
        if (!id) {
          const result = await q(`INSERT INTO capture_card(source_id,title,author,original_url,thread_key,published_at,incomplete_reason,continuation_of,thread_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [input.sourceId, input.title, input.author, fresh[0]!.url, root, fresh.reduce((a, p) => p.publishedAt < a ? p.publishedAt : a, fresh[0]!.publishedAt), input.incompleteReason?.trim() || null, rootExpired ? root : null, input.threadUrl ?? posts[0]!.url])
          id = String(result.rows[0]!.id)
        }
        for (const p of fresh) await q(`INSERT INTO capture_post(original_key,card_id,url,published_at,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(original_key) DO UPDATE SET body=EXCLUDED.body`, [p.key, id, p.url, p.publishedAt, p.body])
        const usage = Number((await q('SELECT coalesce(sum(octet_length(data)),0) AS bytes FROM capture_image')).rows[0]!.bytes)
        let extraBytes = 0
        let count = Number((await q('SELECT count(*) AS count FROM capture_image WHERE card_id=$1', [id])).rows[0]!.count)
        for (const img of images) {
          const digest = createHash('sha256').update(img.data).digest('hex')
          if ((await q('SELECT id FROM capture_image WHERE card_id=$1 AND digest=$2', [id, digest])).rows.length)
            continue
          extraBytes += img.data.byteLength
          if (++count > 128)
            throw new CaptureValidationError('At most 128 images per card')
          if (usage + extraBytes > imageLimit)
            throw new CaptureValidationError('Image storage safety limit reached; save fewer or smaller images')
          await q('INSERT INTO capture_image(card_id,data,mime_type,alt,digest,position) VALUES($1,$2,$3,$4,$5,$6)', [id, Buffer.from(img.data), img.mimeType, img.alt, digest, count])
        }
        await q(`UPDATE capture_card SET title=$2,author=$3,incomplete_reason=$4,updated_at=now(),published_at=(SELECT min(published_at) FROM capture_post WHERE card_id=$1),original_url=(SELECT url FROM capture_post WHERE card_id=$1 ORDER BY published_at,original_key LIMIT 1) WHERE id=$1`, [id, input.title, input.author, input.incompleteReason?.trim() || null])
        return { id, created: !existing }
      })
    },
    async readImage(id) {
      const row = (await db.query('SELECT i.data,i.mime_type FROM capture_image i JOIN capture_card c ON c.id=i.card_id WHERE i.id=$1 AND c.expires_at>now()', [id])).rows[0]
      return row ? { data: row.data as Uint8Array, mimeType: String(row.mime_type) } : null
    },
    async listRuns() {
      return (await db.query(`SELECT id,source_id AS "sourceId",started_at AS "startedAt",finished_at AS "finishedAt",status,added_count AS "addedCount",message FROM capture_run WHERE started_at>now()-interval '7 days' ORDER BY started_at DESC LIMIT 100`)).rows.map(r => dates<CaptureRun>(r))
    },
    async recordRun(input) {
      if (!input || typeof input.sourceId !== 'string' || (input.message !== undefined && typeof input.message !== 'string') || !['success', 'partial', 'failed'].includes(input.status) || !Number.isInteger(input.addedCount) || input.addedCount < 0 || (input.message?.length ?? 0) > 2000)
        throw new CaptureValidationError('Invalid capture run')
      await write(async (q) => {
        await capacity(q, 8192)
        await q('INSERT INTO capture_run(source_id,status,added_count,message,finished_at) VALUES($1,$2,$3,$4,now())', [input.sourceId, input.status, input.addedCount, input.message ?? null])
      })
    },
    async storageUsage() {
      const row = (await db.query('SELECT coalesce(sum(octet_length(i.data)),0) AS bytes FROM capture_image i JOIN capture_card c ON c.id=i.card_id WHERE c.expires_at>now()')).rows[0]!
      return { bytes: Number(row.bytes), limitBytes: imageLimit }
    },
    prune: () => write(prune),
  }
}
const productionDatabase: CaptureDatabase = {
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return { rows: await neon(databaseUrl()).query(sql, params) as T[] }
  },
  async transaction(work) {
    const pool = new Pool({ connectionString: databaseUrl() })
    try {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await work(async (sql, params = []) => client.query(sql, params))
        await client.query('COMMIT')
        return result
      }
      catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      }
      finally { client.release() }
    }
    finally { await pool.end() }
  },
}
export const captureStore = createCaptureStore(productionDatabase)
