import type { IngestionSource } from './pipeline'
import { expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const source: IngestionSource = {
  id: 'source',
  publisherId: 'publisher',
  transport: 'rss',
  endpointUrl: 'https://example.com/feed.xml',
  isAggregator: false,
  disabledAt: null,
  disabledReason: null,
  consecutiveFailures: 0,
  retryAfterAt: null,
  lastPolledAt: null,
  newestItemAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}
const first = new Date('2026-09-08T06:00:00Z')
const next = new Date('2026-09-09T06:00:00Z')
const feed = '<rss><channel><item><guid>one</guid><link>https://example.com/one</link><title>One</title><description>Same content</description><pubDate>Tue, 08 Sep 2026 05:00:00 GMT</pubDate></item></channel></rss>'
const responses = [
  { url: 'https://example.com/robots.txt', status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nAllow: /' },
  { url: source.endpointUrl, status: 200, headers: { 'content-type': 'application/rss+xml' }, body: feed },
]

it('keeps the content revision stable when an unchanged feed returns 200', async () => {
  const graph = await runIngestion({ sources: [source], publisherHosts: [{ host: 'example.com', publisherId: 'publisher' }], responses, now: () => first })
  expect(graph.fetchLogs).toEqual([expect.objectContaining({ outcome: 'ok' })])
  const initialItem = structuredClone(graph.items[0]!)
  const result = await runIngestion({ sources: [source], responses, initialGraph: graph, now: () => next })
  expect(result.items[0]!.updatedAt).toEqual(first)
  expect(result.items[0]!.fetchedAt).toEqual(next)
  expect(result.items[0]!.text).toEqual(initialItem.text)
  expect(result.citations[0]!.firstSeenAt).toEqual(first)
})

it('invalidates the content revision when only an outbound address changes', async () => {
  const withLink = (url: string) => feed.replace('Same content', `<![CDATA[<a href="${url}">Same content</a>]]>`)
  const firstResponses = [...responses.slice(0, 1), { ...responses[1]!, body: withLink('https://other.com/old') }]
  const graph = await runIngestion({ sources: [source], publisherHosts: [{ host: 'example.com', publisherId: 'publisher' }], responses: firstResponses, now: () => first })
  const result = await runIngestion({ sources: [source], initialGraph: graph, responses: [...responses.slice(0, 1), { ...responses[1]!, body: withLink('https://other.com/new') }], now: () => next })
  expect(result.items[0]!.updatedAt).toEqual(next)
  expect(result.citations.filter(row => row.kind === 'outbound').map(row => row.rawUrl).sort()).toEqual(['https://other.com/new', 'https://other.com/old'])
})
