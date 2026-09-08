import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { jwtVerify, SignJWT } from 'jose'
import { ownedSignalGraph, ownedSignalWalk } from '@/lib/briefs/postgres'
import { briefStatement } from '@/lib/briefs/today'
import 'server-only'

export interface SavedEntry {
  signalId: string
  entryId: string
  title: string
  originUrl: string
  originName: string
  savedAt: string
  savedDate: string
  briefDate: string
}

export interface SavedPage {
  entries: SavedEntry[]
  page: number
  hasNext: boolean
}

interface Dependencies {
  execute: <T extends Record<string, unknown>>(statement: SQL) => Promise<{ rows: T[] }>
  verifySession: () => Promise<{ userId: string }>
  undoSecret: () => string
}

const PAGE_SIZE = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertSignalId(value: string) {
  if (!UUID.test(value))
    throw new Error('Invalid Signal id')
}

export function savedPageNumber(value: unknown): number {
  const page = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value
  return typeof page === 'number' && Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1
}

function savedStatement(userId: string, page: number) {
  return sql`
    ${ownedSignalGraph(userId)},
    saved_roots AS (
      SELECT member.root_id, max(bookmark.saved_at) AS saved_at
      FROM bookmark
      JOIN authorized_member member ON member.member_id = bookmark.signal_id
      WHERE bookmark.user_id = ${userId}::uuid
      GROUP BY member.root_id
      ORDER BY max(bookmark.saved_at) DESC, member.root_id
      LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
    )
    SELECT saved.root_id AS "signalId", latest.signal_id AS "entryId",
      display.title, display.origin_url AS "originUrl",
      COALESCE(origin.name, '') AS "originName",
      saved.saved_at::text AS "savedAt",
      (saved.saved_at AT TIME ZONE reader.timezone)::date::text AS "savedDate",
      latest.local_date::text AS "briefDate"
    FROM saved_roots saved
    JOIN "user" reader ON reader.id = ${userId}::uuid
    JOIN signal root ON root.id = saved.root_id
    LEFT JOIN publisher origin ON origin.id = root.origin_publisher_id
    JOIN LATERAL (
      SELECT entry.signal_id, brief.local_date
      FROM brief_entry entry
      JOIN brief ON brief.id = entry.brief_id AND brief.user_id = entry.user_id
      JOIN authorized_member member ON member.member_id = entry.signal_id
      WHERE entry.user_id = ${userId}::uuid AND member.root_id = saved.root_id
      ORDER BY brief.local_date DESC, entry.position, entry.signal_id
      LIMIT 1
    ) latest ON TRUE
    JOIN LATERAL (
      ${briefStatement(userId, sql`latest.local_date`)}
    ) display ON display.entry_signal_id = latest.signal_id::text
    ORDER BY saved.saved_at DESC, saved.root_id
  `
}

export function createSavedBookmarks(dependencies: Dependencies) {
  async function read(page = 1): Promise<SavedPage> {
    const { userId } = await dependencies.verifySession()
    page = savedPageNumber(page)
    const result = await dependencies.execute<SavedEntry & Record<string, unknown>>(savedStatement(userId, page))
    for (const entry of result.rows) {
      if (!URL.canParse(entry.originUrl) || !['https:', 'http:'].includes(new URL(entry.originUrl).protocol))
        throw new Error('Invalid Bookmark origin')
    }
    return { entries: result.rows.slice(0, PAGE_SIZE), page, hasNext: result.rows.length > PAGE_SIZE }
  }
  function signingKey() {
    const key = new TextEncoder().encode(dependencies.undoSecret())
    if (key.byteLength < 32)
      throw new Error('Bookmark Undo requires a signing key of at least 32 bytes')
    return key
  }

  async function remove(signalId: string): Promise<string | null> {
    const { userId } = await dependencies.verifySession()
    assertSignalId(signalId)
    const key = signingKey()
    const { rows } = await dependencies.execute<{ authorized: boolean, saved_at: string | null }>(sql`
      ${ownedSignalWalk(userId, signalId)},
      removed AS (
        DELETE FROM bookmark
        USING authorized_member member, authorized_signal permitted
        WHERE bookmark.user_id = ${userId}::uuid
          AND bookmark.signal_id = member.member_id
          AND member.root_id = permitted.signal_id
        RETURNING bookmark.saved_at
      )
      SELECT EXISTS (SELECT 1 FROM authorized_signal) AS authorized,
        (SELECT max(saved_at)::text FROM removed) AS saved_at
    `)
    const result = rows[0]
    if (!result?.authorized)
      throw new Error('Signal is not authorized for this reader')
    if (!result.saved_at)
      return null
    return new SignJWT({ signalId, savedAt: result.saved_at })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('zis-bookmark-undo')
      .setAudience('zis-bookmark-undo')
      .setSubject(userId)
      .setIssuedAt()
      .sign(key)
  }

  async function undo(receipt: string): Promise<void> {
    const { userId } = await dependencies.verifySession()
    const { payload } = await jwtVerify(receipt, signingKey(), {
      algorithms: ['HS256'],
      issuer: 'zis-bookmark-undo',
      audience: 'zis-bookmark-undo',
      requiredClaims: ['sub', 'iat'],
    })
    if (payload.sub !== userId || typeof payload.signalId !== 'string'
      || typeof payload.savedAt !== 'string' || !Number.isFinite(Date.parse(payload.savedAt))) {
      throw new Error('Invalid Bookmark Undo receipt')
    }
    assertSignalId(payload.signalId)
    const { rows } = await dependencies.execute<{ authorized: boolean }>(sql`
      ${ownedSignalWalk(userId, payload.signalId)},
      restored AS (
        INSERT INTO bookmark (user_id, signal_id, saved_at)
        SELECT ${userId}::uuid, signal_id, ${payload.savedAt}::timestamptz
        FROM authorized_signal
        ON CONFLICT (user_id, signal_id) DO UPDATE
          SET saved_at = greatest(bookmark.saved_at, EXCLUDED.saved_at)
        RETURNING signal_id
      )
      SELECT EXISTS (SELECT 1 FROM authorized_signal) AS authorized
    `)
    if (!rows[0]?.authorized)
      throw new Error('Signal is not authorized for this reader')
  }

  return { read, remove, undo }
}
