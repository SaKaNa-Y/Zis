import type { IngestionSource, PersistedGraph, SourceFetchLog } from './pipeline'
import type { Database } from '@/lib/db'
import type { EmbeddingProvider } from '@/lib/embeddings/provider'
import type { RobotsCacheRecord, RobotsDirectives, RobotsStore, RobotsVerdict } from '@/lib/robots'
import type { SafeFetch } from '@/lib/safe-fetch'
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db as defaultDatabase } from '@/lib/db'
import {
  briefEntries as briefEntryTable,
  briefs as briefTable,
  citations as citationTable,
  httpCache,
  interests as interestTable,
  items,
  links as linkTable,
  publisherHosts,
  publishers as publisherTable,
  readerSignalMatches as readerSignalMatchTable,
  readStates as readStateTable,
  robotsCache,
  signals as signalTable,
  sourceFetchLogs,
  sources,
  users as userTable,
} from '@/lib/db/schema'
import { createRobotsGate, ROBOTS_TTL_MS } from '@/lib/robots'
import { safeFetch } from '@/lib/safe-fetch'
import { publisherHostKey } from './canonicalize'
import { RETENTION_WINDOW_MS, ROBOTS_AUTO_DISABLED_REASON, runIngestion } from './pipeline'
import { guestPublicationOwner, itemLinkIsOutbound } from './publication'

const SIGNAL_WRITE_BATCH_SIZE = 1000
const SIGNAL_READ_BATCH_SIZE = 1000

interface CompiledQuery {
  toSQL: () => { sql: string, params: unknown[] }
}

function asIngestionSource(row: typeof sources.$inferSelect): IngestionSource {
  return row
}

function asRobotsCache(row: typeof robotsCache.$inferSelect): RobotsCacheRecord {
  return {
    ...row,
    verdict: row.verdict as RobotsVerdict,
    directives: row.directives as RobotsDirectives,
    contentType: row.contentType ?? undefined,
    wafAction: row.wafAction ?? undefined,
  }
}

const itemVenueHostByTransport: Record<IngestionSource['transport'], string | null> = {
  rss: null,
  atom: null,
  hn_firebase: null,
  hn_algolia: null,
  github_graphql: 'github.com',
  bluesky_feed: 'bsky.app',
}

async function assertHostOwnership(database: Database): Promise<void> {
  const [publishedItems, registeredHosts] = await Promise.all([
    database.select({
      itemUrl: items.url,
      publisherId: sources.publisherId,
      sourceId: sources.id,
      transport: sources.transport,
      endpointUrl: sources.endpointUrl,
    }).from(items).innerJoin(sources, eq(items.sourceId, sources.id)),
    database.select({
      host: publisherHosts.host,
      publisherId: publisherHosts.publisherId,
    }).from(publisherHosts),
  ])
  const ownerByHost = new Map(registeredHosts.map(row => [publisherHostKey(row.host), row.publisherId]))

  for (const row of publishedItems) {
    if (row.itemUrl === null) {
      if (row.transport === 'rss' || row.transport === 'atom')
        itemLinkIsOutbound(row.endpointUrl, row.publisherId, registeredHosts)
      continue
    }
    let host: string
    try {
      host = publisherHostKey(new URL(row.itemUrl).hostname)
    }
    catch {
      throw new Error(
        `host ownership assertion failed: Source ${row.sourceId} has an invalid Item URL ${JSON.stringify(row.itemUrl)}`,
      )
    }
    const owner = ownerByHost.get(host)
    const venueHost = itemVenueHostByTransport[row.transport]
    if (venueHost !== null) {
      if (host !== venueHost) {
        throw new Error(
          `host ownership assertion failed: ${row.transport} Item host ${host} is not its Transport venue ${venueHost}`,
        )
      }
      if (owner === undefined)
        continue
      throw new Error(
        `host ownership assertion failed: Transport venue ${host} must be owned by nobody, registered to ${owner}`,
      )
    }
    if (owner === row.publisherId)
      continue
    if ((row.transport === 'rss' || row.transport === 'atom')
      && guestPublicationOwner(row.itemUrl, registeredHosts, row.endpointUrl) === row.publisherId) {
      continue
    }

    throw new Error(
      `host ownership assertion failed: Source ${row.sourceId} Publisher ${row.publisherId} published on ${host}, owned by ${owner ?? 'nobody'}`,
    )
  }
}

