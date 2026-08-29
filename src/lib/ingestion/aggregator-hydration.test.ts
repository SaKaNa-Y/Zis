import { describe, expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const NOW = new Date('2026-08-29T08:00:00.000Z')

const source = {
  id: '00000000-0000-4000-8000-000000000101',
  publisherId: '00000000-0000-4000-8000-000000000001',
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

describe('aggregator issue-page hydration', () => {
  it('turns an excerpt-only Aggregator link list into Citations that raise Strength', async () => {
    const independentSource = {
      ...source,
      id: '00000000-0000-4000-8000-000000000102',
      publisherId: '00000000-0000-4000-8000-000000000002',
      endpointUrl: 'https://independent.example/feed.xml',
      isAggregator: false,
    }
    const issueUrl = 'https://newsletter.example/issues/42?utm_source=feed'
    const rawTargetUrl = 'https://target.example/releases/widget?utm_source=issue#details'
    const targetUrl = 'https://target.example/releases/widget'

    const graph = await runIngestion({
      sources: [source, independentSource],
      publisherHosts: [
        { host: 'newsletter.example', publisherId: source.publisherId },
        { host: 'independent.example', publisherId: independentSource.publisherId },
      ],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>newsletter-42</guid>
            <title>Newsletter 42</title>
            <link>${issueUrl}</link>
            <description>An excerpt without the issue link list.</description>
          </item></channel></rss>`,
        },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html', 'etag': '"issue-42"' },
          body: `<main>
            <a href="${rawTargetUrl}">Widget release</a>
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/URL">URL reference</a>
            <a href="https://newsletter.example/archive">Issue archive</a>
          </main>`,
        },
        { url: 'https://independent.example/robots.txt', status: 404 },
        {
          url: independentSource.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>independent-item</guid>
            <title>Independent Item</title>
            <link>https://independent.example/items/widget</link>
            <description><![CDATA[<a href="${targetUrl}">Widget release</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    const aggregatorItem = graph.items.find(item => item.sourceId === source.id)!
    expect(graph.citations.filter(citation => citation.itemId === aggregatorItem.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
        expect.objectContaining({ kind: 'outbound', rawUrl: rawTargetUrl }),
      ]),
    )
    expect(graph.links.some(link => link.url.includes('developer.mozilla.org'))).toBe(false)
    expect(graph.links.some(link => link.url === 'https://newsletter.example/archive')).toBe(false)

    const targetLink = graph.links.find(link => link.url === targetUrl)!
    expect(graph.signals.find(signal => signal.targetLinkId === targetLink.id)).toMatchObject({
      originPublisherId: null,
      strength: 2,
    })
  })

  it('treats a conditional 304 as proof that existing Citations are current', async () => {
    const issueUrl = 'https://newsletter.example/issues/conditional'
    const currentUrl = 'https://target.example/releases/current'
    const poisonedUrl = 'https://target.example/releases/must-not-be-extracted'
    const feed = `<rss><channel><item>
      <guid>conditional-issue</guid>
      <title>Conditional issue</title>
      <link>${issueUrl}</link>
      <description>Excerpt only.</description>
    </item></channel></rss>`
    const first = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feed },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html', 'etag': '"conditional-v1"' },
          body: `<a href="${currentUrl}">Current release</a>`,
        },
      ],
    })
    const currentCitation = first.citations.find(citation => citation.rawUrl === currentUrl)!

    const later = new Date('2026-08-29T09:00:00.000Z')
    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => new Date(later),
      responses: [
        { url: source.endpointUrl, status: 200, body: feed },
        {
          url: issueUrl,
          status: 304,
          whenHeaders: { 'if-none-match': '"conditional-v1"' },
          body: `<a href="${poisonedUrl}">This body must not be extracted</a>`,
        },
      ],
    })

    expect(second.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok' })
    expect(second.citations.find(citation => citation.rawUrl === currentUrl)).toEqual(currentCitation)
    expect(second.links.some(link => link.url === poisonedUrl)).toBe(false)
    expect(second.httpCache.find(record => record.url === issueUrl)).toMatchObject({
      etag: '"conditional-v1"',
      lastStatus: 304,
      fetchedAt: later,
    })
    expect(second.items[0]?.issueHydratedAt).toEqual(NOW)
  })

  it('hydrates an immutable issue only once when the origin supplies no validators', async () => {
    const issueUrl = 'https://newsletter.example/issues/immutable'
    const targetUrl = 'https://target.example/releases/immutable'
    const feed = `<rss><channel><item>
      <guid>immutable-issue</guid>
      <title>Immutable issue</title>
      <link>${issueUrl}</link>
      <description>Excerpt only.</description>
    </item></channel></rss>`
    const first = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feed },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<a href="${targetUrl}">Immutable release</a>`,
        },
      ],
    })
    const originalCitation = first.citations.find(citation => citation.rawUrl === targetUrl)!

    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      responses: [{ url: source.endpointUrl, status: 200, body: feed }],
    })

    expect(second.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok' })
    expect(second.citations.find(citation => citation.rawUrl === targetUrl)).toEqual(originalCitation)
    expect(second.httpCache.find(record => record.url === issueUrl)).toMatchObject({
      etag: null,
      lastModified: null,
      lastStatus: 200,
      fetchedAt: NOW,
    })
    expect(second.items[0]?.issueHydratedAt).toEqual(NOW)
  })

  it('never mutates an already hydrated issue when a conditional request returns 200', async () => {
    const issueUrl = 'https://newsletter.example/issues/validator-rotation'
    const originalUrl = 'https://target.example/releases/original'
    const replacementUrl = 'https://target.example/releases/replacement'
    const feed = `<rss><channel><item>
      <guid>validator-rotation</guid>
      <title>Validator rotation</title>
      <link>${issueUrl}</link>
    </item></channel></rss>`
    const first = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feed },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html', 'etag': '"issue-v1"' },
          body: `<a href="${originalUrl}">Original release</a>`,
        },
      ],
    })

    const later = new Date('2026-08-29T09:00:00.000Z')
    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => new Date(later),
      responses: [
        { url: source.endpointUrl, status: 200, body: feed },
        {
          url: issueUrl,
          status: 200,
          whenHeaders: { 'if-none-match': '"issue-v1"' },
          headers: { 'content-type': 'text/html', 'etag': '"issue-v2"' },
          body: `<a href="${replacementUrl}">Replacement release</a>`,
        },
      ],
    })

    expect(second.links.some(link => link.url === originalUrl)).toBe(true)
    expect(second.links.some(link => link.url === replacementUrl)).toBe(false)
    expect(second.httpCache.find(record => record.url === issueUrl)).toMatchObject({
      etag: '"issue-v2"',
      lastStatus: 200,
      fetchedAt: later,
    })
    expect(second.items[0]?.issueHydratedAt).toEqual(NOW)
  })

  it('does not mistake another fetch population\'s cache row for completed hydration', async () => {
    const issueUrl = 'https://newsletter.example/issues/shared-cache'
    const targetUrl = 'https://target.example/releases/shared-cache'
    const initialGraph = await runIngestion({
      sources: [{ ...source, isAggregator: false }],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: '<rss><channel /></rss>' },
      ],
    })
    initialGraph.sources[0]!.isAggregator = true
    initialGraph.httpCache.push({
      url: issueUrl,
      etag: null,
      lastModified: null,
      lastStatus: 200,
      fetchedAt: new Date(NOW),
    })

    const later = new Date('2026-08-29T09:00:00.000Z')
    const graph = await runIngestion({
      sources: [source],
      initialGraph,
      now: () => new Date(later),
      responses: [
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>shared-cache-issue</guid>
            <title>Shared cache issue</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<a href="${targetUrl}">Shared cache release</a>`,
        },
      ],
    })

    expect(graph.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'outbound', rawUrl: targetUrl }),
    ]))
    expect(graph.items[0]?.issueHydratedAt).toEqual(later)
  })

  it('hydrates only Sources explicitly marked as Aggregators', async () => {
    const ordinarySource = {
      ...source,
      endpointUrl: 'https://javascriptweekly.com/rss',
      isAggregator: false,
    }
    const issueUrl = 'https://javascriptweekly.com/issues/ordinary'
    const graph = await runIngestion({
      sources: [ordinarySource],
      publisherHosts: [{ host: 'javascriptweekly.com', publisherId: ordinarySource.publisherId }],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://javascriptweekly.com/robots.txt', status: 404 },
        {
          url: ordinarySource.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>ordinary-issue</guid>
            <title>Ordinary issue</title>
            <link>${issueUrl}</link>
            <description>No hydrated fetch is permitted.</description>
          </item></channel></rss>`,
        },
      ],
    })

    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok' })
    expect(graph.citations).toEqual([
      expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
    ])
    expect(graph.httpCache.some(record => record.url === issueUrl)).toBe(false)
    expect(graph.items[0]?.issueHydratedAt).toBeNull()
  })

  it('hydrates every issue without the prototype\'s 24-issue cap', async () => {
    const issueUrls = Array.from(
      { length: 25 },
      (_, index) => `https://newsletter.example/issues/${index + 1}`,
    )
    const graph = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel>${issueUrls.map((issueUrl, index) => `<item>
            <guid>issue-${index + 1}</guid>
            <title>Issue ${index + 1}</title>
            <link>${issueUrl}</link>
          </item>`).join('')}</channel></rss>`,
        },
        ...issueUrls.map((issueUrl, index) => ({
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<a href="https://target-${index + 1}.example/releases/${index + 1}">Release ${index + 1}</a>`,
        })),
      ],
    })

    expect(graph.citations.filter(citation => citation.kind === 'outbound')).toHaveLength(25)
    expect(graph.httpCache.filter(record => issueUrls.includes(record.url))).toHaveLength(25)
  })

  it('subjects an issue-page host to robots.txt with no exemption', async () => {
    const issueUrl = 'https://issues.example/newsletter/42'
    const forbiddenTarget = 'https://target.example/releases/forbidden'
    const graph = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>cross-host-issue</guid>
            <title>Cross-host issue</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        },
        {
          url: 'https://issues.example/robots.txt',
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nDisallow: /',
        },
        {
          url: issueUrl,
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<a href="${forbiddenTarget}">Forbidden release</a>`,
        },
      ],
    })

    expect(graph.links.some(link => link.url === forbiddenTarget)).toBe(false)
    expect(graph.robotsCache.find(record => record.host === 'issues.example')).toMatchObject({
      verdict: 'disallow',
    })
    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok' })
    expect(graph.citations).toEqual([
      expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
    ])
  })

  it('honors issue-page Retry-After without discarding the Item or self Citation', async () => {
    const issueUrl = 'https://newsletter.example/issues/deferred'
    const graph = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>deferred-issue</guid>
            <title>Deferred issue</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        },
        {
          url: issueUrl,
          status: 429,
          headers: { 'retry-after': 'Mon, 31 Aug 2026 08:00:00 GMT' },
        },
      ],
    })

    expect(graph.sources[0]?.retryAfterAt).toEqual(new Date('2026-08-31T08:00:00.000Z'))
    expect(graph.items).toEqual([expect.objectContaining({ externalId: 'deferred-issue' })])
    expect(graph.citations).toEqual([
      expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
    ])
    expect(graph.httpCache.some(record => record.url === issueUrl)).toBe(false)
    expect(graph.items[0]?.issueHydratedAt).toBeNull()
  })

  it.each<{
    body: string
    headers: Record<string, string>
    name: string
    status: number
  }>([
    {
      name: 'a non-200 success status',
      status: 202,
      headers: { 'content-type': 'text/html' },
      body: '<a href="https://target.example/releases/from-202">Release</a>',
    },
    {
      name: 'a non-HTML response',
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '<a href="https://target.example/releases/from-json">Release</a>',
    },
    {
      name: 'an empty HTML response',
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '',
    },
    {
      name: 'an HTML WAF challenge',
      status: 200,
      headers: { 'content-type': 'text/html', 'x-amzn-waf-action': 'captcha' },
      body: '<a href="https://target.example/releases/from-captcha">Continue</a>',
    },
    {
      name: 'a challenge interstitial without a WAF header',
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html><title>Just a moment...</title><a href="https://target.example/releases/from-challenge">Continue</a></html>',
    },
  ])('does not cache or extract $name', async ({ body, headers, status }) => {
    const issueUrl = `https://newsletter.example/issues/untrusted-${status}-${headers['content-type']}`
    const graph = await runIngestion({
      sources: [source],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>${issueUrl}</guid>
            <title>Untrusted issue response</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        },
        { url: issueUrl, status, headers, body },
      ],
    })

    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok' })
    expect(graph.citations).toEqual([
      expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
    ])
    expect(graph.httpCache.some(record => record.url === issueUrl)).toBe(false)
  })

  it('resolves hydrated relative hrefs from the final issue-page URL', async () => {
    const issueUrl = 'https://newsletter.example/issues/redirect'
    const finalIssueUrl = 'https://issues.example/archive/42/index.html'
    const rawTargetUrl = '../../releases/widget?utm_source=issue#details'
    const graph = await runIngestion({
      sources: [source],
      publisherHosts: [{ host: 'newsletter.example', publisherId: source.publisherId }],
      now: () => new Date(NOW),
      responses: [
        { url: 'https://newsletter.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>redirected-issue</guid>
            <title>Redirected issue</title>
            <link>${issueUrl}</link>
          </item></channel></rss>`,
        },
        {
          url: issueUrl,
          status: 302,
          headers: { location: finalIssueUrl },
        },
        { url: 'https://issues.example/robots.txt', status: 404 },
        {
          url: finalIssueUrl,
          requires: ['https://issues.example/robots.txt'],
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: `<a href="${rawTargetUrl}">Widget release</a>`,
        },
      ],
    })

    expect(graph.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'outbound', rawUrl: rawTargetUrl }),
    ]))
    expect(graph.links.some(link => link.url === 'https://issues.example/releases/widget')).toBe(true)
    expect(graph.httpCache.some(record => record.url === issueUrl)).toBe(true)
  })
})
