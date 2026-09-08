import type { SQL } from 'drizzle-orm'
import type { IngestionSource, PersistedGraph, PersistedSignal, SourceItemLookup } from './pipeline'
import type { Database } from '@/lib/db'
import { Buffer } from 'node:buffer'
import { and, eq, getTableColumns, gt, inArray, isNull, sql } from 'drizzle-orm'
import { briefEntries, citations, httpCache, items, links, readerSignalMatches, readStates, signals } from '@/lib/db/schema'
import { httpCacheKey, MAX_SIGNAL_AGE_MS } from './pipeline'

const PAGE_SIZE = 1000

export async function readSignalMetadata(database: Database, filter?: SQL): Promise<PersistedSignal[]> {
  const rows: PersistedSignal[] = []
  let afterId: string | undefined
  while (true) {
    const page = await database.select({
      ...getTableColumns(signals),
      embedding: sql<PersistedSignal['embedding']>`CASE WHEN ${signals.embedding} IS NULL THEN NULL ELSE '{"stored":true}'::jsonb END`,
    }).from(signals).where(and(filter, afterId === undefined ? undefined : gt(signals.id, afterId))).orderBy(signals.id).limit(PAGE_SIZE)
    rows.push(...page)
    if (page.length < PAGE_SIZE)
      return rows
    afterId = page.at(-1)!.id
  }
}

async function batches<T>(ids: readonly string[], read: (page: string[]) => PromiseLike<T[]>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE)
    rows.push(...await read(ids.slice(offset, offset + PAGE_SIZE)))
  return rows
}

function appendMissing<T>(target: T[], rows: T[], key: (row: T) => string): void {
  const existing = new Set(target.map(key))
  for (const row of rows) {
    if (!existing.has(key(row))) {
      target.push(row)
      existing.add(key(row))
    }
  }
}

/** Load existing identity/provenance only after a Source actually supplies Items. */
export async function loadSourceState(database: Database, graph: PersistedGraph, source: IngestionSource, lookups?: readonly SourceItemLookup[]): Promise<number> {
  if (lookups === undefined && !source.isAggregator)
    return 0
  const records = lookups === undefined
    ? await database.select().from(items).where(and(eq(items.sourceId, source.id), isNull(items.issueHydratedAt)))
    // Legacy URL-derived natural keys can differ by canonicalization. Keep the
    // compatibility fallback confined to the Source supplying a guid-less Item.
    : lookups.some(lookup => !lookup.hasGuid)
      ? await database.select().from(items).where(eq(items.sourceId, source.id))
      : await batches(lookups.map(lookup => lookup.externalId), ids => database.select().from(items).where(and(eq(items.sourceId, source.id), inArray(items.externalId, ids))))
  appendMissing(graph.items, records, row => row.id)
  const expectedHashes = new Map(lookups?.map(lookup => [lookup.externalId, lookup.inputHash]))
  const needsLegacyLookup = lookups?.some(lookup => !lookup.hasGuid) ?? false
  const provenanceItems = records.filter(row => needsLegacyLookup
    || row.ingestionInputHash !== expectedHashes.get(row.externalId)
    || (source.isAggregator && row.issueHydratedAt === null))
  const citationRows = await batches(provenanceItems.map(row => row.id), ids => database.select().from(citations).where(inArray(citations.itemId, ids)))
  appendMissing(graph.citations, citationRows, row => row.id)
  const linkIds = [...new Set(citationRows.map(row => row.linkId))]
  const linkRows = await batches(linkIds, ids => database.select().from(links).where(inArray(links.id, ids)))
  const signalRows = await batches(linkIds, ids => readSignalMetadata(database, inArray(signals.targetLinkId, ids)))
  appendMissing(graph.links, linkRows, row => row.id)
  appendMissing(graph.signals, signalRows, row => row.id)
  const cacheKeys = [...new Set([
    ...lookups?.flatMap(lookup => lookup.requestUrl === undefined ? [] : [httpCacheKey(lookup.requestUrl)]) ?? [],
    ...citationRows.filter(row => row.kind === 'self').map(row => httpCacheKey(row.rawUrl)),
  ])]
  const cacheRows = await batches(cacheKeys, keys => database.select().from(httpCache).where(inArray(httpCache.url, keys)))
  appendMissing(graph.httpCache, cacheRows, row => row.url)
  return Buffer.byteLength(JSON.stringify([records, citationRows, linkRows, signalRows, cacheRows]))
}

export async function loadCitationTargets(database: Database, graph: PersistedGraph, urls: readonly string[]): Promise<number> {
  const rows = await batches(urls, page => database.select().from(links).where(inArray(links.url, page)))
  const signalRows = await batches(rows.map(row => row.id), page => readSignalMetadata(database, inArray(signals.targetLinkId, page)))
  appendMissing(graph.links, rows, row => row.id)
  appendMissing(graph.signals, signalRows, row => row.id)
  return Buffer.byteLength(JSON.stringify([rows, signalRows]))
}