async function readSignals(database: Database): Promise<Array<typeof signalTable.$inferSelect>> {
  // Stored vectors exceeded Neon's 64 MiB HTTP response limit in production.
  // Bound each response, retaining every row through stable primary-key cursors.
  const rows: Array<typeof signalTable.$inferSelect> = []
  let afterId: string | undefined
  while (true) {
    const page = await database.select().from(signalTable).where(afterId === undefined ? undefined : gt(signalTable.id, afterId)).orderBy(signalTable.id).limit(SIGNAL_READ_BATCH_SIZE)
    rows.push(...page)
    if (page.length < SIGNAL_READ_BATCH_SIZE)
      return rows
    afterId = page.at(-1)!.id
  }
}

async function initialGraph(
  database: Database,
  dueSources: IngestionSource[],
  includeReaderStages: boolean,
): Promise<PersistedGraph> {
  if (dueSources.length === 0 && !includeReaderStages) {
    return {
      sources: [],
      items: [],
      publishers: [],
      publisherHosts: [],
      links: [],
      signals: [],
      citations: [],
      users: [],
      interests: [],
      readerSignalMatches: [],
      briefs: [],
      briefEntries: [],
      readStates: [],
      fetchLogs: [],
      httpCache: [],
      robotsCache: [],
      dormantSourceIds: [],
    }
  }

  const [sourceRows, itemRows, cacheRows, robotsRows, hostRows, linkRows, signalRows, citationRows] = await Promise.all([
    database.select().from(sources),
    database.select().from(items),
    database.select().from(httpCache),
    database.select().from(robotsCache),
    database.select().from(publisherHosts),
    database.select().from(linkTable),
    readSignals(database),
    database.select().from(citationTable),
  ])
  const [userRows, interestRows, matchRows, publisherRows, briefRows, briefEntryRows, readStateRows] = includeReaderStages
    ? await Promise.all([
        database.select({
          id: userTable.id,
          timezone: userTable.timezone,
          cutHour: userTable.cutHour,
          createdAt: userTable.createdAt,
        }).from(userTable),
        database.select().from(interestTable),
        database.select().from(readerSignalMatchTable),
        database.select().from(publisherTable),
        database.select().from(briefTable),
        database.select().from(briefEntryTable),
        database.select().from(readStateTable),
      ])
    : [[], [], [], [], [], [], []]
  return {
    sources: sourceRows.map(asIngestionSource),
    items: itemRows.map(item => ({
      ...item,
      issueHydratedAt: item.issueHydratedAt ?? null,
    })),
    publishers: publisherRows,
    publisherHosts: hostRows,
    links: linkRows,
    signals: signalRows,
    citations: citationRows,
    users: userRows,
    interests: interestRows,
    readerSignalMatches: matchRows,
    briefs: briefRows,
    briefEntries: briefEntryRows,
    readStates: readStateRows,
    fetchLogs: [],
    httpCache: cacheRows,
    robotsCache: robotsRows.map(asRobotsCache),
    dormantSourceIds: [],
  }
}

function robotsStatement(database: Database, record: RobotsCacheRecord): CompiledQuery {
  return database.insert(robotsCache).values({
    ...record,
    contentType: record.contentType ?? null,
    wafAction: record.wafAction ?? null,
  }).onConflictDoUpdate({
    target: robotsCache.host,
    set: {
      verdict: record.verdict,
      directives: record.directives,
      status: record.status,
      contentType: record.contentType ?? null,
      wafAction: record.wafAction ?? null,
      authoritative: record.authoritative,
      fetchedAt: record.fetchedAt,
      expiresAt: record.expiresAt,
    },
  })
}

async function commitStatements(database: Database, statements: CompiledQuery[]): Promise<void> {
  await database.commit(statements.map(statement => statement.toSQL()))
}

