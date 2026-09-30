import type { CannedTransportResponse, IngestionSource } from './pipeline'
import { setImmediate } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { createSafeFetch } from '../safe-fetch'
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

  it('fetches a complete HN list with four bounded workers instead of serial network round trips', async () => {
    const input = source('hn_firebase', `${hn}/v0/topstories.json`)
    const ids = Array.from({ length: 12 }, (_, index) => index + 1)
    const graph = await runIngestion({ sources: [input], now: () => NOW, responses: [
      robots(hn),
      json(input.endpointUrl, ids),
      ...ids.map(id => ({
        ...json(`${hn}/v0/item/${id}.json`, { id, type: 'story', title: `Story ${id}`, time: 1 }),
        waitForActive: 4,
        delayMs: 5,
        failAboveHostActive: 4,
        failAboveActive: 6,
      })),
    ] })
    expect(graph.fetchLogs[0]).toMatchObject({ outcome: 'ok', itemsSeen: ids.length })
    expect(graph.items.map(item => item.externalId).sort()).toEqual(ids.map(String).sort())
  })

  it('does not commit a partial HN list if a child request fails and preserves Retry-After', async () => {
    const input = source('hn_firebase', `${hn}/v0/topstories.json`)
    const graph = await runIngestion({ sources: [input], now: () => NOW, responses: [robots(hn), json(input.endpointUrl, [1, 2]), json(`${hn}/v0/item/1.json`, { id: 1, type: 'story', title: 'Story', time: 1 }), { ...json(`${hn}/v0/item/2.json`, {}, 429), headers: { 'retry-after': '3600' } }] })
    expect(graph.items).toEqual([])
    expect(graph.fetchLogs[0]).toMatchObject({ outcome: 'http_error', httpStatus: 429 })
    expect(graph.sources[0]?.retryAfterAt?.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 3600000)
  })

  it('drains an HN failure batch, retries failed shared reads and refreshes successful reads next wake', async () => {
    const top = source('hn_firebase', `${hn}/v0/topstories.json`, 'hn-top')
    const latest = { ...source('hn_firebase', `${hn}/v0/newstories.json`, 'hn-new'), publisherId: top.publisherId }
    const failedBodyRead = Promise.withResolvers<void>()
    const releaseSiblings = Promise.withResolvers<void>()
    const calls = new Map<string, number>()
    const commits: { sourceId: string, active: number }[] = []
    let active = 0
    let maximumActive = 0
    let wake = 1
    const fetch = createSafeFetch({
      resolve: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async (request) => {
        const path = new URL(request.url).pathname
        calls.set(path, (calls.get(path) ?? 0) + 1)
        const itemId = Number(path.match(/^\/v0\/item\/(\d+)\.json$/)?.[1])
        const isItem = Number.isSafeInteger(itemId)
        const failed = itemId === 1 && calls.get(path) === 1
        if (isItem) {
          active++
          maximumActive = Math.max(maximumActive, active)
        }
        const value = path === '/v0/topstories.json'
          ? [1, 2, 3, 4, 5]
          : path === '/v0/newstories.json'
            ? [1]
            : { id: itemId, type: 'story', title: `Wake ${wake} story ${itemId}`, time: NOW.getTime() / 1000 }
        return {
          status: path === '/robots.txt' ? 404 : failed ? 429 : 200,
          headers: { 'content-type': 'application/json' },
          body: (async function* () {
            try {
              if (failed)
                await setImmediate()
              else if (isItem && wake === 1 && itemId !== 1)
                await releaseSiblings.promise
              yield new TextEncoder().encode(JSON.stringify(value))
            }
            finally {
              if (isItem)
                active--
              if (failed)
                failedBodyRead.resolve()
            }
          })(),
        }
      },
    })
    const running = runIngestion({
      sources: [top, latest],
      fetch,
      now: () => NOW,
      onSourceCommitted: async (input) => { commits.push({ sourceId: input.id, active }) },
    })
    await failedBodyRead.promise
    await setImmediate()
    const commitsBeforeDrain = [...commits]
    releaseSiblings.resolve()
    const graph = await running
    expect(commitsBeforeDrain).toEqual([])
    expect(maximumActive).toBe(4)
    expect(commits).toEqual([{ sourceId: top.id, active: 0 }, { sourceId: latest.id, active: 0 }])
    expect(calls.get('/v0/item/5.json')).toBeUndefined()
    expect(calls.get('/v0/item/1.json')).toBe(2)
    expect(graph.fetchLogs.map(log => log.outcome)).toEqual(['http_error', 'ok'])
    expect(graph.items).toEqual([expect.objectContaining({ sourceId: latest.id, title: 'Wake 1 story 1' })])

    wake = 2
    await runIngestion({ sources: [latest], initialGraph: graph, fetch, now: () => new Date(NOW.getTime() + 1000) })
    expect(calls.get('/v0/item/1.json')).toBe(3)
    expect(graph.items).toEqual([expect.objectContaining({ sourceId: latest.id, title: 'Wake 2 story 1' })])
    expect(graph.fetchLogs.at(-1)).toMatchObject({ outcome: 'ok', itemsNew: 0 })
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
    const responses = [robots('https://api.github.com'), { ...json('https://api.github.com/graphql', { data: { repository: { url: 'https://github.com/owner/repo', releases: { nodes: [release] } } } }), whenHeaders: { authorization: 'Bearer test-token' } }]
    const graph = await runIngestion({ sources: [input], githubToken: 'test-token', now: () => NOW, responses })
    expect(graph.items[0]).toMatchObject({ externalId: 'v1', title: 'Version one', url: release.url })
    expect(graph.citations.some(c => c.kind === 'outbound')).toBe(true)
    responses[1] = json('https://api.github.com/graphql', { data: { repository: { url: 'https://github.com/owner/repo', releases: { nodes: [{ ...release, name: 'Updated' }] } } } })
    await runIngestion({ sources: [input], githubToken: 'test-token', now: () => NOW, responses, initialGraph: graph })
    expect(graph.items).toHaveLength(1)
    expect(graph.items[0]?.title).toBe('Updated')
  })

  it('accepts a transferred repository but rejects unrelated release URLs', async () => {
    const input = source('github_graphql', 'https://github.com/old/repo/releases')
    const release = { tagName: 'v1', name: 'Release', url: 'https://github.com/new/repo/releases/tag/v1', description: '', publishedAt: NOW.toISOString(), isDraft: false }
    for (const unrelated of [false, true]) {
      const graph = await runIngestion({ sources: [{ ...input }], githubToken: 'test-token', now: () => NOW, responses: [robots('https://api.github.com'), json('https://api.github.com/graphql', { data: { repository: { url: 'https://github.com/new/repo', releases: { nodes: [{ ...release, url: unrelated ? 'https://github.com/other/repo/releases/tag/v1' : release.url }] } } } })] })
      expect(graph.fetchLogs[0]?.outcome).toBe(unrelated ? 'parse_error' : 'ok')
      expect(graph.items).toHaveLength(unrelated ? 0 : 1)
    }
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
