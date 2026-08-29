import type { Database } from '@/lib/db'
import type { SafeFetch } from '@/lib/safe-fetch'
import { describe, expect, it } from 'vitest'
import { citations, items, links } from '@/lib/db/schema'
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
  statements: CapturedStatement[]
  transactions: unknown[][]
} {
  const queued = [...results]
  const statements: CapturedStatement[] = []
  const transactions: unknown[][] = []

  function capture(kind: CapturedStatement['kind'], table: object, values: unknown) {
    const statementNumber = statements.push({ kind, table, values })
    const query = {
      onConflictDoUpdate: (conflict: unknown) => {
        statements[statementNumber - 1]!.conflict = conflict
        return query
      },
      toSQL: () => ({ sql: `statement-${statementNumber}`, params: [] }),
    }
    return query
  }

  const database = {
    select: () => ({
      from: () => {
        const result = Promise.resolve(queued.shift() ?? [])
        return Object.assign(result, {
          innerJoin: () => result,
          where: () => result,
        })
      },
    }),
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

  return { database, statements, transactions }
}

interface FetchFixture {
  status: number
  body?: string
  contentType?: string
}

function fixtureFetcher(resolve: (url: string) => FetchFixture): SafeFetch {
  return async (url, options) => {
    const signal = options?.signal ?? new AbortController().signal
    const release = await options?.beforeRequest?.(url, signal)
    try {
      const fixture = resolve(url)
      const body = fixture.body ?? ''
      const bytes = new TextEncoder().encode(body)
      const headers: Record<string, string> = fixture.contentType === undefined
        ? {}
        : { 'content-type': fixture.contentType }
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

describe('the production ingestion startup assertion', () => {
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
      [item],
      [cache],
      [robots],
      [host],
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

  it('commits Items, Links, and Citations together while reusing an existing Link', async () => {
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
      [],
      [],
      [],
      [host],
      [existingLink],
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

    const itemIndex = statements.findIndex(statement => statement.table === items)
    const linkIndex = statements.findIndex(statement => statement.table === links)
    const citationIndex = statements.findIndex(statement => statement.table === citations)
    expect(itemIndex).toBeGreaterThanOrEqual(0)
    expect(linkIndex).toBeGreaterThan(itemIndex)
    expect(citationIndex).toBeGreaterThan(linkIndex)
    expect(statements
      .filter(statement => statement.table === citations)
      .map(statement => statement.values)
      .find(value => (value as { rawUrl?: string }).rawUrl?.includes('external.example')),
    ).toMatchObject({ linkId: existingLink.id })
    expect(statements.find(statement => statement.table === citations)?.conflict)
      .toMatchObject({ set: { firstSeenAt: expect.anything() } })
    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toHaveLength(statements.length)
  })
})