async function refreshRobotDisabledSources(database: Database, at: Date, fetcher: SafeFetch): Promise<void> {
  const rows = await database.select().from(sources).where(and(
    isNotNull(sources.disabledAt),
    eq(sources.disabledReason, ROBOTS_AUTO_DISABLED_REASON),
    or(isNull(sources.retryAfterAt), lte(sources.retryAfterAt, at)),
    inArray(sources.transport, ['rss', 'atom']),
  ))
  const candidates = rows.map(asIngestionSource)
  if (candidates.length === 0)
    return

  const cachedRows = await database.select().from(robotsCache)
  const records = new Map(cachedRows.map(row => [row.host, asRobotsCache(row)]))
  const store: RobotsStore = {
    get: async host => records.get(host),
    put: async (record) => {
      records.set(record.host, record)
    },
  }
  const gate = createRobotsGate({
    fetchRobots: async (url) => {
      const requestedHost = new URL(url).host
      return fetcher(url, {
        beforeRequest: async (hopUrl) => {
          const hopHost = new URL(hopUrl).host
          if (hopHost !== requestedHost)
            throw new Error(`robots redirect left ${requestedHost} for ${hopHost}`)
        },
      })
    },
    store,
    now: () => at,
  })

  const byHost = new Map<string, IngestionSource[]>()
  for (const source of candidates) {
    let host: string
    try {
      host = new URL(source.endpointUrl).host
    }
    catch {
      host = `invalid:${source.id}`
    }
    const queue = byHost.get(host) ?? []
    queue.push(source)
    byHost.set(host, queue)
  }

  const queues = [...byHost.values()]
  let nextQueue = 0
  async function worker(): Promise<void> {
    while (true) {
      const queue = queues[nextQueue++]
      if (queue === undefined)
        return
      for (const source of queue) {
        const decision = await gate.decide(source.endpointUrl)
        const statements: CompiledQuery[] = []
        if (decision.record !== undefined)
          statements.push(robotsStatement(database, decision.record))
        statements.push(database.update(sources).set(decision.allowed
          ? {
              disabledAt: null,
              disabledReason: null,
              consecutiveFailures: 0,
              retryAfterAt: null,
            }
          : {
              retryAfterAt: decision.record?.expiresAt ?? new Date(at.getTime() + ROBOTS_TTL_MS),
            }).where(eq(sources.id, source.id)))
        await commitStatements(database, statements)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queues.length) }, () => worker()))
}

function sourceStatements(
  database: Database,
  source: IngestionSource,
  graph: PersistedGraph,
  touchedHttpCacheKeys: ReadonlySet<string>,
  touchedItemIds: ReadonlySet<string>,
): CompiledQuery[] {
  const latestLog = [...graph.fetchLogs].reverse().find(log => log.sourceId === source.id)
  if (latestLog === undefined)
    throw new Error(`Source ${source.id} completed without a source_fetch_log row`)

  const statements: CompiledQuery[] = [
    database.update(sources).set({
      disabledAt: source.disabledAt,
      disabledReason: source.disabledReason,
      consecutiveFailures: source.consecutiveFailures,
      retryAfterAt: source.retryAfterAt,
      lastPolledAt: source.lastPolledAt,
      newestItemAt: source.newestItemAt,
    }).where(eq(sources.id, source.id)),
  ]

  const touchedCacheRows = graph.httpCache.filter(record => touchedHttpCacheKeys.has(record.url))
  for (const cache of touchedCacheRows) {
    statements.push(database.insert(httpCache).values(cache).onConflictDoUpdate({
      target: httpCache.url,
      set: {
        etag: cache.etag,
        lastModified: cache.lastModified,
        lastStatus: cache.lastStatus,
        fetchedAt: cache.fetchedAt,
      },
    }))
  }

  const updatedRobots = graph.robotsCache.filter(record => record.fetchedAt >= latestLog.startedAt)
  for (const robots of updatedRobots)
    statements.push(robotsStatement(database, robots))

  const contentItems = graph.items.filter(candidate =>
    candidate.sourceId === source.id
    && (latestLog.outcome === 'ok' || touchedItemIds.has(candidate.id)),
  )
  if (latestLog.outcome === 'ok' || touchedItemIds.size > 0) {
    for (const item of contentItems) {
      statements.push(database.insert(items).values(item).onConflictDoUpdate({
        target: [items.sourceId, items.externalId],
        set: {
          url: item.url,
          title: item.title,
          summary: item.summary,
          text: item.text,
          rawFeedDate: item.rawFeedDate,
          publishedAt: item.publishedAt,
          fetchedAt: item.fetchedAt,
          issueHydratedAt: item.issueHydratedAt,
          updatedAt: item.updatedAt,
        },
      }))
    }
  }

  if (latestLog.outcome === 'ok' || touchedItemIds.size > 0) {
    const sourceCitations = graph.citations.filter(candidate =>
      candidate.sourceId === source.id
      && (latestLog.outcome === 'ok' || touchedItemIds.has(candidate.itemId)),
    )
    const citedLinkIds = new Set(sourceCitations.map(citation => citation.linkId))
    for (const link of graph.links.filter(candidate => citedLinkIds.has(candidate.id))) {
      statements.push(database.insert(linkTable).values(link).onConflictDoUpdate({
        target: linkTable.url,
        set: {
          firstSeenAt: sql`least(${linkTable.firstSeenAt}, excluded.first_seen_at)`,
        },
      }))
      const signal = graph.signals.find(candidate => candidate.targetLinkId === link.id)
      if (signal === undefined)
        throw new Error(`Link ${link.id} completed without an eager Signal`)
      statements.push(database.insert(signalTable).values({
        ...signal,
        textBasis: null,
        embeddingText: null,
        embeddingTextExpiresAt: null,
        embedding: null,
        embeddingModel: null,
        embeddingDimensions: null,
        embeddingVersion: null,
        embeddedAt: null,
      }).onConflictDoNothing({
        target: signalTable.targetLinkId,
      }))
    }
    for (const citation of sourceCitations) {
      statements.push(database.insert(citationTable).values(citation).onConflictDoUpdate({
        target: [citationTable.itemId, citationTable.kind, citationTable.rawUrl],
        set: {
          linkId: citation.linkId,
          sourceId: citation.sourceId,
          anchorText: citation.anchorText,
          firstSeenAt: sql`least(${citationTable.firstSeenAt}, excluded.first_seen_at)`,
        },
      }))
    }
  }

  const log: Omit<SourceFetchLog, 'id'> = latestLog
  statements.push(database.insert(sourceFetchLogs).values({
    sourceId: log.sourceId,
    startedAt: log.startedAt,
    durationMs: log.durationMs,
    outcome: log.outcome,
    httpStatus: log.httpStatus,
    itemsSeen: log.itemsSeen,
    itemsNew: log.itemsNew,
    bytes: log.bytes,
    errorMessage: log.errorMessage,
  }))
  return statements
}