// Evaluate the exactly-one-release-tag guard against all persisted Citations,
// not a filtered subset. These are identity edges and have no age predicate.
const aliasClaims = sql`claims AS (
  SELECT own.id AS target_link_id, (array_agg(DISTINCT c.link_id))[1] AS alias_link_id
  FROM item i
  JOIN source source ON source.id = i.source_id AND source.transport IN ('rss', 'atom')
  JOIN link own ON own.url = i.url
  JOIN citation c ON c.item_id = i.id AND c.kind = 'outbound'
  JOIN link tag ON tag.id = c.link_id
  WHERE tag.url ~ '^https://github[.]com/[^/]+/[^/]+/releases/tag/.+$'
  GROUP BY i.id, own.id HAVING count(DISTINCT c.link_id) = 1
)`

/** A complete set of affected/eligible identity components, with scoped history. */
export async function loadReaderScope(database: Database, graph: PersistedGraph, since: Date, at: Date): Promise<number> {
  const recent = new Date(at.getTime() - MAX_SIGNAL_AGE_MS)
  const result = await database.execute<{ id: string }>(sql`WITH RECURSIVE
    ${aliasClaims},
    edges AS (
      SELECT id AS a, merged_into_id AS b FROM signal WHERE merged_into_id IS NOT NULL
      UNION SELECT a.id, t.id FROM claims
        JOIN signal a ON a.target_link_id = claims.alias_link_id
        JOIN signal t ON t.target_link_id = claims.target_link_id
    ),
    seeds AS (
      SELECT s.id FROM signal s WHERE
        (s.embedding IS NULL AND s.merged_into_id IS NULL)
        OR s.created_at >= ${since.toISOString()}::timestamptz
        OR EXISTS (SELECT 1 FROM citation c JOIN item i ON i.id = c.item_id
          WHERE c.link_id = s.target_link_id AND
            (i.updated_at >= ${since.toISOString()}::timestamptz
              OR least(c.first_seen_at, i.published_at) >= ${recent.toISOString()}::timestamptz))
        OR (s.merged_into_id IS NULL AND EXISTS (SELECT 1 FROM "user" u WHERE
          NOT EXISTS (SELECT 1 FROM reader_signal_match m WHERE m.user_id = u.id AND m.signal_id = s.id)
          OR NOT EXISTS (SELECT 1 FROM reader_match_profile p WHERE p.user_id = u.id)))
        OR EXISTS (SELECT 1 FROM reader_signal_match m WHERE m.signal_id = s.id AND
          (m.matched_at <= s.embedded_at OR EXISTS
            (SELECT 1 FROM interest i WHERE i.user_id = m.user_id AND i.embedded_at >= m.matched_at)))
    ),
    scope(id) AS (
      SELECT id FROM seeds
      UNION SELECT CASE WHEN e.a = scope.id THEN e.b ELSE e.a END
      FROM scope JOIN edges e ON e.a = scope.id OR e.b = scope.id
    ) SELECT id FROM scope ORDER BY id`)
  const ids = result.rows.map(row => row.id)
  graph.signals = await batches(ids, page => readSignalMetadata(database, inArray(signals.id, page)))
  const linkIds = graph.signals.map(row => row.targetLinkId)
  graph.links = await batches(linkIds, page => database.select().from(links).where(inArray(links.id, page)))
  graph.citations = await batches(linkIds, page => database.select().from(citations).where(inArray(citations.linkId, page)))
  graph.items = await batches([...new Set(graph.citations.map(row => row.itemId))], page => database.select({
    ...getTableColumns(items),
    hasOutboundCitation: sql<boolean>`EXISTS (SELECT 1 FROM citation c WHERE c.item_id = ${items.id} AND c.kind = 'outbound')`,
  }).from(items).where(inArray(items.id, page)))
  graph.readerSignalMatches = await batches(ids, page => database.select().from(readerSignalMatches).where(inArray(readerSignalMatches.signalId, page)))
  graph.briefEntries = await batches(ids, page => database.select().from(briefEntries).where(inArray(briefEntries.signalId, page)))
  graph.readStates = await batches(ids, page => database.select().from(readStates).where(inArray(readStates.signalId, page)))
  const claims = ids.length === 0
    ? []
    : (await database.execute<{ aliasLinkId: string, targetLinkIds: string[] }>(sql`WITH ${aliasClaims}
    SELECT alias_link_id AS "aliasLinkId", array_agg(DISTINCT target_link_id) AS "targetLinkIds"
    FROM claims WHERE alias_link_id = ANY(${sql.param(linkIds)}::uuid[]) GROUP BY alias_link_id`)).rows
  graph.releaseTagAliases = claims
  return Buffer.byteLength(JSON.stringify([ids, graph.signals, graph.links, graph.citations, graph.items, graph.readerSignalMatches, graph.briefEntries, graph.readStates, claims]))
}

export function recentBriefDate(at: Date): string {
  // Cover every reader's local date (UTC-12 through UTC+14), including DST.
  return new Date(at.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
