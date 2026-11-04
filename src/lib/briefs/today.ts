import { sql } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/lib/db'
import { briefStatement } from './projection'
import 'server-only'

export { briefStatement } from './projection'

export interface TodayBriefEntry {
  admittedBy: 'interest' | 'convergence'
  entryId: string
  isBookmarked: boolean
  isRead: boolean
  originUrl: string
  position: number
  signalId: string
  summary: string | null
  title: string
  whyText: string
}

export interface TodayBrief {
  entries: TodayBriefEntry[]
  hasBrief: boolean
  localDate: string
  previousBriefDate: string | null
}

export interface TodayBriefRow {
  [key: string]: unknown
  admitted_by: string | null
  brief_id: string | null
  entry_signal_id: string | null
  is_bookmarked: boolean | null
  is_read: boolean | null
  local_date: string
  origin_url: string | null
  position: number | null
  previous_brief_date: string | null
  signal_id: string | null
  summary: string | null
  title: string | null
  why_text: string | null
}

export type TodayBriefRowsQuery = (
  userId: string,
  at: Date,
) => Promise<readonly TodayBriefRow[]>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

function assertLocalDate(value: string | null, label: string): asserts value is string {
  if (value === null || !LOCAL_DATE.test(value))
    throw new Error(`Today Brief ${label} has an invalid local date`)
}

function entryFrom(row: TodayBriefRow): TodayBriefEntry {
  if (row.entry_signal_id === null || !UUID.test(row.entry_signal_id))
    throw new Error('Today Brief Entry has an invalid frozen Signal id')
  if (row.signal_id === null)
    throw new Error('Today Brief Entry could not resolve its Signal root')
  if (!UUID.test(row.signal_id))
    throw new Error('Today Brief Entry has an invalid resolved Signal id')
  if (!Number.isSafeInteger(row.position) || (row.position ?? 0) < 1)
    throw new Error('Today Brief Entry has an invalid position')
  if (row.admitted_by !== 'interest' && row.admitted_by !== 'convergence')
    throw new Error('Today Brief Entry has an invalid Admission')
  if (row.title === null || row.title.trim() === '')
    throw new Error('Today Brief Entry has no display title')
  if (row.summary !== null && row.summary.trim() === '')
    throw new Error('Today Brief Entry has an invalid summary')
  if (row.why_text === null || row.why_text.trim() === '')
    throw new Error('Today Brief Entry has no frozen why-text')
  if (row.origin_url === null)
    throw new Error('Today Brief Entry has no origin Link')
  let origin: URL
  try {
    origin = new URL(row.origin_url)
  }
  catch {
    throw new Error('Today Brief Entry has an invalid origin Link')
  }
  if (origin.protocol !== 'https:' && origin.protocol !== 'http:')
    throw new Error('Today Brief Entry has an invalid origin Link scheme')
  if (typeof row.is_bookmarked !== 'boolean' || typeof row.is_read !== 'boolean')
    throw new Error('Today Brief Entry has invalid reader state')

  return {
    admittedBy: row.admitted_by,
    entryId: row.entry_signal_id,
    isBookmarked: row.is_bookmarked,
    isRead: row.is_read,
    originUrl: row.origin_url,
    position: row.position as number,
    signalId: row.signal_id,
    summary: row.summary,
    title: row.title,
    whyText: row.why_text,
  }
}

function briefFrom(rows: readonly TodayBriefRow[]): TodayBrief {
  const first = rows[0]
  if (first === undefined)
    throw new Error('Authenticated reader has no Today Brief projection')

  assertLocalDate(first.local_date, 'projection')
  if (first.previous_brief_date !== null)
    assertLocalDate(first.previous_brief_date, 'previous Brief')

  for (const row of rows) {
    if (row.local_date !== first.local_date
      || row.previous_brief_date !== first.previous_brief_date
      || row.brief_id !== first.brief_id) {
      throw new Error('Today Brief projection mixed more than one Brief')
    }
  }

  const hasBrief = first.brief_id !== null
  const entryRows = rows.filter(row => row.entry_signal_id !== null)
  if (!hasBrief && entryRows.length > 0)
    throw new Error('Today Brief projection returned Entries without a Brief')

  const entries = entryRows.map(entryFrom).sort((left, right) => left.position - right.position)
  if (new Set(entries.map(entry => entry.position)).size !== entries.length)
    throw new Error('Today Brief projection returned duplicate positions')
  return {
    entries,
    hasBrief,
    localDate: first.local_date,
    previousBriefDate: first.previous_brief_date,
  }
}

export function createTodayBriefReader(queryRows: TodayBriefRowsQuery) {
  return async (userId: string, at: Date): Promise<TodayBrief> => {
    if (!UUID.test(userId))
      throw new Error('Today Brief requires an authenticated reader id')
    if (!Number.isFinite(at.getTime()))
      throw new Error('Today Brief requires a valid time')
    return briefFrom(await queryRows(userId, at))
  }
}

export function todayBriefStatement(userId: string, at: Date) {
  return briefStatement(userId, sql`(${at.toISOString()}::timestamptz AT TIME ZONE reader_user."timezone")::date`)
}

export function isBriefDate(value: string): boolean {
  if (!LOCAL_DATE.test(value) || value < '0001-01-01')
    return false
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function datedBriefStatement(userId: string, localDate: string) {
  return briefStatement(userId, sql`${localDate}::date`)
}

export function createDatedBriefReader(queryRows: (userId: string, localDate: string) => Promise<readonly TodayBriefRow[]>) {
  return async (userId: string, localDate: string): Promise<TodayBrief> => {
    if (!UUID.test(userId))
      throw new Error('Brief requires an authenticated reader id')
    if (!isBriefDate(localDate))
      throw new Error('Brief requires a valid calendar date')
    const brief = briefFrom(await queryRows(userId, localDate))
    if (brief.localDate !== localDate)
      throw new Error('Brief projection returned a different calendar date')
    return brief
  }
}

async function queryTodayBriefRows(userId: string, at: Date): Promise<readonly TodayBriefRow[]> {
  const result = await db().execute<TodayBriefRow>(todayBriefStatement(userId, at))
  return result.rows
}

const readTodayBriefAt = createTodayBriefReader(queryTodayBriefRows)

export const readTodayBrief = cache(async (userId: string): Promise<TodayBrief> =>
  readTodayBriefAt(userId, new Date()))

export const readDatedBrief = cache(createDatedBriefReader(async (userId, localDate) => {
  const result = await db().execute<TodayBriefRow>(datedBriefStatement(userId, localDate))
  return result.rows
}))

export function earlierBriefsStatement(userId: string) {
  return sql`
    SELECT b."local_date"::text AS "local_date", lead_entry."title" AS "lead_title", lead_entry."entry_signal_id" AS "entry_id"
    FROM "brief" b
    INNER JOIN "user" u ON u."id" = b."user_id"
    LEFT JOIN LATERAL (
      ${briefStatement(userId, sql`b."local_date"`)}
      LIMIT 1
    ) AS lead_entry ON TRUE
    WHERE b."user_id" = ${userId}::uuid
      AND b."local_date" < (now() AT TIME ZONE u."timezone")::date
    ORDER BY b."local_date" DESC
  `
}

export const readEarlierBriefs = cache(async (userId: string) => {
  if (!UUID.test(userId))
    throw new Error('Brief history requires an authenticated reader id')
  const result = await db().execute<{ local_date: string, lead_title: string | null, entry_id: string | null }>(earlierBriefsStatement(userId))
  return result.rows
})