async function commitSource(
  database: Database,
  source: IngestionSource,
  graph: PersistedGraph,
  touchedHttpCacheKeys: ReadonlySet<string>,
  touchedItemIds: ReadonlySet<string>,
): Promise<void> {
  await commitStatements(database, sourceStatements(
    database,
    source,
    graph,
    touchedHttpCacheKeys,
    touchedItemIds,
  ))
}

async function commitFinalGraph(database: Database, graph: PersistedGraph): Promise<void> {
  if (graph.signals.length === 0
    && graph.interests.length === 0
    && graph.readerSignalMatches.length === 0
    && graph.briefs.length === 0
    && graph.briefEntries.length === 0) {
    return
  }
  const ordered = [...graph.signals].sort((left, right) => left.id.localeCompare(right.id))
  const statements: CompiledQuery[] = []
  const batches = Array.from(
    { length: Math.ceil(ordered.length / SIGNAL_WRITE_BATCH_SIZE) },
    (_, index) => ordered.slice(index * SIGNAL_WRITE_BATCH_SIZE, (index + 1) * SIGNAL_WRITE_BATCH_SIZE),
  )
  for (const batch of batches) {
    statements.push(database.insert(signalTable).values(batch.map(signal => ({
      ...signal,
      mergedIntoId: null,
      strength: 0,
      originPublisherId: null,
    }))).onConflictDoNothing({ target: signalTable.id }))
  }
  for (const batch of batches) {
    statements.push(database.insert(signalTable).values(batch).onConflictDoUpdate({
      target: signalTable.id,
      set: {
        mergedIntoId: sql`excluded.merged_into_id`,
        strength: sql`excluded.strength`,
        originPublisherId: sql`excluded.origin_publisher_id`,
        textBasis: sql`excluded.text_basis`,
        embeddingText: sql`excluded.embedding_text`,
        embeddingTextExpiresAt: sql`excluded.embedding_text_expires_at`,
        embedding: sql`excluded.embedding`,
        embeddingModel: sql`excluded.embedding_model`,
        embeddingDimensions: sql`excluded.embedding_dimensions`,
        embeddingVersion: sql`excluded.embedding_version`,
        embeddedAt: sql`excluded.embedded_at`,
      },
    }))
  }
  if (graph.interests.length > 0) {
    const orderedInterests = [...graph.interests].sort((left, right) => left.id.localeCompare(right.id))
    statements.push(database.insert(interestTable).values(orderedInterests).onConflictDoUpdate({
      target: interestTable.id,
      set: {
        embedding: sql`excluded.embedding`,
        embeddingInputHash: sql`excluded.embedding_input_hash`,
        embeddingModel: sql`excluded.embedding_model`,
        embeddingDimensions: sql`excluded.embedding_dimensions`,
        embeddingVersion: sql`excluded.embedding_version`,
        embeddedAt: sql`excluded.embedded_at`,
      },
    }))
  }
  if (graph.readerSignalMatches.length > 0) {
    const orderedMatches = [...graph.readerSignalMatches].sort((left, right) =>
      left.userId.localeCompare(right.userId) || left.signalId.localeCompare(right.signalId),
    )
    // A large corpus also exceeds Postgres's per-statement bind-parameter cap.
    for (let offset = 0; offset < orderedMatches.length; offset += SIGNAL_WRITE_BATCH_SIZE) {
      statements.push(database.insert(readerSignalMatchTable).values(orderedMatches.slice(offset, offset + SIGNAL_WRITE_BATCH_SIZE)).onConflictDoUpdate({
        target: [readerSignalMatchTable.userId, readerSignalMatchTable.signalId],
        set: {
          matchedInterestId: sql`excluded.matched_interest_id`,
          relevance: sql`excluded.relevance`,
          gap: sql`excluded.gap`,
          matchedAt: sql`excluded.matched_at`,
        },
      }))
    }
  }
  if (graph.briefs.length > 0) {
    const orderedBriefs = [...graph.briefs].sort((left, right) =>
      left.userId.localeCompare(right.userId) || left.localDate.localeCompare(right.localDate),
    )
    statements.push(database.insert(briefTable).values(orderedBriefs).onConflictDoNothing({
      target: [briefTable.userId, briefTable.localDate],
    }))
  }
  if (graph.briefEntries.length > 0) {
    const orderedEntries = [...graph.briefEntries].sort((left, right) =>
      left.briefId.localeCompare(right.briefId) || left.position - right.position,
    )
    for (let offset = 0; offset < orderedEntries.length; offset += SIGNAL_WRITE_BATCH_SIZE) {
      statements.push(database.insert(briefEntryTable).values(orderedEntries.slice(offset, offset + SIGNAL_WRITE_BATCH_SIZE)).onConflictDoNothing({
        target: [briefEntryTable.userId, briefEntryTable.signalId],
      }))
    }
  }
  await commitStatements(database, statements)
}

