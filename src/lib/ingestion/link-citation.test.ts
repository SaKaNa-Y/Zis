import { describe, expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const NOW = new Date('2026-08-29T08:00:00.000Z')

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

const CANON_CASES: ReadonlyArray<readonly [input: string, expected: string | null]> = [
  [
    'https://react.dev/blog/2026/01/01/react-19?utm_source=tldr&utm_medium=email',
    'https://react.dev/blog/2026/01/01/react-19',
  ],
  ['http://WWW.React.dev/blog/foo/', 'https://react.dev/blog/foo'],
  ['https://react.dev:443/blog/foo', 'https://react.dev/blog/foo'],
  ['https://example.com/post#section-3', 'https://example.com/post'],
  ['https://example.com/post#!/route', 'https://example.com/post#!/route'],
  ['https://example.com/a//b///c', 'https://example.com/a/b/c'],
  ['https://example.com/docs/index.html', 'https://example.com/docs'],
  ['https://lobste.rs/?page=2', 'https://lobste.rs/'],
  ['https://example.com/blog?page=2', 'https://example.com/blog?page=2'],
  ['https://example.com/blog?sort=new', 'https://example.com/blog?sort=new'],
  ['https://example.com/p?b=2&a=1', 'https://example.com/p?a=1&b=2'],
  ['https://amp.theguardian.com/tech/story', 'https://theguardian.com/tech/story'],
  ['https://example.com/story/amp/', 'https://example.com/story'],
  ['https://example.com/story?amp=1', 'https://example.com/story'],
  ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://youtube.com/watch?v=dQw4w9WgXcQ'],
  [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&pp=xx&si=abc',
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
  ],
  ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://www.youtube.com/playlist?list=PL123&si=abc', 'https://youtube.com/playlist?list=PL123'],
  ['https://github.com/Facebook/React.git', 'https://github.com/facebook/react'],
  ['https://github.com/facebook/react/tree/main', 'https://github.com/facebook/react'],
  ['https://github.com/facebook/react/releases/latest', 'https://github.com/facebook/react/releases'],
  [
    'https://github.com/facebook/react/releases/tag/v19.0.0',
    'https://github.com/facebook/react/releases/tag/v19.0.0',
  ],
  [
    'https://news.ycombinator.com/item?id=12345678&p=2',
    'https://news.ycombinator.com/item?id=12345678',
  ],
  ['mailto:someone@example.com', null],
  ['javascript:void(0)', null],
  ['/relative/path', null],
  ['https://localhost/admin', null],
  ['https://192.168.1.1/', null],
]

const EXTRA_CANON_CASES: ReadonlyArray<readonly [input: string, expected: string]> = [
  ['https://name:secret@WWW2.Example.COM./a/index.htm', 'https://example.com/a'],
  ['https://www.m.example.com/path', 'https://example.com/path'],
  ['https://m.example.com/a/index.php', 'https://example.com/a'],
  ['https://mobile.example.com/path/', 'https://example.com/path'],
  ['https://example.com:8443/path/', 'https://example.com:8443/path'],
  ['https://example.com/amp/story/', 'https://example.com/story'],
  ['https://example.com/amp/amp/story/amp/amp/', 'https://example.com/story'],
  ['https://example.com/index.html/index.php', 'https://example.com/'],
  ['https://example.com/story?amp=0&output=amp', 'https://example.com/story?amp=0&output=amp'],
  ['https://example.com/unicode?%C3%A9=1&e%CC%81=2', 'https://example.com/unicode?e%CC%81=2&%C3%A9=1'],
  ['https://example.com/unicode?e%CC%81=2&%C3%A9=1', 'https://example.com/unicode?e%CC%81=2&%C3%A9=1'],
  ['https://www.youtube.com/embed/video-id', 'https://youtube.com/watch?v=video-id'],
  ['https://youtu.be/video-id#!/route', 'https://youtube.com/watch?v=video-id#!/route'],
  ['https://www.youtube.com/live/video-id', 'https://youtube.com/watch?v=video-id'],
  ['https://www.youtube.com/v/video-id', 'https://youtube.com/watch?v=video-id'],
  [
    'https://example.com/search?version=2&tab=all&sort=new&q=zis&p=2&offset=10&lang=en&cursor=c&page=3&opaque=kept&utm_source=feed',
    'https://example.com/search?cursor=c&lang=en&offset=10&opaque=kept&p=2&page=3&q=zis&sort=new&tab=all&version=2',
  ],
  [
    'https://www.bilibili.com/video/av170001?spm_id_from=333.999&p=2',
    'https://bilibili.com/video/BV17x411w7KC',
  ],
  [
    'https://m.bilibili.com/video/BV17x411w7KC/?foo=bar',
    'https://bilibili.com/video/BV17x411w7KC',
  ],
  [
    'https://www.bilibili.com/video/av111298867365120?spm_id_from=x',
    'https://bilibili.com/video/BV1L9Uoa9EUx',
  ],
  [
    'https://bilibili.com/video/BV1FFFFFFFFF?spm_id_from=x',
    'https://bilibili.com/video/BV1FFFFFFFFF',
  ],
  ['https://bilibili.com/video/av0?spm_id_from=x', 'https://bilibili.com/video/av0'],
  [
    'https://bilibili.com/video/av2251799813685248?spm_id_from=x',
    'https://bilibili.com/video/av2251799813685248',
  ],
  [
    'https://bilibili.com/video/BV1xx411c70D?spm_id_from=x',
    'https://bilibili.com/video/BV1xx411c70D',
  ],
  ['https://github.com/Owner/Repo.git.git', 'https://github.com/owner/repo'],
  ['https://github.com/Owner/.git', 'https://github.com/owner/.git'],
]

const EXTRA_REJECTED_CANON_CASES = [
  'https://www.192.168.1.1/private',
  'https://youtube.com/watch?list=PL_WITHOUT_VIDEO',
  'https://youtube.com/playlist?v=VIDEO_WITHOUT_LIST',
] as const

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function feedWithSelfLinks(urls: readonly string[]): string {
  const items = urls.map((url, index) => `
    <item>
      <guid>canonical-case-${index}</guid>
      <title>Canonical case ${index}</title>
      <link>${escapeXml(url)}</link>
    </item>`).join('')
  return `<rss version="2.0"><channel>${items}</channel></rss>`
}

describe('the Link and Citation graph through the ingestion seam', () => {
  it('ports all 28 executable canonicalization cases from the clustering prototype', async () => {
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: feedWithSelfLinks(CANON_CASES.map(([input]) => input)),
        },
      ],
    })

    const selfCitationByRawUrl = new Map(
      graph.citations
        .filter(citation => citation.kind === 'self')
        .map(citation => [citation.rawUrl, citation]),
    )
    const linkById = new Map(graph.links.map(link => [link.id, link]))

    for (const [input, expected] of CANON_CASES) {
      const citation = selfCitationByRawUrl.get(input)
      if (expected === null) {
        expect(citation, input).toBeUndefined()
        continue
      }
      expect(citation, input).toBeDefined()
      expect(linkById.get(citation!.linkId)?.url, input).toBe(expected)
    }
  })

  it('covers the remaining L1-L3 forms and both path-shape failure directions', async () => {
    const playlistA = 'https://youtube.com/playlist?list=PL_A&v=wrong&si=noise'
    const playlistB = 'https://youtube.com/playlist?list=PL_B&v=wrong&si=noise'
    const videoInA = 'https://youtube.com/watch?v=VIDEO&list=PL_A'
    const videoInB = 'https://youtube.com/watch?v=VIDEO&list=PL_B'
    const urls = [
      ...EXTRA_CANON_CASES.map(([input]) => input),
      ...EXTRA_REJECTED_CANON_CASES,
      playlistA,
      playlistB,
      videoInA,
      videoInB,
    ]
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feedWithSelfLinks(urls) },
      ],
    })
    const citationByRawUrl = new Map(graph.citations.map(citation => [citation.rawUrl, citation]))
    const linkById = new Map(graph.links.map(link => [link.id, link]))
    const canonicalFor = (rawUrl: string): string | undefined => {
      const citation = citationByRawUrl.get(rawUrl)
      return citation === undefined ? undefined : linkById.get(citation.linkId)?.url
    }

    for (const [input, expected] of EXTRA_CANON_CASES)
      expect(canonicalFor(input), input).toBe(expected)
    for (const input of EXTRA_REJECTED_CANON_CASES)
      expect(canonicalFor(input), input).toBeUndefined()
    expect(canonicalFor(playlistA)).toBe('https://youtube.com/playlist?list=PL_A')
    expect(canonicalFor(playlistB)).toBe('https://youtube.com/playlist?list=PL_B')
    expect(canonicalFor(videoInA)).toBe('https://youtube.com/watch?v=VIDEO')
    expect(canonicalFor(videoInB)).toBe('https://youtube.com/watch?v=VIDEO')
  })

  it('keeps every accepted L1-L3 output byte-identical when canonicalized again', async () => {
    const canonicalUrls = [
      ...CANON_CASES.flatMap(([, expected]) => expected === null ? [] : [expected]),
      ...EXTRA_CANON_CASES.map(([, expected]) => expected),
    ]
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feedWithSelfLinks(canonicalUrls) },
      ],
    })
    const linkById = new Map(graph.links.map(link => [link.id, link]))
    const canonicalByRawUrl = new Map(
      graph.citations.map(citation => [citation.rawUrl, linkById.get(citation.linkId)?.url]),
    )

    for (const canonicalUrl of canonicalUrls)
      expect(canonicalByRawUrl.get(canonicalUrl), canonicalUrl).toBe(canonicalUrl)
  })

  it('uses the Atom alternate Link as self provenance without treating feed plumbing as outbound', async () => {
    const atomSource = { ...source, transport: 'atom' as const }
    const itemUrl = 'https://publisher.example/items/from-id'
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
              <id>${itemUrl}</id>
              <title>Atom metadata is not a Citation</title>
              <link rel="alternate" href="${itemUrl}" />
              <link rel="self" href="https://publisher.example/feed-entry" />
              <link rel="replies" href="https://comments.example/thread" />
              <link rel="enclosure" href="https://cdn.example/audio.mp3" />
              <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">
                <a href="/related-story">Related story</a>
              </div></content>
            </entry>
          </feed>`,
        },
      ],
    })

    expect(graph.items[0]?.url).toBe(itemUrl)
    expect(graph.citations.map(citation => [citation.kind, citation.rawUrl])).toEqual([
      ['self', itemUrl],
      ['outbound', '/related-story'],
    ])
    expect(graph.links.map(link => link.url)).toEqual([
      itemUrl,
      'https://publisher.example/related-story',
    ])
  })

  it('uses only an RSS permalink GUID as a fallback self address', async () => {
    const permalinkGuid = 'https://publisher.example/items/permalink-guid'
    const identifierGuid = 'https://publisher.example/identifiers/not-a-link'
    const graph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel>
            <item><guid>${permalinkGuid}</guid><title>Permalink GUID</title></item>
            <item><guid isPermaLink="false">${identifierGuid}</guid><title>Identifier GUID</title></item>
          </channel></rss>`,
        },
      ],
    })

    expect(graph.items.map(item => [item.externalId, item.url])).toEqual([
      [permalinkGuid, permalinkGuid],
      [identifierGuid, null],
    ])
    expect(graph.citations.map(citation => citation.rawUrl)).toEqual([permalinkGuid])
  })

  it('keeps citable outbound provenance while dropping references and internal navigation', async () => {
    const secondSource = {
      ...source,
      id: '00000000-0000-4000-8000-000000000102',
      publisherId: '00000000-0000-4000-8000-000000000002',
      endpointUrl: 'https://other.example/feed.xml',
    }
    const graph = await runIngestion({
      sources: [source, secondSource],
      publisherHosts: [
        { host: 'publisher.example', publisherId: source.publisherId },
        { host: 'other.example', publisherId: secondSource.publisherId },
      ],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>publisher-item</guid>
            <title>Publisher Item</title>
            <link>https://publisher.example/posts/item</link>
            <description><![CDATA[
              <p>
                <a href="https://developer.mozilla.org/en-US/docs/Web/API/Node">MDN reference</a>
                <a href="https://publisher.example/internal-navigation">Internal navigation</a>
                <a href="/relative-navigation">Relative internal navigation</a>
                <a href="https://arxiv.org/abs/2608.12345">Paper</a>
                <a href="https://github.com/example/project/releases/tag/v1.0.0">Release</a>
                <a href="https://story.example/launch?utm_source=feed">External story</a>
              </p>
            ]]></description>
          </item></channel></rss>`,
        },
        { url: 'https://other.example/robots.txt', status: 404 },
        {
          url: secondSource.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>other-item</guid>
            <title>Other Item</title>
            <link>https://other.example/posts/item</link>
            <description><![CDATA[
              <a href="https://publisher.example/internal-navigation">Someone else's story</a>
            ]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    const outbound = graph.citations.filter(citation => citation.kind === 'outbound')
    expect(outbound.map(citation => citation.rawUrl).sort()).toEqual([
      'https://arxiv.org/abs/2608.12345',
      'https://github.com/example/project/releases/tag/v1.0.0',
      'https://publisher.example/internal-navigation',
      'https://story.example/launch?utm_source=feed',
    ])
    expect(outbound.find(citation => citation.rawUrl === 'https://publisher.example/internal-navigation'))
      .toMatchObject({ sourceId: secondSource.id })

    const linkById = new Map(graph.links.map(link => [link.id, link]))
    const storyCitation = outbound.find(citation => citation.rawUrl === 'https://story.example/launch?utm_source=feed')
    expect(linkById.get(storyCitation!.linkId)?.url).toBe('https://story.example/launch')
    expect(graph.items.some(item => item.url === 'https://story.example/launch')).toBe(false)
  })

  it('leaves no Citation for downstream Strength when three Publishers cite documentation', async () => {
    const sources = Array.from({ length: 3 }, (_, index) => ({
      ...source,
      id: `00000000-0000-4000-8000-00000000020${index}`,
      publisherId: `00000000-0000-4000-8000-00000000001${index}`,
      endpointUrl: `https://publisher-${index}.example/feed.xml`,
    }))
    const referenceUrl = 'https://nodejs.org/api/packages.html'
    const responses = sources.flatMap((candidate, index) => [
      { url: `https://publisher-${index}.example/robots.txt`, status: 404 },
      {
        url: candidate.endpointUrl,
        status: 200,
        body: `<rss><channel><item>
          <guid>reference-${index}</guid>
          <title>Reference ${index}</title>
          <link>https://publisher-${index}.example/items/${index}</link>
          <description><![CDATA[<a href="${referenceUrl}">Node.js packages API</a>]]></description>
        </item></channel></rss>`,
      },
    ])

    const graph = await runIngestion({ sources, responses, now: () => NOW })

    expect(graph.items).toHaveLength(3)
    expect(graph.citations.some(citation => citation.rawUrl === referenceUrl)).toBe(false)
    expect(graph.links.some(link => link.url === referenceUrl)).toBe(false)
  })

  it('preserves raw Citation provenance and first-seen time across reruns and edits', async () => {
    const firstRawUrl = 'https://story.example/post?utm_source=first'
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>stable-item</guid>
            <title>Original Item</title>
            <link>https://publisher.example/items/stable</link>
            <description><![CDATA[<a href="${firstRawUrl}">Story</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })
    const originalItemId = first.items[0]!.id
    const originalCitation = first.citations.find(citation => citation.rawUrl === firstRawUrl)!
    const originalLinkId = originalCitation.linkId
    const originalCitationId = originalCitation.id
    const later = new Date('2026-08-29T09:00:00.000Z')
    const secondRawUrl = 'http://www.story.example/post?utm_source=second'

    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => later,
      responses: [{
        url: source.endpointUrl,
        status: 200,
        body: `<rss><channel><item>
          <guid>stable-item</guid>
          <title>Edited Item</title>
          <link>https://publisher.example/items/stable</link>
          <description><![CDATA[
            <a href="${firstRawUrl}">Story</a>
            <a href="${secondRawUrl}">Same story, another raw address</a>
          ]]></description>
        </item></channel></rss>`,
      }],
    })

    const storyCitations = second.citations.filter(citation => citation.rawUrl.includes('story.example/post'))
    expect(storyCitations).toHaveLength(2)
    expect(storyCitations.map(citation => citation.linkId)).toEqual([originalLinkId, originalLinkId])
    expect(storyCitations.find(citation => citation.rawUrl === firstRawUrl)).toMatchObject({
      id: originalCitationId,
      itemId: originalItemId,
      sourceId: source.id,
      kind: 'outbound',
      firstSeenAt: NOW,
    })
    expect(storyCitations.find(citation => citation.rawUrl === secondRawUrl)).toMatchObject({
      itemId: originalItemId,
      sourceId: source.id,
      kind: 'outbound',
      firstSeenAt: later,
    })
    expect(second.links.find(link => link.id === originalLinkId)).toMatchObject({
      url: 'https://story.example/post',
      firstSeenAt: NOW,
    })
  })

  it('does not invent raw self provenance for an existing Item after it leaves the feed', async () => {
    const itemUrl = 'https://publisher.example/archive/item?utm_source=legacy'
    const legacyGraph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>legacy-item</guid>
            <title>Legacy Item</title>
            <link>${itemUrl}</link>
          </item></channel></rss>`,
        },
      ],
    })
    legacyGraph.links = []
    legacyGraph.signals = []
    legacyGraph.citations = []
    legacyGraph.items[0]!.fetchedAt = new Date('2026-08-29T08:30:00.000Z')

    const graph = await runIngestion({
      sources: [source],
      initialGraph: legacyGraph,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      responses: [{ url: source.endpointUrl, status: 200, body: '<rss><channel /></rss>' }],
    })

    expect(graph.items).toHaveLength(1)
    expect(graph.links).toEqual([])
    expect(graph.citations).toEqual([])
  })

  it('does not invent canonical raw provenance when a self Citation already exists', async () => {
    const rawUrl = 'https://publisher.example/archive/current?utm_source=feed'
    const first = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>current-item</guid>
            <title>Current Item</title>
            <link>${rawUrl}</link>
          </item></channel></rss>`,
        },
      ],
    })

    const graph = await runIngestion({
      sources: [source],
      initialGraph: first,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      responses: [{ url: source.endpointUrl, status: 200, body: '<rss><channel /></rss>' }],
    })

    expect(graph.citations.filter(citation => citation.kind === 'self').map(citation => citation.rawUrl))
      .toEqual([rawUrl])
  })

  it('records only the observed raw self address when a legacy Item reappears', async () => {
    const rawUrl = 'https://publisher.example/archive/reappeared?utm_source=feed'
    const legacyGraph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>reappeared-item</guid>
            <title>Reappeared Item</title>
            <link>${rawUrl}</link>
          </item></channel></rss>`,
        },
      ],
    })
    legacyGraph.links = []
    legacyGraph.citations = []

    const graph = await runIngestion({
      sources: [source],
      initialGraph: legacyGraph,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      responses: [{
        url: source.endpointUrl,
        status: 200,
        body: `<rss><channel><item>
          <guid>reappeared-item</guid>
          <title>Reappeared Item</title>
          <link>${rawUrl}</link>
        </item></channel></rss>`,
      }],
    })

    expect(graph.citations.filter(citation => citation.kind === 'self').map(citation => citation.rawUrl))
      .toEqual([rawUrl])
  })

  it('reuses a legacy URL-keyed Item when migration refetches a feed without GUIDs', async () => {
    const legacyUrl = 'http://www.publisher.example/archive/no-guid/'
    const rawUrl = `${legacyUrl}?utm_source=feed`
    const feed = `<rss><channel><item>
      <title>Legacy URL-keyed Item</title>
      <link>${rawUrl}</link>
    </item></channel></rss>`
    const legacyGraph = await runIngestion({
      sources: [source],
      now: () => NOW,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: source.endpointUrl, status: 200, body: feed },
      ],
    })
    const legacyItem = legacyGraph.items[0]!
    const legacyItemId = legacyItem.id
    legacyItem.externalId = legacyUrl
    legacyItem.url = legacyUrl
    legacyGraph.links = []
    legacyGraph.citations = []
    legacyGraph.httpCache = []

    const graph = await runIngestion({
      sources: [source],
      initialGraph: legacyGraph,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      responses: [{ url: source.endpointUrl, status: 200, body: feed }],
    })

    expect(graph.items).toHaveLength(1)
    expect(graph.items[0]).toMatchObject({
      id: legacyItemId,
      externalId: legacyUrl,
      url: 'https://publisher.example/archive/no-guid',
    })
    expect(graph.citations).toEqual([expect.objectContaining({
      itemId: legacyItemId,
      rawUrl,
      kind: 'self',
    })])

    const replayed = await runIngestion({
      sources: [source],
      initialGraph: graph,
      now: () => new Date('2026-08-29T10:00:00.000Z'),
      responses: [{ url: source.endpointUrl, status: 200, body: feed }],
    })

    expect(replayed.items).toHaveLength(1)
    expect(replayed.items[0]?.id).toBe(legacyItemId)
    expect(replayed.citations).toHaveLength(1)
  })

  it('assigns stable Item and Link identities across independent ingestion runs', async () => {
    const sharedUrl = 'https://story.example/shared?utm_source=citation'
    async function ingestFrom(candidate: typeof source, itemUrl: string) {
      return runIngestion({
        sources: [candidate],
        now: () => NOW,
        responses: [
          { url: `https://${new URL(candidate.endpointUrl).host}/robots.txt`, status: 404 },
          {
            url: candidate.endpointUrl,
            status: 200,
            body: `<rss><channel><item>
              <guid>${candidate.id}</guid>
              <title>Independent Item</title>
              <link>${itemUrl}</link>
              <description><![CDATA[<a href="${sharedUrl}">Shared story</a>]]></description>
            </item></channel></rss>`,
          },
        ],
      })
    }

    const first = await ingestFrom(source, 'https://publisher.example/items/one')
    const repeated = await ingestFrom(source, 'https://publisher.example/items/one')
    const secondSource = {
      ...source,
      id: '00000000-0000-4000-8000-000000000199',
      publisherId: '00000000-0000-4000-8000-000000000099',
      endpointUrl: 'https://independent.example/feed.xml',
    }
    const second = await ingestFrom(secondSource, 'https://independent.example/items/two')

    expect(first.links.find(link => link.url === 'https://story.example/shared')?.id)
      .toBe(second.links.find(link => link.url === 'https://story.example/shared')?.id)
    expect(first.items[0]?.id).toBe(repeated.items[0]?.id)
    expect(first.citations.map(citation => citation.id).sort())
      .toEqual(repeated.citations.map(citation => citation.id).sort())
  })
})
