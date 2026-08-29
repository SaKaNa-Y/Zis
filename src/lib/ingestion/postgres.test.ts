import type { Database } from '@/lib/db'
import type { EmbeddingProvider } from '@/lib/embeddings/provider'
import type { SafeFetch } from '@/lib/safe-fetch'
import { describe, expect, it } from 'vitest'
import {
  briefEntries,
  briefs,
  citations,
  httpCache,
  interests,
  items,
  links,
  readerSignalMatches,
  signals,
  sources,
} from '@/lib/db/schema'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runNeonIngestion } from './postgres'

function databaseReturning(...results: unknown[][]): Database {
  const queued = [...results]
  return {
    select: () => {
      const result = Promise.resolve(queued.shift() ?? [])
      return Object.assign(result, {
        from: () => Object.assign(result, {
          innerJoin: () => result,
          where: () => result,
        }),
      })
    },
  } as unknown as Database
}

interface CapturedStatement {
  kind: 'insert' | 'update'
  table: object
  values: unknown
  conflict?: unknown
}

function capturingDatabase(...results: unknown[][]): {
  database: Database
  selections: Array<string[] | null>
  statements: CapturedStatement[]
  transactions: unknown[][]
} {
  const queued = [...results]
  const selections: Array<string[] | null> = []
  const statements: CapturedStatement[] = []
  const transactions: unknown[][] = []

  function capture(kind: CapturedStatement['kind'], table: object, values: unknown) {
    const statementNumber = statements.push({ kind, table, values })
    const query = {
      onConflictDoUpdate: (conflict: unknown) => {
        statements[statementNumber - 1]!.conflict = conflict
        return query
      },
      onConflictDoNothing: (conflict: unknown) => {
        statements[statementNumber - 1]!.conflict = conflict
        return query
      },
      toSQL: () => ({ sql: `statement-${statementNumber}`, params: [] }),
    }
    return query
  }

  const database = {
    select: (fields?: Record<string, unknown>) => {
      selections.push(fields === undefined ? null : Object.keys(fields))
      return {
        from: () => {
          const result = Promise.resolve(queued.shift() ?? [])
          return Object.assign(result, {
            innerJoin: () => result,
            where: () => result,
          })
        },
      }
    },
    insert: (table: object) => ({
      values: (values: unknown) => capture('insert', table, values),
    }),
    update: (table: object) => ({
      set: (values: unknown) => ({
        where: () => capture('update', table, values),
      }),
    }),
    $client: {
      query: (sql: string, params: unknown[]) => ({ params, sql }),
      transaction: async (queries: unknown[]) => {
        transactions.push(queries)
      },
    },
  } as unknown as Database

  return { database, selections, statements, transactions }
}

interface FetchFixture {
  status: number
  body?: string
  contentType?: string
  headers?: Record<string, string>
}

function fixtureFetcher(resolve: (url: string) => FetchFixture): SafeFetch {
  return async (url, options) => {
    const signal = options?.signal ?? new AbortController().signal
    const release = await options?.beforeRequest?.(url, signal)
    try {
      const fixture = resolve(url)
      const body = fixture.body ?? ''
      const bytes = new TextEncoder().encode(body)
      const headers: Record<string, string> = {
        ...fixture.headers,
        ...(fixture.contentType === undefined ? {} : { 'content-type': fixture.contentType }),
      }
      return {
        url,
        status: fixture.status,
        headers,
        contentType: fixture.contentType,
        bytes,
        byteLength: bytes.byteLength,
        text: () => body,
      }
    }
    finally {
      if (typeof release === 'function')
        release()
    }
  }
}

function unitVector(axis: number): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS)
  vector[axis] = 1
  return vector
}