async function commitRetention(database: Database, at: Date): Promise<void> {
  const retainedSince = new Date(at.getTime() - RETENTION_WINDOW_MS)
  await commitStatements(database, [
    database.update(items).set({ text: null }).where(lt(items.createdAt, retainedSince)),
    database.update(signalTable).set({ embeddingText: null }).where(and(
      eq(signalTable.textBasis, 'own'),
      isNotNull(signalTable.embeddingTextExpiresAt),
      lt(signalTable.embeddingTextExpiresAt, at),
    )),
    database.delete(sourceFetchLogs).where(lt(sourceFetchLogs.startedAt, retainedSince)),
    database.delete(robotsCache).where(lte(robotsCache.expiresAt, at)),
  ])
}

/** Run due RSS/Atom Sources and the reader stages through the same Neon-backed seam. */
export async function runNeonIngestion(
  at: Date = new Date(),
  database: Database = defaultDatabase(),
  fetcher: SafeFetch = safeFetch,
  embeddingProvider?: EmbeddingProvider,
): Promise<PersistedGraph> {
  await assertHostOwnership(database)
  await refreshRobotDisabledSources(database, at, fetcher)
  const dormantBefore = new Date(at)
  dormantBefore.setUTCMonth(dormantBefore.getUTCMonth() - 6)
  const [rows, dormantRows] = await Promise.all([
    database.select().from(sources).where(and(
      isNull(sources.disabledAt),
      or(isNull(sources.retryAfterAt), lte(sources.retryAfterAt, at)),
      inArray(sources.transport, ['rss', 'atom']),
    )),
    database.select({ id: sources.id }).from(sources).where(and(
      isNull(sources.disabledAt),
      lt(sources.newestItemAt, dormantBefore),
      inArray(sources.transport, ['rss', 'atom']),
    )),
  ])
  const dueSources = rows.map(asIngestionSource)
  const graph = await initialGraph(database, dueSources, embeddingProvider !== undefined)
  const persisted = await runIngestion({
    sources: dueSources,
    fetch: fetcher,
    now: () => new Date(),
    wakeAt: at,
    initialGraph: graph,
    embeddingProvider,
    onSourceCommitted: async (source, persisted, touchedHttpCacheKeys, touchedItemIds) =>
      commitSource(database, source, persisted, touchedHttpCacheKeys, touchedItemIds),
  })
  await commitFinalGraph(database, persisted)
  const dormantSourceIds = new Set(dormantRows.map(source => source.id))
  for (const source of persisted.sources) {
    if (source.disabledAt === null && source.newestItemAt !== null && source.newestItemAt < dormantBefore)
      dormantSourceIds.add(source.id)
    else
      dormantSourceIds.delete(source.id)
  }
  persisted.dormantSourceIds = [...dormantSourceIds]
  await commitRetention(database, at)
  return persisted
}
