import { sql } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/lib/db'
import 'server-only'

export interface SignalProvenanceCitation {
  firstSeenAt: string
  id: string
  itemTitle: string
  itemUrl: string | null
}

export interface SignalProvenancePublisher {
  citations: SignalProvenanceCitation[]
  id: string
  isOrigin: boolean
  name: string
}

export interface SignalProvenance {
  admittedBy: 'interest' | 'convergence'
  entryId: string
  originUrl: string
  publishers: SignalProvenancePublisher[]
  signalId: string
  strength: number
  summary: string | null
  title: string
}

export interface SignalProvenanceRow {
  [key: string]: unknown
  admitted_by: string | null
  citation_first_seen_at: Date | string | null
  citation_id: string | null
  entry_signal_id: string | null
  item_title: string | null
  item_url: string | null
  origin_publisher_id: string | null
  origin_publisher_name: string | null
  origin_url: string | null
  publisher_id: string | null
  publisher_name: string | null
  signal_id: string | null
  strength: number | null
  summary: string | null
  title: string | null
}

export type SignalProvenanceRowsQuery = (
  userId: string,
  entrySignalId: string,
) => Promise<readonly SignalProvenanceRow[]>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function webUrl(value: string | null, label: string): string {
  if (value === null)
    throw new Error(`Signal provenance has no ${label}`)
  let parsed: URL
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error(`Signal provenance has an invalid ${label}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    throw new Error(`Signal provenance has an invalid ${label} scheme`)
  return value
}

function nonempty(value: string | null, label: string): string {
  if (value === null || value.trim() === '')
    throw new Error(`Signal provenance has no ${label}`)
  return value
}

function timestamp(value: Date | string | null): string {
  if (value === null)
    throw new Error('Signal provenance Citation has no first-seen timestamp')
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime()))
    throw new Error('Signal provenance Citation has an invalid first-seen timestamp')
  return parsed.toISOString()
}

function sameProjection(left: SignalProvenanceRow, right: SignalProvenanceRow): boolean {
  return left.admitted_by === right.admitted_by
    && left.entry_signal_id === right.entry_signal_id
    && left.origin_publisher_id === right.origin_publisher_id
    && left.origin_publisher_name === right.origin_publisher_name
    && left.origin_url === right.origin_url
    && left.signal_id === right.signal_id
    && left.strength === right.strength
    && left.summary === right.summary
    && left.title === right.title
}

function provenanceFrom(
  rows: readonly SignalProvenanceRow[],
  requestedEntryId: string,
): SignalProvenance | null {
  const first = rows[0]
  if (first === undefined)
    return null

  if (first.entry_signal_id !== requestedEntryId || !UUID.test(first.entry_signal_id))
    throw new Error('Signal provenance returned the wrong Brief Entry')
  if (first.signal_id === null || !UUID.test(first.signal_id))
    throw new Error('Signal provenance could not resolve its Signal root')
  if (first.admitted_by !== 'interest' && first.admitted_by !== 'convergence')
    throw new Error('Signal provenance has an invalid Admission')
  if (!Number.isSafeInteger(first.strength) || (first.strength ?? -1) < 0)
    throw new Error('Signal provenance has an invalid Strength')
  if (first.origin_publisher_id !== null && !UUID.test(first.origin_publisher_id))
    throw new Error('Signal provenance has an invalid origin Publisher')
  if (first.origin_publisher_id === null && first.origin_publisher_name !== null)
    throw new Error('Signal provenance has an origin Publisher name without an origin')
  const originPublisherName = first.origin_publisher_id === null
    ? null
    : nonempty(first.origin_publisher_name, 'origin Publisher name')
  const originUrl = webUrl(first.origin_url, 'origin Link')
  const title = nonempty(first.title, 'title')
  if (first.summary !== null && first.summary.trim() === '')
    throw new Error('Signal provenance has an invalid summary')

  for (const row of rows) {
    if (!sameProjection(first, row))
      throw new Error('Signal provenance query mixed more than one projection')
  }

  interface PublisherAccumulator extends SignalProvenancePublisher {
    firstSeenAt: string
  }

  const publishers = new Map<string, PublisherAccumulator>()
  const citationIds = new Set<string>()
  for (const row of rows) {
    const requiredCitationFields = [
      row.citation_id,
      row.citation_first_seen_at,
      row.item_title,
      row.publisher_id,
      row.publisher_name,
    ]
    if (requiredCitationFields.every(value => value === null)) {
      if (row.item_url !== null)
        throw new Error('Signal provenance returned a partial Citation')
      continue
    }
    if (requiredCitationFields.includes(null))
      throw new Error('Signal provenance returned a partial Citation')
    if (!UUID.test(row.citation_id!) || citationIds.has(row.citation_id!))
      throw new Error('Signal provenance returned an invalid or duplicate Citation')
    if (!UUID.test(row.publisher_id!))
      throw new Error('Signal provenance Citation has an invalid Publisher')

    const firstSeenAt = timestamp(row.citation_first_seen_at)
    const publisherName = nonempty(row.publisher_name, 'Citation Publisher name')
    const itemTitle = nonempty(row.item_title, 'citing Item title')
    const itemUrl = row.item_url === null ? null : webUrl(row.item_url, 'citing Item Link')
    const isOrigin = row.publisher_id === first.origin_publisher_id
    const existing = publishers.get(row.publisher_id!)
    if (existing !== undefined && (existing.name !== publisherName || existing.isOrigin !== isOrigin))
      throw new Error('Signal provenance returned inconsistent Publisher data')

    citationIds.add(row.citation_id!)
    const publisher = existing ?? {
      citations: [],
      firstSeenAt,
      id: row.publisher_id!,
      isOrigin,
      name: publisherName,
    }
    publisher.citations.push({
      firstSeenAt,
      id: row.citation_id!,
      itemTitle,
      itemUrl,
    })
    if (firstSeenAt < publisher.firstSeenAt)
      publisher.firstSeenAt = firstSeenAt
    publishers.set(publisher.id, publisher)
  }

  if (first.origin_publisher_id !== null && originPublisherName !== null) {
    const existingOrigin = publishers.get(first.origin_publisher_id)
    if (existingOrigin !== undefined && existingOrigin.name !== originPublisherName)
      throw new Error('Signal provenance returned inconsistent origin Publisher data')
    if (existingOrigin === undefined) {
      publishers.set(first.origin_publisher_id, {
        citations: [],
        firstSeenAt: '',
        id: first.origin_publisher_id,
        isOrigin: true,
        name: originPublisherName,
      })
    }
  }

  const orderedPublishers = [...publishers.values()]
  for (const publisher of orderedPublishers) {
    publisher.citations.sort((left, right) =>
      left.firstSeenAt.localeCompare(right.firstSeenAt) || left.id.localeCompare(right.id))
  }
  orderedPublishers.sort((left, right) =>
    Number(left.isOrigin) - Number(right.isOrigin)
    || left.firstSeenAt.localeCompare(right.firstSeenAt)
    || left.id.localeCompare(right.id))

  const contributingPublisherCount = orderedPublishers.filter(publisher => !publisher.isOrigin).length
  if (contributingPublisherCount !== first.strength) {
    throw new Error(
      `Signal provenance has Strength ${first.strength} but ${contributingPublisherCount} contributing Publishers`,
    )
  }

  return {
    admittedBy: first.admitted_by,
    entryId: first.entry_signal_id,
    originUrl,
    publishers: orderedPublishers.map(({ firstSeenAt: _, ...publisher }) => publisher),
    signalId: first.signal_id,
    strength: first.strength,
    summary: first.summary,
    title,
  }
}

export function createSignalProvenanceReader(queryRows: SignalProvenanceRowsQuery) {
  return async (userId: string, entrySignalId: string): Promise<SignalProvenance | null> => {
    if (!UUID.test(userId))
      throw new Error('Signal provenance requires an authenticated reader id')
    if (!UUID.test(entrySignalId))
      return null
    return provenanceFrom(await queryRows(userId, entrySignalId), entrySignalId)
  }
}

export function signalProvenanceStatement(userId: string, entrySignalId: string) {
  return sql`
    WITH RECURSIVE
    selected_entry AS (
      SELECT
        entry."signal_id" AS "entry_signal_id",
        entry."admitted_by"
      FROM "brief_entry" AS entry
      WHERE entry."user_id" = ${userId}::uuid
        AND entry."signal_id" = ${entrySignalId}::uuid
    ),
    signal_walk AS (
      SELECT
        selected_entry."entry_signal_id" AS "original_id",
        signal_row."id" AS "current_id",
        signal_row."merged_into_id",
        ARRAY[signal_row."id"]::uuid[] AS "path"
      FROM selected_entry
      INNER JOIN "signal" AS signal_row
        ON signal_row."id" = selected_entry."entry_signal_id"

      UNION ALL

      SELECT
        signal_walk."original_id",
        next_signal."id" AS "current_id",
        next_signal."merged_into_id",
        array_append(signal_walk."path", next_signal."id")
      FROM signal_walk
      INNER JOIN "signal" AS next_signal
        ON next_signal."id" = signal_walk."merged_into_id"
      WHERE signal_walk."merged_into_id" IS NOT NULL
        AND NOT next_signal."id" = ANY(signal_walk."path")
    ),
    resolved_signal AS (
      SELECT signal_walk."current_id" AS "root_id"
      FROM signal_walk
      WHERE signal_walk."merged_into_id" IS NULL
    ),
    member_walk AS (
      SELECT
        resolved_signal."root_id",
        resolved_signal."root_id" AS "member_id",
        ARRAY[resolved_signal."root_id"]::uuid[] AS "path"
      FROM resolved_signal

      UNION ALL

      SELECT
        member_walk."root_id",
        alias_signal."id" AS "member_id",
        array_append(member_walk."path", alias_signal."id")
      FROM member_walk
      INNER JOIN "signal" AS alias_signal
        ON alias_signal."merged_into_id" = member_walk."member_id"
      WHERE NOT alias_signal."id" = ANY(member_walk."path")
    ),
    members AS (
      SELECT DISTINCT "root_id", "member_id"
      FROM member_walk
    )
    SELECT
      selected_entry."entry_signal_id"::text AS "entry_signal_id",
      selected_entry."admitted_by"::text AS "admitted_by",
      root_signal."id"::text AS "signal_id",
      root_signal."strength",
      root_signal."origin_publisher_id"::text AS "origin_publisher_id",
      origin_publisher."name" AS "origin_publisher_name",
      target_link."url" AS "origin_url",
      COALESCE(
        own_item."title",
        cited_anchor."anchor_text",
        citing_item."title",
        root_signal."embedding_text",
        target_link."url"
      ) AS "title",
      own_item."summary" AS "summary",
      citation_row."id"::text AS "citation_id",
      citation_row."first_seen_at" AS "citation_first_seen_at",
      citing_item_row."title" AS "item_title",
      citing_item_row."url" AS "item_url",
      citing_publisher."id"::text AS "publisher_id",
      citing_publisher."name" AS "publisher_name"
    FROM selected_entry
    INNER JOIN resolved_signal ON TRUE
    INNER JOIN "signal" AS root_signal
      ON root_signal."id" = resolved_signal."root_id"
    INNER JOIN "link" AS target_link
      ON target_link."id" = root_signal."target_link_id"
    LEFT JOIN "publisher" AS origin_publisher
      ON origin_publisher."id" = root_signal."origin_publisher_id"
    LEFT JOIN LATERAL (
      SELECT own."title", own."summary"
      FROM members AS own_member
      INNER JOIN "signal" AS own_signal
        ON own_signal."id" = own_member."member_id"
      INNER JOIN "citation" AS own_citation
        ON own_citation."link_id" = own_signal."target_link_id"
      INNER JOIN "item" AS own
        ON own."id" = own_citation."item_id"
      WHERE own_citation."kind" = 'self'
        AND own_member."root_id" = root_signal."id"
      ORDER BY length(COALESCE(own."summary", '')) DESC, own."id"
      LIMIT 1
    ) AS own_item ON TRUE
    LEFT JOIN LATERAL (
      SELECT outbound."anchor_text"
      FROM members AS cited_member
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
      FROM members AS cited_member
      INNER JOIN "signal" AS cited_signal
        ON cited_signal."id" = cited_member."member_id"
      INNER JOIN "citation" AS outbound
        ON outbound."link_id" = cited_signal."target_link_id"
      INNER JOIN "item" AS citing
        ON citing."id" = outbound."item_id"
      INNER JOIN "source" AS citing_source
        ON citing_source."id" = citing."source_id"
      WHERE outbound."kind" = 'outbound'
        AND cited_member."root_id" = root_signal."id"
        AND citing_source."is_aggregator" = false
      ORDER BY length(citing."title") DESC, citing."id"
      LIMIT 1
    ) AS citing_item ON TRUE
    LEFT JOIN members AS cited_member
      ON cited_member."root_id" = root_signal."id"
    LEFT JOIN "signal" AS cited_signal
      ON cited_signal."id" = cited_member."member_id"
    LEFT JOIN "citation" AS citation_row
      ON citation_row."link_id" = cited_signal."target_link_id"
    LEFT JOIN "item" AS citing_item_row
      ON citing_item_row."id" = citation_row."item_id"
    LEFT JOIN "source" AS citing_source_row
      ON citing_source_row."id" = citation_row."source_id"
    LEFT JOIN "publisher" AS citing_publisher
      ON citing_publisher."id" = citing_source_row."publisher_id"
    ORDER BY
      CASE WHEN citing_publisher."id" = root_signal."origin_publisher_id" THEN 1 ELSE 0 END,
      citation_row."first_seen_at" NULLS LAST,
      citing_publisher."id",
      citation_row."id"
  `
}

async function querySignalProvenanceRows(
  userId: string,
  entrySignalId: string,
): Promise<readonly SignalProvenanceRow[]> {
  const result = await db().execute<SignalProvenanceRow>(signalProvenanceStatement(userId, entrySignalId))
  return result.rows
}

const readSignalProvenanceForEntry = createSignalProvenanceReader(querySignalProvenanceRows)

export const readSignalProvenance = cache(readSignalProvenanceForEntry)
