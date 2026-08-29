import type { IngestionSource, PersistedGraph, SourceFetchLog } from './pipeline'
import type { Database } from '@/lib/db'
import type { RobotsCacheRecord, RobotsDirectives, RobotsStore, RobotsVerdict } from '@/lib/robots'
import type { SafeFetch } from '@/lib/safe-fetch'
import { and, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db as defaultDatabase } from '@/lib/db'
import {
  citations as citationTable,
  httpCache,
  items,
  links as linkTable,
  publisherHosts,
  robotsCache,
  sourceFetchLogs,
  sources,
} from '@/lib/db/schema'
import { createRobotsGate, ROBOTS_TTL_MS } from '@/lib/robots'
import { safeFetch } from '@/lib/safe-fetch'
import { publisherHostKey } from './canonicalize'
import { ROBOTS_AUTO_DISABLED_REASON, runIngestion } from './pipeline'

interface CompiledQuery {
  toSQL: () => { sql: string, params: unknown[] }
}

function asIngestionSource(row: typeof sources.$inferSelect): IngestionSource {
  if (row.transport !== 'rss' && row.transport !== 'atom')
    throw new Error(`Source ${row.id} uses unsupported transport ${row.transport}`)
  return { ...row, transport: row.transport }
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

function canonicalRequestUrl(url: string): string {
  try {
    const canonical = new URL(url)
    canonical.hash = ''
    return canonical.href
  }
  catch {
    return url
  }
}

async function assertHostOwnership(database: Database): Promise<void> {
  const [publishedItems, registeredHosts] = await Promise.all([
    database.select({
      itemUrl: items.url,
      publisherId: sources.publisherId,
      sourceId: sources.id,
      transport: sources.transport,
    }).from(items).innerJoin(sources, eq(items.sourceId, sources.id)),
    database.select({
      host: publisherHosts.host,
      publisherId: publisherHosts.publisherId,
    }).from(publisherHosts),
  ])
  const ownerByHost = new Map(registeredHosts.map(row => [publisherHostKey(row.host), row.publisherId]))

  for (const row of publishedItems) {
    if (row.itemUrl === null)
      continue
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
    if (owner === row.publisherId)
      continue

    // RSS/Atom publish a Publisher's own Items. Other transports represent a
    // venue by construction; an unregistered venue is owned by nobody.
    const isUnownedTransportVenue = row.transport !== 'rss' && row.transport !== 'atom' && owner === undefined
    if (isUnownedTransportVenue)
      continue

    throw new Error(
      `host ownership assertion failed: Source ${row.sourceId} Publisher ${row.publisherId} published on ${host}, owned by ${owner ?? 'nobody'}`,
    )
  }
}

async function initialGraph(database: Database, dueSources: IngestionSource[]): Promise<PersistedGraph> {
  if (dueSources.length === 0) {
    return {
      sources: [],
      items: [],
      publisherHosts: [],
      links: [],
      citations: [],
      fetchLogs: [],
      httpCache: [],
      robotsCache: [],
      dormantSourceIds: [],
    }
  }

  const sourceIds = dueSources.map(source => source.id)
  const endpointUrls = dueSources.map(source => canonicalRequestUrl(source.endpointUrl))
  const [itemRows, cacheRows, robotsRows, hostRows, linkRows, citationRows] = await Promise.all([
    database.select().from(items).where(inArray(items.sourceId, sourceIds)),
    database.select().from(httpCache).where(inArray(httpCache.url, endpointUrls)),
    database.select().from(robotsCache),
    database.select().from(publisherHosts),
    database.select().from(linkTable),
    database.select().from(citationTable).where(inArray(citationTable.sourceId, sourceIds)),
  ])
  return {
    sources: dueSources,
    items: itemRows,
    publisherHosts: hostRows,
    links: linkRows,
    citations: citationRows,
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
  const compiled = statements.map(statement => statement.toSQL())
  const queries = compiled.map(query => database.$client.query(query.sql, query.params))
  await database.$client.transaction(queries)
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

function sourceStatements(database: Database, source: IngestionSource, graph: PersistedGraph): CompiledQuery[] {
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

  const cache = graph.httpCache.find(record => record.url === canonicalRequestUrl(source.endpointUrl))
  if (cache !== undefined) {
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

  if (latestLog.outcome === 'ok') {
    for (const item of graph.items.filter(candidate => candidate.sourceId === source.id)) {
      statements.push(database.insert(items).values(item).onConflictDoUpdate({
        target: [items.sourceId, items.externalId],
        set: {
          url: item.url,
          title: item.title,
          summary: item.summary,
          rawFeedDate: item.rawFeedDate,
          publishedAt: item.publishedAt,
          fetchedAt: item.fetchedAt,
          updatedAt: item.updatedAt,
        },
      }))
    }
  }

  if (latestLog.outcome === 'ok') {
    const sourceCitations = graph.citations.filter(candidate => candidate.sourceId === source.id)
    const citedLinkIds = new Set(sourceCitations.map(citation => citation.linkId))
    for (const link of graph.links.filter(candidate => citedLinkIds.has(candidate.id))) {
      statements.push(database.insert(linkTable).values(link).onConflictDoUpdate({
        target: linkTable.url,
        set: {
          firstSeenAt: sql`least(${linkTable.firstSeenAt}, excluded.first_seen_at)`,
        },
      }))
    }
    for (const citation of sourceCitations) {
      statements.push(database.insert(citationTable).values(citation).onConflictDoUpdate({
        target: [citationTable.itemId, citationTable.kind, citationTable.rawUrl],
        set: {
          linkId: citation.linkId,
          sourceId: citation.sourceId,
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

async function commitSource(database: Database, source: IngestionSource, graph: PersistedGraph): Promise<void> {
  await commitStatements(database, sourceStatements(database, source, graph))
}

/** Run every due RSS/Atom Source through the same seam against Neon directly. */
export async function runNeonIngestion(
  at: Date = new Date(),
  database: Database = defaultDatabase(),
  fetcher: SafeFetch = safeFetch,
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
  const graph = await initialGraph(database, dueSources)
  const persisted = await runIngestion({
    sources: dueSources,
    fetch: fetcher,
    now: () => new Date(),
    initialGraph: graph,
    onSourceCommitted: async (source, persisted) => commitSource(database, source, persisted),
  })
  const dormantSourceIds = new Set(dormantRows.map(source => source.id))
  for (const source of persisted.sources) {
    if (source.disabledAt === null && source.newestItemAt !== null && source.newestItemAt < dormantBefore)
      dormantSourceIds.add(source.id)
    else
      dormantSourceIds.delete(source.id)
  }
  persisted.dormantSourceIds = [...dormantSourceIds]
  return persisted
}
