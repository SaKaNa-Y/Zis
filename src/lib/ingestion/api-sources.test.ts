import type { CannedTransportResponse, IngestionSource } from './pipeline'
import { describe, expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const NOW = new Date('2026-09-17T00:00:00Z')
const hn = 'https://hacker-news.firebaseio.com'
const bsky = 'https://public.api.bsky.app'
const did = 'did:plc:example'
const bskyUrl = `${bsky}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=100&filter=posts_no_replies&includePins=false`
function source(transport: IngestionSource['transport'], endpointUrl: string, id = 'source'): IngestionSource {
  return { id, publisherId: id, transport, endpointUrl, isAggregator: false, disabledAt: null, disabledReason: null, consecutiveFailures: 0, retryAfterAt: null, lastPolledAt: null, newestItemAt: null, createdAt: NOW }
}
function json(url: string, value: unknown, status = 200): CannedTransportResponse {
  return { url, status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }
}
function robots(host: string): CannedTransportResponse {
  return { url: `${host}/robots.txt`, status: 404 }
}

describe('aPI Sources through the real ingestion seam', () => {
  it('keeps HN thread identity, cites the submitted URL, and counts two lists as one Publisher', async () => {
    const top = source('hn_firebase', `${hn}/v0/topstories.json`, 'hn-top')
    const latest = { ...source('hn_firebase', `${hn}/v0/newstories.json`, 'hn-new'), publisherId: top.publisherId }
    const responses = [robots(hn), json(top.endpointUrl, [1, 2, 3]), json(latest.endpointUrl, [1]), json(`${hn}/v0/item/1.json`, { id: 1, type: 'story', title: 'Useful &amp; new', time: NOW.getTime() / 1000, url: 'https://article.example/new' }), json(`${hn}/v0/item/2.json`, { deleted: true }), json(`${hn}/v0/item/3.json`, { id: 3, type: 'job' })]
    responses.push(json(`${hn}/v0/item/1.json`, { id: 1, type: 'story', title: 'Useful &amp; new', time: NOW.getTime() / 1000, url: 'https://article.example/new' }))
    const graph = await runIngestion({ sources: [top, latest], responses, now: () => NOW })
    expect(graph.items).toHaveLength(2)
    expect(graph.items[0]).toMatchObject({ externalId: '1', url: 'https://news.ycombinator.com/item?id=1', title: 'Useful & new' })
    const link = graph.links.find(link => link.url === 'https://article.example/new')!
    expect(graph.signals.find(signal => signal.targetLinkId === link.id)?.strength).toBe(1)
    expect(graph.fetchLogs.map(log => log.outcome)).toEqual(['ok', 'ok'])
    await runIngestion({ sources: [top, latest], responses, initialGraph: graph, now: () => NOW })
    expect(graph.items).toHaveLength(2)
    expect(graph.fetchLogs.slice(-2).map(log => log.itemsNew)).toEqual([0, 0])
  })

  it('does not commit a partial HN list if a child request fails and preserves Retry-After', async () => {
    const input = source('hn_firebase', `${hn}/v0/topstories.json`)
    const graph = await runIngestion({ sources: [input], now: () => NOW, responses: [robots(hn), json(input.endpointUrl, [1, 2]), json(`${hn}/v0/item/1.json`, { id: 1, type: 'story', title: 'Story', time: 1 }), { ...json(`${hn}/v0/item/2.json`, {}, 429), headers: { 'retry-after': '3600' } }] })
    expect(graph.items).toEqual([])
    expect(graph.fetchLogs[0]).toMatchObject({ outcome: 'http_error', httpStatus: 429 })
    expect(graph.sources[0]?.retryAfterAt?.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 3600000)
  })

  it('uses Bluesky DID identity, facets and nested embeds without borrowing repost authorship', async () => {
    const post = { uri: `at://${did}/app.bsky.feed.post/123`, author: { did }, record: { $type: 'app.bsky.feed.post', text: 'Read this', createdAt: NOW.toISOString(), facets: [{ features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://article.example/facet' }] }], embed: { $type: 'app.bsky.embed.recordWithMedia', media: { $type: 'app.bsky.embed.external', external: { uri: 'https://article.example/embedded', title: 'Embedded article' } } } } }
    const graph = await runIngestion({ sources: [source('bluesky_feed', bskyUrl)], now: () => NOW, responses: [robots(bsky), json(bskyUrl, { feed: [{ post }, { post: { ...post, author: { did: 'did:plc:other' } }, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } }] })] })
    expect(graph.items).toHaveLength(1)
    expect(graph.items[0]?.externalId).toBe(post.uri)
    expect(graph.citations.filter(c => c.kind === 'outbound')).toHaveLength(2)
    expect(graph.items[0]?.url).toBe(`https://bsky.app/profile/${did}/post/123`)
  })

  it('fetches authenticated GraphQL releases, preserves tag identity and updates edited text', async () => {
    const input = source('github_graphql', 'https://github.com/owner/repo/releases')
    const release = { tagName: 'v1', name: '<b>Version one</b>', url: `${input.endpointUrl}/tag/v1`, description: 'Read https://article.example/announcement', publishedAt: NOW.toISOString(), isDraft: false }
    const responses = [robots('https://api.github.com'), { ...json('https://api.github.com/graphql', { data: { repository: { releases: { nodes: [release] } } } }), whenHeaders: { authorization: 'Bearer test-token' } }]
    const graph = await runIngestion({ sources: [input], githubToken: 'test-token', now: () => NOW, responses })
    expect(graph.items[0]).toMatchObject({ externalId: 'v1', title: 'Version one', url: release.url })
    expect(graph.citations.some(c => c.kind === 'outbound')).toBe(true)
    responses[1] = json('https://api.github.com/graphql', { data: { repository: { releases: { nodes: [{ ...release, name: 'Updated' }] } } } })
    await runIngestion({ sources: [input], githubToken: 'test-token', now: () => NOW, responses, initialGraph: graph })
    expect(graph.items).toHaveLength(1)
    expect(graph.items[0]?.title).toBe('Updated')
  })

  it('does not treat GraphQL partial data with errors as a successful empty feed', async () => {
    const graph = await runIngestion({ sources: [source('github_graphql', 'https://github.com/owner/repo/releases')], githubToken: 'test-token', now: () => NOW, responses: [robots('https://api.github.com'), json('https://api.github.com/graphql', { errors: [{ message: 'denied' }], data: null })] })
    expect(graph.items).toEqual([])
    expect(graph.fetchLogs[0]?.outcome).toBe('http_error')
  })

  it('still gates API requests on robots policy', async () => {
    const graph = await runIngestion({ sources: [source('bluesky_feed', bskyUrl)], now: () => NOW, responses: [{ url: `${bsky}/robots.txt`, status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /' }] })
    expect(graph.items).toEqual([])
    expect(graph.fetchLogs[0]?.outcome).toBe('robots_denied')
  })
})