describe('the production ingestion startup assertion', () => {
  it('matches a loaded graph with no due Sources and persists all embedding outputs idempotently', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const link = {
      id: '00000000-0000-8000-8000-000000000301',
      url: 'https://example.com/releases/stable',
      firstSeenAt: new Date('2026-08-28T08:00:00.000Z'),
      createdAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const signal = {
      id: link.id,
      targetLinkId: link.id,
      mergedIntoId: null,
      strength: 0,
      originPublisherId: null,
      textBasis: null,
      embeddingText: null,
      embedding: null,
      embeddingModel: null,
      embeddingDimensions: null,
      embeddingVersion: null,
      embeddedAt: null,
      createdAt: link.createdAt,
    }
    const originPublisherId = '00000000-0000-4000-8000-000000000701'
    const alphaPublisherId = '00000000-0000-4000-8000-000000000702'
    const betaPublisherId = '00000000-0000-4000-8000-000000000703'
    const sourceRows = [originPublisherId, alphaPublisherId, betaPublisherId].map((publisherId, index) => ({
      id: `00000000-0000-4000-8000-${String(801 + index).padStart(12, '0')}`,
      publisherId,
      transport: 'rss' as const,
      endpointUrl: `https://publisher-${index}.example/feed.xml`,
      isAggregator: false,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: link.firstSeenAt,
      newestItemAt: link.firstSeenAt,
      createdAt: link.createdAt,
    }))
    const itemRows = sourceRows.map((source, index) => ({
      id: `00000000-0000-4000-8000-${String(901 + index).padStart(12, '0')}`,
      sourceId: source.id,
      externalId: `item-${index}`,
      url: index === 0 ? link.url : `https://publisher-${index}.example/items/1`,
      title: index === 0 ? 'Stable release' : `Citation ${index}`,
      summary: null,
      rawFeedDate: null,
      publishedAt: link.firstSeenAt,
      fetchedAt: link.firstSeenAt,
      issueHydratedAt: null,
      createdAt: link.createdAt,
      updatedAt: link.createdAt,
    }))
    const citationRows = sourceRows.map((source, index) => ({
      id: `00000000-0000-4000-8000-${String(1001 + index).padStart(12, '0')}`,
      itemId: itemRows[index]!.id,
      sourceId: source.id,
      linkId: link.id,
      kind: index === 0 ? 'self' as const : 'outbound' as const,
      rawUrl: link.url,
      anchorText: null,
      firstSeenAt: new Date(link.firstSeenAt.getTime() + index * 60_000),
      createdAt: link.createdAt,
    }))
    const publisherRows = [
      { id: originPublisherId, slug: 'origin', name: 'Origin', createdAt: link.createdAt },
      { id: alphaPublisherId, slug: 'alpha', name: 'Alpha', createdAt: link.createdAt },
      { id: betaPublisherId, slug: 'beta', name: 'Beta', createdAt: link.createdAt },
    ]
    const user = {
      id: '00000000-0000-4000-8000-000000000501',
      timezone: 'UTC',
      cutHour: 8,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const interest = {
      id: '00000000-0000-4000-8000-000000000601',
      userId: user.id,
      statement: 'Stable software releases',
      embedding: null,
      embeddingInputHash: null,
      embeddingModel: null,
      embeddingDimensions: null,
      embeddingVersion: null,
      embeddedAt: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    }
    const { database, selections, statements, transactions } = capturingDatabase(
      [],
      [],
      [],
      [],
      [],
      sourceRows,
      itemRows,
      [],
      [],
      [{ host: 'example.com', publisherId: originPublisherId }],
      [link],
      [signal],
      citationRows,
      [user],
      [interest],
      [],
      publisherRows,
      [],
      [],
      [],
    )
    const embeddedTexts: string[][] = []
    const provider: EmbeddingProvider = {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      version: EMBEDDING_VERSION,
      embed: async (texts) => {
        embeddedTexts.push([...texts])
        return texts.map(() => unitVector(0))
      },
    }

    const graph = await runNeonIngestion(
      at,
      database,
      fixtureFetcher(() => {
        throw new Error('no origin fetch expected')
      }),
      provider,
    )

    expect(selections).toContainEqual(['id', 'timezone', 'cutHour', 'createdAt'])

    expect(embeddedTexts).toEqual([
      ['Stable release.'],
      [interest.statement],
    ])
    expect(graph.signals[0]).toMatchObject({
      textBasis: 'own',
      embeddingText: 'Stable release.',
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embeddingVersion: EMBEDDING_VERSION,
      embeddedAt: expect.any(Date),
    })
    expect(graph.interests[0]).toMatchObject({
      embeddingInputHash: expect.stringMatching(/^[a-f\d]{64}$/),
      embeddingModel: EMBEDDING_MODEL,
      embeddedAt: expect.any(Date),
    })
    expect(graph.readerSignalMatches).toEqual([
      expect.objectContaining({
        userId: user.id,
        signalId: signal.id,
        matchedInterestId: interest.id,
        relevance: 1,
        gap: null,
      }),
    ])
    expect(graph.briefs).toEqual([
      expect.objectContaining({
        userId: user.id,
        localDate: '2026-08-29',
        cutAt: at,
      }),
    ])
    expect(graph.briefEntries).toEqual([
      expect.objectContaining({
        briefId: graph.briefs[0]!.id,
        userId: user.id,
        signalId: signal.id,
        position: 1,
        admittedBy: 'interest',
        whyText: '2 Publishers converged · Alpha, Beta · origin: example.com · matched: "Stable software releases"',
      }),
    ])

    const signalWrites = statements.filter(statement => statement.table === signals)
    expect(signalWrites).toHaveLength(2)
    expect(signalWrites[1]?.values).toEqual([
      expect.objectContaining({
        id: signal.id,
        embedding: expect.any(Array),
        embeddingModel: EMBEDDING_MODEL,
      }),
    ])
    expect(signalWrites[1]?.conflict).toMatchObject({
      target: signals.id,
      set: {
        embedding: expect.anything(),
        embeddingModel: expect.anything(),
        embeddedAt: expect.anything(),
      },
    })

    const interestWrite = statements.find(statement => statement.table === interests)
    expect(interestWrite?.values).toEqual([
      expect.objectContaining({
        id: interest.id,
        embedding: expect.any(Array),
        embeddingInputHash: expect.stringMatching(/^[a-f\d]{64}$/),
      }),
    ])
    expect(interestWrite?.conflict).toMatchObject({
      target: interests.id,
      set: {
        embedding: expect.anything(),
        embeddingInputHash: expect.anything(),
        embeddedAt: expect.anything(),
      },
    })

    const matchWrite = statements.find(statement => statement.table === readerSignalMatches)
    expect(matchWrite?.values).toEqual(graph.readerSignalMatches)
    expect(matchWrite?.conflict).toMatchObject({
      target: [readerSignalMatches.userId, readerSignalMatches.signalId],
      set: {
        matchedInterestId: expect.anything(),
        relevance: expect.anything(),
        gap: expect.anything(),
        matchedAt: expect.anything(),
      },
    })
    const briefWrite = statements.find(statement => statement.table === briefs)
    expect(briefWrite?.values).toEqual(graph.briefs)
    const briefEntryWrite = statements.find(statement => statement.table === briefEntries)
    expect(briefEntryWrite?.values).toEqual(graph.briefEntries)
    expect(transactions).toHaveLength(1)
  })

  it('fails the run before selecting due Sources when an RSS Item host has no owner', async () => {
    const database = databaseReturning(
      [{
        itemUrl: 'https://unregistered.example/post',
        publisherId: 'publisher-1',
        sourceId: 'source-1',
        transport: 'rss',
      }],
      [],
    )

    await expect(
      runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database),
    )
      .rejects
      .toThrow('host ownership assertion failed')
  })

  it('fails when a Transport venue host is registered to a Publisher', async () => {
    const database = databaseReturning(
      [{
        itemUrl: 'https://bsky.app/profile/example.com/post/3example',
        publisherId: 'publisher-1',
        sourceId: 'source-1',
        transport: 'bluesky_feed',
      }],
      [{ host: 'bsky.app', publisherId: 'publisher-1' }],
    )

    await expect(
      runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database),
    )
      .rejects
      .toThrow('Transport venue bsky.app must be owned by nobody')
  })

  it.each([
    ['bluesky_feed', 'https://bsky.app/profile/example.com/post/3example'],
    ['github_graphql', 'https://github.com/example/project/releases/tag/v1.0.0'],
  ] as const)('derives the unowned venue from the %s Transport', async (transport, itemUrl) => {
    const database = databaseReturning(
      [{ itemUrl, publisherId: 'publisher-1', sourceId: 'source-1', transport }],
      [],
      [],
      [],
      [],
    )

    await expect(runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database))
      .resolves
      .toMatchObject({ sources: [] })
  })

  it.each([
    ['bluesky_feed', 'https://unregistered.example/profile/example.com/post/3example'],
    ['github_graphql', 'https://unregistered.example/example/project/releases/tag/v1.0.0'],
  ] as const)('rejects an unowned non-venue host for the %s Transport', async (transport, itemUrl) => {
    const database = databaseReturning(
      [{ itemUrl, publisherId: 'publisher-1', sourceId: 'source-1', transport }],
      [],
    )

    await expect(runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database))
      .rejects
      .toThrow(`host ownership assertion failed: ${transport} Item host unregistered.example is not its Transport venue`)
  })

  it('requires Hacker News Items to resolve to the voting Hacker News Publisher', async () => {
    const database = databaseReturning(
      [{
        itemUrl: 'https://news.ycombinator.com/item?id=123',
        publisherId: 'hacker-news',
        sourceId: 'hn-top',
        transport: 'hn_firebase',
      }],
      [{ host: 'news.ycombinator.com', publisherId: 'hacker-news' }],
      [],
      [],
      [],
    )

    await expect(runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database))
      .resolves
      .toMatchObject({ sources: [] })
  })

  it('reports an enabled dormant Source even when origin backoff makes it not due', async () => {
    const database = databaseReturning(
      [],
      [{ host: 'publisher.example', publisherId: 'publisher-1' }],
      [],
      [],
      [{ id: 'source-dormant' }],
    )

    const graph = await runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database)

    expect(graph.sources).toEqual([])
    expect(graph.dormantSourceIds).toEqual(['source-dormant'])
  })

  it('uses the same exact hostname key for the ownership assertion and Citation filter', async () => {
    const publisherId = '00000000-0000-4000-8000-000000000001'
    const database = databaseReturning(
      [{
        itemUrl: 'https://Publisher.Example.:8443/post',
        publisherId,
        sourceId: 'source-1',
        transport: 'rss',
      }],
      [{ host: 'publisher.example.', publisherId }],
      [],
      [],
      [],
    )

    await expect(runNeonIngestion(new Date('2026-08-29T08:00:00.000Z'), database))
      .resolves
      .toMatchObject({ sources: [] })
  })

  it('does not invent legacy self provenance from a not-modified response', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const source = {
      id: '00000000-0000-4000-8000-000000000101',
      publisherId: '00000000-0000-4000-8000-000000000001',
      transport: 'rss' as const,
      endpointUrl: 'https://publisher.example/feed.xml',
      isAggregator: false,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: null,
      newestItemAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const item = {
      id: '00000000-0000-8000-8000-000000000201',
      sourceId: source.id,
      externalId: 'legacy-item',
      url: 'https://publisher.example/archive/item',
      title: 'Legacy Item',
      summary: null,
      rawFeedDate: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      fetchedAt: new Date('2026-08-28T08:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const host = { host: 'publisher.example', publisherId: source.publisherId }
    const cache = {
      url: source.endpointUrl,
      etag: '"feed-v1"',
      lastModified: null,
      lastStatus: 200,
      fetchedAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const robots = {
      host: 'publisher.example',
      verdict: 'allow',
      directives: { matchedUserAgent: null, rules: [] },
      status: 404,
      contentType: null,
      wafAction: null,
      authoritative: true,
      fetchedAt: new Date('2026-08-28T08:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    }
    const { database, statements, transactions } = capturingDatabase(
      [{ itemUrl: item.url, publisherId: source.publisherId, sourceId: source.id, transport: source.transport }],
      [host],
      [],
      [source],
      [],
      [source],
      [item],
      [cache],
      [robots],
      [host],
      [],
      [],
      [],
    )

    const graph = await runNeonIngestion(at, database, fixtureFetcher(() => ({ status: 304 })))

    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'not_modified' })
    expect(graph.citations).toEqual([])
    expect(statements.some(statement => statement.table === items)).toBe(false)
    expect(statements.some(statement => statement.table === links)).toBe(false)
    expect(statements.some(statement => statement.table === citations)).toBe(false)
    expect(transactions).toHaveLength(1)
  })

  it('commits pending Aggregator hydration even when the feed is not modified', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const aggregator = {
      id: '00000000-0000-4000-8000-000000000111',
      publisherId: '00000000-0000-4000-8000-000000000011',
      transport: 'rss' as const,
      endpointUrl: 'https://newsletter.example/feed.xml',
      isAggregator: true,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: null,
      newestItemAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const issueUrl = 'https://newsletter.example/issues/pending'
    const targetUrl = 'https://target.example/releases/pending'
    const item = {
      id: '00000000-0000-8000-8000-000000000211',
      sourceId: aggregator.id,
      externalId: 'pending-issue',
      url: issueUrl,
      title: 'Pending issue',
      summary: null,
      rawFeedDate: null,
      publishedAt: new Date('2026-08-28T08:00:00.000Z'),
      fetchedAt: new Date('2026-08-28T08:00:00.000Z'),
      issueHydratedAt: null,
      createdAt: new Date('2026-08-28T08:00:00.000Z'),
      updatedAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const selfLink = {
      id: '00000000-0000-8000-8000-000000000311',
      url: issueUrl,
      firstSeenAt: item.createdAt,
      createdAt: item.createdAt,
    }
    const selfSignal = {
      id: selfLink.id,
      targetLinkId: selfLink.id,
      mergedIntoId: null,
      strength: 0,
      originPublisherId: aggregator.publisherId,
      createdAt: item.createdAt,
    }
    const selfCitation = {
      id: '00000000-0000-8000-8000-000000000411',
      itemId: item.id,
      sourceId: aggregator.id,
      linkId: selfLink.id,
      kind: 'self' as const,
      rawUrl: issueUrl,
      firstSeenAt: item.createdAt,
      createdAt: item.createdAt,
    }
    const feedCache = {
      url: aggregator.endpointUrl,
      etag: '"feed-v1"',
      lastModified: null,
      lastStatus: 200,
      fetchedAt: item.fetchedAt,
    }
    const robots = {
      host: 'newsletter.example',
      verdict: 'allow',
      directives: { matchedUserAgent: null, rules: [] },
      status: 404,
      contentType: null,
      wafAction: null,
      authoritative: true,
      fetchedAt: item.fetchedAt,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    }
    const host = { host: 'newsletter.example', publisherId: aggregator.publisherId }
    const { database, statements, transactions } = capturingDatabase(
      [{ itemUrl: issueUrl, publisherId: aggregator.publisherId, sourceId: aggregator.id, transport: aggregator.transport }],
      [host],
      [],
      [aggregator],
      [],
      [aggregator],
      [item],
      [feedCache],
      [robots],
      [host],
      [selfLink],
      [selfSignal],
      [selfCitation],
    )
    const fetcher = fixtureFetcher((url) => {
      if (url === aggregator.endpointUrl)
        return { status: 304 }
      if (url === issueUrl) {
        return {
          status: 200,
          contentType: 'text/html',
          headers: { etag: '"issue-v1"' },
          body: `<a href="${targetUrl}">Recovered release</a>`,
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const graph = await runNeonIngestion(at, database, fetcher)

    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'not_modified' })
    expect(graph.items[0]?.issueHydratedAt).toBeInstanceOf(Date)
    expect(graph.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'outbound', rawUrl: targetUrl }),
    ]))
    const itemStatementIndex = statements.findIndex(statement =>
      statement.table === items
      && (statement.values as { issueHydratedAt?: Date }).issueHydratedAt instanceof Date,
    )
    const issueCacheStatementIndex = statements.findIndex(statement =>
      statement.table === httpCache
      && (statement.values as { url?: string }).url === issueUrl,
    )
    const citationStatementIndex = statements.findIndex(statement =>
      statement.table === citations
      && (statement.values as { rawUrl?: string }).rawUrl === targetUrl,
    )
    expect(itemStatementIndex).toBeGreaterThanOrEqual(0)
    expect(issueCacheStatementIndex).toBeGreaterThanOrEqual(0)
    expect(citationStatementIndex).toBeGreaterThanOrEqual(0)
    expect(transactions).toContainEqual(expect.arrayContaining([
      expect.objectContaining({ sql: `statement-${itemStatementIndex + 1}` }),
      expect.objectContaining({ sql: `statement-${issueCacheStatementIndex + 1}` }),
      expect.objectContaining({ sql: `statement-${citationStatementIndex + 1}` }),
    ]))
  })

  it('commits an issue-page validator with its hydrated Citations without creating a Source', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const aggregator = {
      id: '00000000-0000-4000-8000-000000000121',
      publisherId: '00000000-0000-4000-8000-000000000021',
      transport: 'rss' as const,
      endpointUrl: 'https://newsletter.example/feed.xml',
      isAggregator: true,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: null,
      newestItemAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const host = { host: 'newsletter.example', publisherId: aggregator.publisherId }
    const issueUrl = 'https://newsletter.example/issues/validator'
    const targetUrl = 'https://target.example/releases/validator'
    const { database, statements, transactions } = capturingDatabase(
      [],
      [host],
      [],
      [aggregator],
      [],
      [aggregator],
      [],
      [],
      [],
      [host],
      [],
      [],
      [],
    )
    const fetcher = fixtureFetcher((url) => {
      if (url.endsWith('/robots.txt'))
        return { status: 404 }
      if (url === aggregator.endpointUrl) {
        return {
          status: 200,
          contentType: 'application/rss+xml',
          body: `<rss><channel><item>
            <guid>validator-issue</guid>
            <title>Validator issue</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        }
      }
      if (url === issueUrl) {
        return {
          status: 200,
          contentType: 'text/html',
          headers: { etag: '"issue-v1"' },
          body: `<a href="${targetUrl}">Target release</a>`,
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const graph = await runNeonIngestion(at, database, fetcher)

    expect(graph.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'outbound', rawUrl: targetUrl }),
    ]))
    const issueCacheStatementIndex = statements.findIndex(statement =>
      statement.table === httpCache
      && (statement.values as { url?: string }).url === issueUrl,
    )
    const citationStatementIndex = statements.findIndex(statement => statement.table === citations)
    const itemStatementIndex = statements.findIndex(statement =>
      statement.table === items
      && (statement.values as { issueHydratedAt?: Date }).issueHydratedAt instanceof Date,
    )
    expect(issueCacheStatementIndex).toBeGreaterThanOrEqual(0)
    expect(citationStatementIndex).toBeGreaterThanOrEqual(0)
    expect(itemStatementIndex).toBeGreaterThanOrEqual(0)
    expect(transactions).toContainEqual(expect.arrayContaining([
      expect.objectContaining({ sql: `statement-${issueCacheStatementIndex + 1}` }),
      expect.objectContaining({ sql: `statement-${citationStatementIndex + 1}` }),
      expect.objectContaining({ sql: `statement-${itemStatementIndex + 1}` }),
    ]))
    expect(statements.some(statement => statement.kind === 'insert' && statement.table === sources)).toBe(false)
  })

  it('recomputes Strength from Citations belonging to Sources that are not due', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const dueSource = {
      id: '00000000-0000-4000-8000-000000000141',
      publisherId: '00000000-0000-4000-8000-000000000041',
      transport: 'rss' as const,
      endpointUrl: 'https://due-publisher.example/feed.xml',
      isAggregator: false,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: null,
      newestItemAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const historicalSource = {
      ...dueSource,
      id: '00000000-0000-4000-8000-000000000142',
      publisherId: '00000000-0000-4000-8000-000000000042',
      endpointUrl: 'https://historical-publisher.example/feed.xml',
    }
    const host = { host: 'due-publisher.example', publisherId: dueSource.publisherId }
    const targetLink = {
      id: '00000000-0000-8000-8000-000000000341',
      url: 'https://independent.example/releases/one',
      firstSeenAt: new Date('2026-08-28T08:00:00.000Z'),
      createdAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const targetSignal = {
      id: targetLink.id,
      targetLinkId: targetLink.id,
      mergedIntoId: null,
      strength: 0,
      originPublisherId: null,
      createdAt: targetLink.createdAt,
    }
    const historicalCitation = {
      id: '00000000-0000-8000-8000-000000000441',
      itemId: '00000000-0000-8000-8000-000000000241',
      sourceId: historicalSource.id,
      linkId: targetLink.id,
      kind: 'outbound' as const,
      rawUrl: targetLink.url,
      firstSeenAt: targetLink.firstSeenAt,
      createdAt: targetLink.createdAt,
    }
    const { database } = capturingDatabase(
      [],
      [host],
      [],
      [dueSource],
      [],
      [dueSource, historicalSource],
      [],
      [],
      [],
      [host],
      [targetLink],
      [targetSignal],
      [historicalCitation],
    )
    const fetcher = fixtureFetcher(url => url.endsWith('/robots.txt')
      ? { status: 404 }
      : { status: 200, body: '<rss><channel /></rss>', contentType: 'application/rss+xml' })

    const graph = await runNeonIngestion(at, database, fetcher)

    expect(graph.signals.find(signal => signal.id === targetSignal.id)?.strength).toBe(1)
  })

  it('commits eager Signals with Links and then persists the resolved Signal graph', async () => {
    const at = new Date('2026-08-29T08:00:00.000Z')
    const source = {
      id: '00000000-0000-4000-8000-000000000101',
      publisherId: '00000000-0000-4000-8000-000000000001',
      transport: 'rss' as const,
      endpointUrl: 'https://publisher.example/feed.xml',
      isAggregator: false,
      disabledAt: null,
      disabledReason: null,
      consecutiveFailures: 0,
      retryAfterAt: null,
      lastPolledAt: null,
      newestItemAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const host = { host: 'publisher.example', publisherId: source.publisherId }
    const existingLink = {
      id: '00000000-0000-8000-8000-000000000301',
      url: 'https://external.example/story',
      firstSeenAt: new Date('2026-08-28T08:00:00.000Z'),
      createdAt: new Date('2026-08-28T08:00:00.000Z'),
    }
    const { database, statements, transactions } = capturingDatabase(
      [],
      [host],
      [],
      [source],
      [],
      [source],
      [],
      [],
      [],
      [host],
      [existingLink],
      [],
      [],
    )
    const feed = `<rss version="2.0"><channel><item>
      <guid>release-1</guid>
      <title>Release one</title>
      <link>https://publisher.example/releases/one?utm_source=feed</link>
      <description><![CDATA[Read <a href="https://external.example/story?utm_source=feed">the story</a>.]]></description>
    </item></channel></rss>`
    const fetcher = fixtureFetcher(url => url.endsWith('/robots.txt')
      ? { status: 404 }
      : { status: 200, body: feed, contentType: 'application/rss+xml' })

    const graph = await runNeonIngestion(at, database, fetcher)

    expect(graph.items).toHaveLength(1)
    expect(graph.links.map(link => link.url).sort()).toEqual([
      'https://external.example/story',
      'https://publisher.example/releases/one',
    ].sort())
    expect(graph.links.find(link => link.url === existingLink.url)?.id).toBe(existingLink.id)
    expect(graph.citations.map(citation => citation.kind)).toEqual(['self', 'outbound'])
    expect(graph.citations.find(citation => citation.kind === 'outbound')?.anchorText).toBe('the story')

    const itemIndex = statements.findIndex(statement => statement.table === items)
    const linkIndex = statements.findIndex(statement => statement.table === links)
    const signalIndex = statements.findIndex(statement => statement.table === signals)
    const citationIndex = statements.findIndex(statement => statement.table === citations)
    expect(itemIndex).toBeGreaterThanOrEqual(0)
    expect(linkIndex).toBeGreaterThan(itemIndex)
    expect(signalIndex).toBeGreaterThan(linkIndex)
    expect(citationIndex).toBeGreaterThan(signalIndex)
    expect(statements
      .filter(statement => statement.table === citations)
      .map(statement => statement.values)
      .find(value => (value as { rawUrl?: string }).rawUrl?.includes('external.example')),
    ).toMatchObject({ linkId: existingLink.id })
    expect(statements.find(statement => statement.table === citations
      && (statement.values as { kind?: string }).kind === 'outbound')?.conflict)
      .toMatchObject({ set: { anchorText: 'the story', firstSeenAt: expect.anything() } })
    const perSourceSignalWrites = statements.filter(statement => statement.table === signals
      && !Array.isArray(statement.values))
    expect(perSourceSignalWrites).not.toHaveLength(0)
    for (const statement of perSourceSignalWrites) {
      expect(statement.values).toMatchObject({
        textBasis: null,
        embeddingText: null,
        embedding: null,
        embeddingModel: null,
        embeddingDimensions: null,
        embeddingVersion: null,
        embeddedAt: null,
      })
    }
    expect(statements.some(statement => statement.table === signals
      && (statement.values as { targetLinkId?: string }).targetLinkId === existingLink.id)).toBe(true)
    const signalBatches = statements.filter(statement => statement.kind === 'insert'
      && statement.table === signals
      && Array.isArray(statement.values))
    expect(signalBatches).toHaveLength(2)
    expect(signalBatches[0]?.values).toEqual(expect.arrayContaining([
      expect.objectContaining({ mergedIntoId: null, strength: 0, originPublisherId: null }),
    ]))
    expect(signalBatches[1]?.values).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetLinkId: existingLink.id, strength: 1 }),
    ]))
    expect(signalBatches[1]?.conflict).toMatchObject({
      set: {
        mergedIntoId: expect.anything(),
        strength: expect.anything(),
        originPublisherId: expect.anything(),
      },
    })
    expect(transactions).toHaveLength(2)
  })
})
