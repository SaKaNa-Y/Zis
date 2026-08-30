import { describe, expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const NOW = new Date('2026-08-29T08:00:00.000Z')
const MAX_FEED_BYTES = 2 * 1024 * 1024

const source = {
  id: '00000000-0000-4000-8000-000000000101',
  publisherId: '00000000-0000-4000-8000-000000000001',
  transport: 'rss' as const,
  endpointUrl: 'https://publisher.example/feed.xml?edition=daily&format=full',
  isAggregator: false,
  disabledAt: null,
  disabledReason: null,
  consecutiveFailures: 0,
  retryAfterAt: null,
  lastPolledAt: null,
  newestItemAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('the ingestion seam', () => {
  it('persists normalized RSS Items only after robots allows the host', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        {
          url: 'https://publisher.example/robots.txt',
          status: 404,
          headers: { 'content-type': 'text/html' },
          body: '<html>not found</html>',
        },
        {
          url: source.endpointUrl,
          requires: ['https://publisher.example/robots.txt'],
          status: 200,
          headers: {
            'content-type': 'application/rss+xml',
            'etag': '"feed-v1"',
            'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT',
          },
          body: `<?xml version="1.0"?>
            <rss version="2.0"><channel>
              <item>
                <guid>release-1</guid>
                <title>Zis ships</title>
                <link>https://publisher.example/posts/zis?utm_source=rss</link>
                <description><![CDATA[<p>A small, useful brief.</p>]]></description>
                <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
              </item>
              <item>
                <guid>release-2</guid>
                <title>Tomorrow's Item</title>
                <link>https://publisher.example/posts/tomorrow</link>
                <description>Future dates are clamped.</description>
                <pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>
              </item>
            </channel></rss>`,
        },
      ],
    })

    expect(graph.items).toHaveLength(2)
    expect(graph.items.map(item => item.externalId)).toEqual(['release-2', 'release-1'])
    expect(graph.items[0]).toMatchObject({
      title: 'Tomorrow\'s Item',
      rawFeedDate: 'Tue, 01 Sep 2026 10:00:00 GMT',
      publishedAt: NOW,
    })
    expect(graph.items[1]).toMatchObject({
      title: 'Zis ships',
      url: 'https://publisher.example/posts/zis',
      summary: 'A small, useful brief.',
      text: 'A small, useful brief.',
      rawFeedDate: 'Mon, 01 Jan 2024 10:00:00 GMT',
      publishedAt: new Date('2024-01-01T10:00:00.000Z'),
    })

    expect(graph.sources[0]).toMatchObject({
      consecutiveFailures: 0,
      lastPolledAt: NOW,
      newestItemAt: NOW,
      disabledAt: null,
    })
    expect(graph.httpCache).toEqual([{
      url: source.endpointUrl,
      etag: '"feed-v1"',
      lastModified: 'Fri, 28 Aug 2026 10:00:00 GMT',
      lastStatus: 200,
      fetchedAt: NOW,
    }])
    expect(graph.fetchLogs).toEqual([expect.objectContaining({
      sourceId: source.id,
      outcome: 'ok',
      httpStatus: 200,
      itemsSeen: 2,
      itemsNew: 2,
    })])
  })

  it.each([
    {
      name: 'rejects a DTD before the chosen parser sees it',
      body: '<!DOCTYPE rss SYSTEM "file:///etc/passwd"><rss><channel /></rss>',
      outcome: 'parse_error',
    },
    {
      name: 'does not expand a billion-laughs entity graph',
      body: `<!DOCTYPE lolz [
        <!ENTITY lol "lol">
        <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
        <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
      ]><rss><channel><item><title>&lol2;</title></item></channel></rss>`,
      outcome: 'parse_error',
    },
    {
      name: 'applies the feed byte cap before parse',
      body: `<rss><channel><!--${'x'.repeat(MAX_FEED_BYTES)}--></channel></rss>`,
      outcome: 'too_large',
    },
  ])('$name', async ({ body, outcome }) => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, headers: { 'content-type': 'application/xml' }, body },
      ],
    })

    expect(graph.items).toHaveLength(0)
    expect(graph.sources[0]?.consecutiveFailures).toBe(1)
    expect(graph.fetchLogs).toEqual([expect.objectContaining({
      sourceId: source.id,
      outcome,
      httpStatus: 200,
      itemsSeen: 0,
    })])
  })

  it('updates an edited upstream Item in place without re-keying it', async () => {
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: '<rss><channel><item><guid>stable-guid</guid><title>Original title</title><link>https://publisher.example/original</link><description>Original summary</description></item></channel></rss>',
        },
      ],
    })
    const originalId = first.items[0]?.id
    const later = new Date('2026-08-29T09:00:00.000Z')

    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => later,
      responses: [{
        url: source.endpointUrl,
        status: 200,
        body: '<rss><channel><item><guid>stable-guid</guid><title>Corrected title</title><link>https://publisher.example/corrected</link><description>Corrected summary</description></item></channel></rss>',
      }],
    })

    expect(second.items).toHaveLength(1)
    expect(second.items[0]).toMatchObject({
      id: originalId,
      externalId: 'stable-guid',
      title: 'Corrected title',
      summary: 'Corrected summary',
      url: 'https://publisher.example/corrected',
      updatedAt: later,
    })
    expect(second.fetchLogs.at(-1)).toEqual(expect.objectContaining({ itemsSeen: 1, itemsNew: 0 }))
  })

  it('falls back from the transport id to canonical URL and then title-plus-link hash', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel>
            <item><title>URL key</title><link>https://publisher.example/item?b=2&amp;utm_medium=feed&amp;a=1#fragment</link></item>
            <item><title>Hash key</title><description>No address was supplied.</description></item>
          </channel></rss>`,
        },
      ],
    })

    expect(graph.items.map(item => item.externalId)).toEqual([
      expect.stringMatching(/^https:\/\/publisher\.example\/item\?a=1&b=2$/),
      expect.stringMatching(/^sha256:[a-f\d]{64}$/),
    ])
  })

  it('normalizes Atom entries through the same seam', async () => {
    const atomSource = { ...source, transport: 'atom' as const }
    const graph = await runIngestion({
      sources: [atomSource],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: atomSource.endpointUrl,
          status: 200,
          body: `<feed xmlns="http://www.w3.org/2005/Atom">
            <entry>
              <id>tag:publisher.example,2026:atom-1</id>
              <title>Atom Item</title>
              <link rel="alternate" href="https://publisher.example/atom-item" />
              <summary>Atom summary.</summary>
              <published>2026-08-28T07:00:00Z</published>
            </entry>
          </feed>`,
        },
      ],
    })

    expect(graph.items).toEqual([expect.objectContaining({
      externalId: 'tag:publisher.example,2026:atom-1',
      title: 'Atom Item',
      summary: 'Atom summary.',
      url: 'https://publisher.example/atom-item',
      publishedAt: new Date('2026-08-28T07:00:00.000Z'),
    })])
  })

  it('stores plain Item text separately from the permanent summary', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>separate-text</guid>
            <title>Separate text fields</title>
            <link>https://publisher.example/separate-text</link>
            <description><![CDATA[<p>Permanent summary.</p>]]></description>
            <content><![CDATA[<p>Full <em>body</em> text for matching.</p>]]></content>
          </item></channel></rss>`,
        },
      ],
    })

    expect(graph.items[0]).toMatchObject({
      summary: 'Permanent summary.',
      text: 'Full body text for matching.',
    })
  })

  it('uses byte-identical validators and treats 304 as success without touching newest_item_at', async () => {
    const rawDate = 'Thu, 01 Jan 2026 00:00:00 GMT'
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          headers: {
            'etag': '"conditional-v1"',
            'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT',
          },
          body: `<rss><channel><item><guid>conditional</guid><title>Conditional Item</title><pubDate>${rawDate}</pubDate></item></channel></rss>`,
        },
      ],
    })
    const persistedSource = first.sources[0]!
    persistedSource.consecutiveFailures = 4
    const newestBefore = persistedSource.newestItemAt
    const later = new Date('2026-08-29T09:00:00.000Z')

    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => later,
      responses: [
        {
          url: source.endpointUrl,
          status: 200,
          body: '<this is deliberately not XML>',
        },
        {
          url: source.endpointUrl,
          whenHeaders: {
            'if-none-match': '"conditional-v1"',
            'if-modified-since': 'Fri, 28 Aug 2026 10:00:00 GMT',
          },
          status: 304,
        },
      ],
    })

    expect(second.sources[0]).toMatchObject({
      consecutiveFailures: 0,
      lastPolledAt: later,
      newestItemAt: newestBefore,
    })
    expect(second.items).toHaveLength(1)
    expect(second.fetchLogs.at(-1)).toEqual(expect.objectContaining({
      outcome: 'not_modified',
      httpStatus: 304,
      itemsSeen: 0,
      itemsNew: 0,
    }))
    expect(second.httpCache).toEqual([expect.objectContaining({
      url: source.endpointUrl,
      etag: '"conditional-v1"',
      lastStatus: 304,
      fetchedAt: later,
    })])
    expect(second.dormantSourceIds).toEqual([source.id])
    expect(second.sources[0]?.disabledAt).toBeNull()
  })

  it('does not cache validators until a successful feed has been parsed', async () => {
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          headers: { etag: '"poisoned"' },
          body: '<html><body>A WAF challenge, not a feed.</body></html>',
        },
      ],
    })

    expect(first.httpCache).toEqual([])
    expect(first.fetchLogs.at(-1)).toEqual(expect.objectContaining({ outcome: 'parse_error' }))

    const later = new Date('2026-08-29T09:00:00.000Z')
    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => later,
      responses: [{
        url: source.endpointUrl,
        status: 200,
        body: '<rss><channel><item><guid>recovered</guid><title>Recovered feed</title></item></channel></rss>',
      }],
    })

    expect(second.items).toEqual([expect.objectContaining({ externalId: 'recovered' })])
    expect(second.httpCache).toEqual([expect.objectContaining({ url: source.endpointUrl, lastStatus: 200 })])
  })

  it('canonicalizes the validator cache key without changing query parameter order', async () => {
    const nonCanonicalSource = {
      ...source,
      endpointUrl: 'HTTPS://PUBLISHER.EXAMPLE:443/feed.xml?z=last&a=first#ignored',
    }
    const canonicalUrl = 'https://publisher.example/feed.xml?z=last&a=first'
    const graph = await runIngestion({
      sources: [nonCanonicalSource],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: canonicalUrl,
          status: 200,
          headers: { etag: '"canonical"' },
          body: '<rss><channel><item><guid>canonical</guid><title>Canonical cache</title></item></channel></rss>',
        },
      ],
    })

    expect(graph.httpCache).toEqual([expect.objectContaining({ url: canonicalUrl })])
  })

  it('clears obsolete validators when a later 200 response omits them', async () => {
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          headers: { 'etag': '"old"', 'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT' },
          body: '<rss><channel><item><guid>old</guid><title>Old validator</title></item></channel></rss>',
        },
      ],
    })
    const later = new Date('2026-08-29T09:00:00.000Z')
    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => later,
      responses: [{
        url: source.endpointUrl,
        whenHeaders: {
          'if-none-match': '"old"',
          'if-modified-since': 'Fri, 28 Aug 2026 10:00:00 GMT',
        },
        status: 200,
        body: '<rss><channel><item><guid>new</guid><title>No validator now</title></item></channel></rss>',
      }],
    })

    expect(second.httpCache).toEqual([expect.objectContaining({ etag: null, lastModified: null })])
  })

  it('obeys x-poll-interval on a successful response', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          headers: { 'x-poll-interval': '7200' },
          body: '<rss><channel><item><guid>poll</guid><title>Poll interval</title></item></channel></rss>',
        },
      ],
    })

    expect(graph.sources[0]?.retryAfterAt).toEqual(new Date('2026-08-29T10:00:00.000Z'))
  })

  it('honors Retry-After and auto-disables only after failure 10', async () => {
    const failingSource = { ...source, consecutiveFailures: 9 }
    const graph = await runIngestion({
      sources: [failingSource],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: failingSource.endpointUrl,
          status: 429,
          headers: { 'retry-after': 'Mon, 31 Aug 2026 08:00:00 GMT' },
        },
      ],
    })

    expect(graph.sources[0]).toMatchObject({
      consecutiveFailures: 10,
      retryAfterAt: new Date('2026-08-31T08:00:00.000Z'),
      disabledAt: NOW,
      disabledReason: 'automatically disabled after 10 consecutive failures',
    })
    expect(graph.fetchLogs).toEqual([expect.objectContaining({ outcome: 'http_error', httpStatus: 429 })])
  })

  it('keeps robots-denied Sources eligible for a later TTL re-probe', async () => {
    const failingSource = { ...source, consecutiveFailures: 9 }
    const graph = await runIngestion({
      sources: [failingSource],
      now: () => NOW,
      responses: [{
        url: 'https://publisher.example/robots.txt',
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'User-agent: *\nDisallow: /',
      }],
    })

    expect(graph.sources[0]).toMatchObject({
      consecutiveFailures: 10,
      disabledAt: NOW,
      disabledReason: 'automatically disabled after 10 consecutive robots denials',
    })
    expect(graph.fetchLogs.at(-1)).toEqual(expect.objectContaining({ outcome: 'robots_denied' }))
  })

  it('honors origin retry headers when feed parsing fails', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          headers: { 'retry-after': 'Mon, 31 Aug 2026 08:00:00 GMT' },
          body: '<html><body>Not a feed</body></html>',
        },
      ],
    })

    expect(graph.sources[0]?.retryAfterAt).toEqual(new Date('2026-08-31T08:00:00.000Z'))
    expect(graph.fetchLogs.at(-1)).toEqual(expect.objectContaining({ outcome: 'parse_error' }))
  })

  it('checks robots and host serialization again after redirects', async () => {
    const redirectedSources = [
      { ...source, id: 'redirect-a', endpointUrl: 'https://first.example/feed.xml' },
      { ...source, id: 'redirect-b', endpointUrl: 'https://second.example/feed.xml' },
    ]
    const graph = await runIngestion({
      sources: redirectedSources,
      now: () => NOW,
      responses: [
        { url: 'https://first.example/robots.txt', status: 404 },
        { url: 'https://second.example/robots.txt', status: 404 },
        { url: redirectedSources[0]!.endpointUrl, status: 302, headers: { location: 'https://final.example/a.xml' } },
        { url: redirectedSources[1]!.endpointUrl, status: 302, headers: { location: 'https://final.example/b.xml' } },
        { url: 'https://final.example/robots.txt', status: 404 },
        {
          url: 'https://final.example/a.xml',
          status: 200,
          delayMs: 5,
          failAboveHostActive: 1,
          body: '<rss><channel><item><guid>redirect-a</guid><title>Redirect A</title></item></channel></rss>',
        },
        {
          url: 'https://final.example/b.xml',
          status: 200,
          delayMs: 5,
          failAboveHostActive: 1,
          body: '<rss><channel><item><guid>redirect-b</guid><title>Redirect B</title></item></channel></rss>',
        },
      ],
    })

    expect(graph.items.map(item => item.externalId).sort()).toEqual(['redirect-a', 'redirect-b'])
    expect(graph.robotsCache.some(record => record.host === 'final.example')).toBe(true)
  })

  it('does not fetch a redirect target that robots denies', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 302, headers: { location: 'https://blocked.example/feed.xml' } },
        {
          url: 'https://blocked.example/robots.txt',
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nDisallow: /',
        },
      ],
    })

    expect(graph.items).toEqual([])
    expect(graph.fetchLogs.at(-1)).toEqual(expect.objectContaining({ outcome: 'robots_denied' }))
  })

  it('fails closed when robots.txt redirects to a different host', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        {
          url: 'https://publisher.example/robots.txt',
          status: 302,
          headers: { location: 'https://policy.example/robots.txt' },
        },
        {
          url: 'https://policy.example/robots.txt',
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nAllow: /',
        },
        {
          url: source.endpointUrl,
          status: 200,
          body: '<rss><channel><item><guid>bypass</guid><title>Must not pass</title></item></channel></rss>',
        },
      ],
    })

    expect(graph.items).toEqual([])
    expect(graph.fetchLogs.at(-1)).toEqual(expect.objectContaining({ outcome: 'robots_denied' }))
    expect(graph.robotsCache).toEqual([expect.objectContaining({
      host: 'publisher.example',
      verdict: 'ambiguous',
    })])
  })

  it('records measured fetch duration', async () => {
    let milliseconds = NOW.getTime()
    const graph = await runIngestion({
      sources: [source],
      now: () => {
        const value = new Date(milliseconds)
        milliseconds += 7
        return value
      },
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: '<rss><channel><item><guid>timed</guid><title>Timed fetch</title></item></channel></rss>',
        },
      ],
    })

    expect(graph.fetchLogs[0]?.durationMs).toBeGreaterThan(0)
  })

  it('fetches serially per host with a global concurrency cap of six', async () => {
    const concurrentSources = Array.from({ length: 8 }, (_, index) => {
      const hostIndex = index === 1 ? 0 : index === 0 ? 0 : index - 1
      return {
        ...source,
        id: `source-${index}`,
        endpointUrl: `https://host${hostIndex}.example/feed-${index}.xml`,
      }
    })
    const hosts = [...new Set(concurrentSources.map(candidate => new URL(candidate.endpointUrl).host))]
    const responses = [
      ...hosts.map((host, index) => ({
        url: `https://${host}/robots.txt`,
        status: 404,
        waitForActive: index < 6 ? 6 : undefined,
        delayMs: 5,
        failAboveActive: 6,
      })),
      ...concurrentSources.map((candidate, index) => ({
        url: candidate.endpointUrl,
        requires: [`https://${new URL(candidate.endpointUrl).host}/robots.txt`],
        status: 200,
        delayMs: 5,
        failAboveActive: 6,
        body: `<rss><channel><item><guid>concurrent-${index}</guid><title>Concurrent ${index}</title></item></channel></rss>`,
      })),
    ]

    const graph = await runIngestion({ sources: concurrentSources, responses, now: () => NOW })

    expect(graph.items).toHaveLength(8)
    expect(graph.fetchLogs.every(log => log.outcome === 'ok')).toBe(true)
  })
})
