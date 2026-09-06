import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/lib/db'
import 'server-only'

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

function briefStatement(userId: string, localDate: SQL) {
  return sql`
    WITH RECURSIVE
    reader AS (
      SELECT
        reader_user."id",
        ${localDate} AS "local_date"
      FROM "user" AS reader_user
      WHERE reader_user."id" = ${userId}::uuid
    ),
    selected_brief AS (
      SELECT selected.*
      FROM "brief" AS selected
      INNER JOIN reader ON reader."id" = selected."user_id"
        AND reader."local_date" = selected."local_date"
    ),
    previous_brief AS (
      SELECT previous."local_date"
      FROM "brief" AS previous
      INNER JOIN reader ON reader."id" = previous."user_id"
      WHERE previous."local_date" < reader."local_date"
      ORDER BY previous."local_date" DESC
      LIMIT 1
    ),
    brief_signal_walk AS (
      SELECT
        seed_entry."signal_id" AS "original_id",
        signal_row."id" AS "current_id",
        signal_row."merged_into_id",
        ARRAY[signal_row."id"]::uuid[] AS "path"
      FROM "brief_entry" AS seed_entry
      INNER JOIN selected_brief
        ON selected_brief."id" = seed_entry."brief_id"
      INNER JOIN reader ON reader."id" = seed_entry."user_id"
      INNER JOIN "signal" AS signal_row
        ON signal_row."id" = seed_entry."signal_id"

      UNION ALL

      SELECT
        brief_signal_walk."original_id",
        next_signal."id" AS "current_id",
        next_signal."merged_into_id",
        array_append(brief_signal_walk."path", next_signal."id")
      FROM brief_signal_walk
      INNER JOIN "signal" AS next_signal
        ON next_signal."id" = brief_signal_walk."merged_into_id"
      WHERE brief_signal_walk."merged_into_id" IS NOT NULL
        AND NOT next_signal."id" = ANY(brief_signal_walk."path")
    ),
    brief_signal_root AS (
      SELECT
        brief_signal_walk."original_id",
        brief_signal_walk."current_id" AS "root_id"
      FROM brief_signal_walk
      WHERE brief_signal_walk."merged_into_id" IS NULL
    ),
    root_member_walk AS (
      SELECT DISTINCT
        brief_signal_root."root_id",
        brief_signal_root."root_id" AS "member_id",
        ARRAY[brief_signal_root."root_id"]::uuid[] AS "path"
      FROM brief_signal_root

      UNION ALL

      SELECT
        root_member_walk."root_id",
        alias_signal."id" AS "member_id",
        array_append(root_member_walk."path", alias_signal."id")
      FROM root_member_walk
      INNER JOIN "signal" AS alias_signal
        ON alias_signal."merged_into_id" = root_member_walk."member_id"
      WHERE NOT alias_signal."id" = ANY(root_member_walk."path")
    ),
    root_member AS (
      SELECT DISTINCT "root_id", "member_id"
      FROM root_member_walk
    )
    SELECT
      reader."local_date"::text AS "local_date",
      selected_brief."id"::text AS "brief_id",
      previous_brief."local_date"::text AS "previous_brief_date",
      brief_entry."signal_id"::text AS "entry_signal_id",
      resolved_entry."root_id"::text AS "signal_id",
      brief_entry."position",
      brief_entry."admitted_by"::text,
      brief_entry."why_text",
      target_link."url" AS "origin_url",
      COALESCE(
        own_item."title",
        cited_anchor."anchor_text",
        citing_item."title",
        root_signal."embedding_text",
        target_link."url"
      ) AS "title",
      own_item."summary" AS "summary",
      CASE WHEN root_signal."id" IS NULL THEN NULL ELSE EXISTS (
        SELECT 1
        FROM "bookmark" AS bookmark_row
        INNER JOIN root_member AS bookmarked_member
          ON bookmarked_member."member_id" = bookmark_row."signal_id"
          AND bookmarked_member."root_id" = root_signal."id"
        WHERE bookmark_row."user_id" = reader."id"
      ) END AS "is_bookmarked",
      CASE WHEN root_signal."id" IS NULL THEN NULL ELSE EXISTS (
        SELECT 1
        FROM "read_state" AS read_row
        INNER JOIN root_member AS read_member
          ON read_member."member_id" = read_row."signal_id"
          AND read_member."root_id" = root_signal."id"
        WHERE read_row."user_id" = reader."id"
      ) END AS "is_read"
    FROM reader
    LEFT JOIN selected_brief ON TRUE
    LEFT JOIN previous_brief ON TRUE
    LEFT JOIN "brief_entry" AS brief_entry
      ON brief_entry."brief_id" = selected_brief."id"
      AND brief_entry."user_id" = reader."id"
    LEFT JOIN brief_signal_root AS resolved_entry
      ON resolved_entry."original_id" = brief_entry."signal_id"
    LEFT JOIN "signal" AS root_signal
      ON root_signal."id" = resolved_entry."root_id"
    LEFT JOIN "link" AS target_link
      ON target_link."id" = root_signal."target_link_id"
    LEFT JOIN LATERAL (
      SELECT own."title", own."summary"
      FROM root_member AS own_member
      INNER JOIN "signal" AS own_signal
        ON own_signal."id" = own_member."member_id"
      INNER JOIN "citation" AS own_citation
        ON own_citation."link_id" = own_signal."target_link_id"
      INNER JOIN "item" AS own ON own."id" = own_citation."item_id"
      WHERE own_citation."kind" = 'self'
        AND own_member."root_id" = root_signal."id"
      ORDER BY length(COALESCE(own."summary", '')) DESC, own."id"
      LIMIT 1
    ) AS own_item ON TRUE
    LEFT JOIN LATERAL (
      SELECT outbound."anchor_text"
      FROM root_member AS cited_member
      INNER JOIN "signal" AS cited_signal
        ON cited_signal."id" = cited_member."member_id"
      INNER JOIN "citation" AS outbound
        ON outbound."link_id" = cited_signal."target_link_id"
      WHERE outbound."kind" = 'outbound'
        AND outbound."anchor_text" IS NOT NULL
        AND cited_member."root_id" = root_signal."id"
      ORDER BY length(outbound."anchor_text") DESC, outbound."id"
      LIMIT 1
    ) AS cited_anchor ON TRUE
    LEFT JOIN LATERAL (
      SELECT citing."title"
      FROM root_member AS cited_member
      INNER JOIN "signal" AS cited_signal
        ON cited_signal."id" = cited_member."member_id"
      INNER JOIN "citation" AS outbound
        ON outbound."link_id" = cited_signal."target_link_id"
      INNER JOIN "item" AS citing ON citing."id" = outbound."item_id"
      INNER JOIN "source" AS citing_source ON citing_source."id" = citing."source_id"
      WHERE outbound."kind" = 'outbound'
        AND cited_member."root_id" = root_signal."id"
        AND citing_source."is_aggregator" = false
      ORDER BY length(citing."title") DESC, citing."id"
      LIMIT 1
    ) AS citing_item ON TRUE
    ORDER BY brief_entry."position" NULLS LAST
  `
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
    SELECT b."local_date"::text AS "local_date", lead_entry."title" AS "lead_title"
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
  const result = await db().execute<{ local_date: string, lead_title: string | null }>(earlierBriefsStatement(userId))
  return result.rows
})
