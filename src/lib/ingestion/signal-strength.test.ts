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

describe('signal and Strength', () => {
  it('creates one ordinary Signal eagerly for every Link', async () => {
    const graph = await runIngestion({
      sources: [source],
      publisherHosts: [{ host: 'publisher.example', publisherId: source.publisherId }],
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>publisher-item</guid>
            <title>Publisher Item</title>
            <link>https://publisher.example/items/one</link>
            <description><![CDATA[
              <a href="https://release.example/announcements/one">Release announcement</a>
            ]]></description>
          </item></channel></rss>`,
        },
      ],
      now: () => new Date(NOW),
    })

    expect(graph.signals).toHaveLength(graph.links.length)
    expect(new Set(graph.signals.map(signal => signal.targetLinkId))).toEqual(
      new Set(graph.links.map(link => link.id)),
    )
    expect(graph.signals).toEqual(expect.arrayContaining(
      graph.links.map(link => expect.objectContaining({
        id: link.id,
        targetLinkId: link.id,
        mergedIntoId: null,
      })),
    ))
  })

  it('counts distinct Publishers and excludes the Publisher that owns the target', async () => {
    const origin = source
    const firstVoter = {
      ...source,
      id: '00000000-0000-4000-8000-000000000102',
      publisherId: '00000000-0000-4000-8000-000000000002',
      endpointUrl: 'https://first-voter.example/feed.xml',
    }
    const secondVoter = {
      ...source,
      id: '00000000-0000-4000-8000-000000000103',
      publisherId: '00000000-0000-4000-8000-000000000003',
      endpointUrl: 'https://second-voter.example/feed.xml',
    }
    const targetUrl = 'https://publisher.example/items/one'
    const feed = (guid: string, itemUrl: string, outboundUrl?: string) => `<rss><channel><item>
      <guid>${guid}</guid>
      <title>Publisher Item</title>
      <link>${itemUrl}</link>
      ${outboundUrl === undefined ? '' : `<description><![CDATA[<a href="${outboundUrl}">Announcement</a>]]></description>`}
    </item></channel></rss>`

    const graph = await runIngestion({
      sources: [origin, firstVoter, secondVoter],
      publisherHosts: [
        { host: 'publisher.example', publisherId: origin.publisherId },
        { host: 'first-voter.example', publisherId: firstVoter.publisherId },
        { host: 'second-voter.example', publisherId: secondVoter.publisherId },
      ],
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: 'https://first-voter.example/robots.txt', status: 404 },
        { url: 'https://second-voter.example/robots.txt', status: 404 },
        { url: origin.endpointUrl, status: 200, body: feed('origin', targetUrl) },
        {
          url: firstVoter.endpointUrl,
          status: 200,
          body: feed('first-voter', 'https://first-voter.example/items/one', targetUrl),
        },
        {
          url: secondVoter.endpointUrl,
          status: 200,
          body: feed('second-voter', 'https://second-voter.example/items/one', targetUrl),
        },
      ],
      now: () => new Date(NOW),
    })

    const targetLink = graph.links.find(link => link.url === targetUrl)
    const targetSignal = graph.signals.find(signal => signal.targetLinkId === targetLink?.id)
    expect(targetSignal).toMatchObject({
      mergedIntoId: null,
      originPublisherId: origin.publisherId,
      strength: 2,
    })
  })

  it('counts several hosts asserted as one Publisher only once', async () => {
    const publisherId = '00000000-0000-4000-8000-000000000010'
    const hosts = ['javascript-weekly.example', 'react-status.example', 'frontend-focus.example']
    const sources = hosts.map((host, index) => ({
      ...source,
      id: `00000000-0000-4000-8000-00000000011${index}`,
      publisherId,
      endpointUrl: `https://${host}/feed.xml`,
    }))
    const targetUrl = 'https://independent.example/releases/one'
    const responses = hosts.flatMap((host, index) => [
      { url: `https://${host}/robots.txt`, status: 404 },
      {
        url: sources[index]!.endpointUrl,
        status: 200,
        body: `<rss><channel><item>
          <guid>item-${index}</guid>
          <title>Publisher Item</title>
          <link>https://${host}/items/${index}</link>
          <description><![CDATA[<a href="${targetUrl}">Independent release</a>]]></description>
        </item></channel></rss>`,
      },
    ])

    const graph = await runIngestion({
      sources,
      publisherHosts: hosts.map(host => ({ host, publisherId })),
      responses,
      now: () => new Date(NOW),
    })

    const targetLink = graph.links.find(link => link.url === targetUrl)
    expect(graph.signals.find(signal => signal.targetLinkId === targetLink?.id)).toMatchObject({
      originPublisherId: null,
      strength: 1,
    })
  })

  it('merges one cited release tag into its announcement and retains the alias tombstone', async () => {
    const origin = source
    const firstVoter = {
      ...source,
      id: '00000000-0000-4000-8000-000000000122',
      publisherId: '00000000-0000-4000-8000-000000000022',
      endpointUrl: 'https://first-voter.example/feed.xml',
    }
    const secondVoter = {
      ...source,
      id: '00000000-0000-4000-8000-000000000123',
      publisherId: '00000000-0000-4000-8000-000000000023',
      endpointUrl: 'https://second-voter.example/feed.xml',
    }
    const announcementUrl = 'https://publisher.example/items/widget-v1'
    const releaseTagUrl = 'https://github.com/acme/widget/releases/tag/v1.0.0'
    const feed = (guid: string, itemUrl: string, outboundUrl: string) => `<rss><channel><item>
      <guid>${guid}</guid>
      <title>Widget v1</title>
      <link>${itemUrl}</link>
      <description><![CDATA[<a href="${outboundUrl}">Widget v1</a>]]></description>
    </item></channel></rss>`

    const graph = await runIngestion({
      sources: [origin, firstVoter, secondVoter],
      publisherHosts: [
        { host: 'publisher.example', publisherId: origin.publisherId },
        { host: 'first-voter.example', publisherId: firstVoter.publisherId },
        { host: 'second-voter.example', publisherId: secondVoter.publisherId },
      ],
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        { url: 'https://first-voter.example/robots.txt', status: 404 },
        { url: 'https://second-voter.example/robots.txt', status: 404 },
        { url: origin.endpointUrl, status: 200, body: feed('origin', announcementUrl, releaseTagUrl) },
        {
          url: firstVoter.endpointUrl,
          status: 200,
          body: feed('first-voter', 'https://first-voter.example/items/widget-v1', announcementUrl),
        },
        {
          url: secondVoter.endpointUrl,
          status: 200,
          body: feed('second-voter', 'https://second-voter.example/items/widget-v1', announcementUrl),
        },
      ],
      now: () => new Date(NOW),
    })

    const announcementLink = graph.links.find(link => link.url === announcementUrl)!
    const releaseTagLink = graph.links.find(link => link.url === releaseTagUrl)!
    const announcementSignal = graph.signals.find(signal => signal.targetLinkId === announcementLink.id)!
    const releaseTagSignal = graph.signals.find(signal => signal.targetLinkId === releaseTagLink.id)!

    expect(graph.signals).toHaveLength(graph.links.length)
    expect(announcementSignal).toMatchObject({
      mergedIntoId: null,
      originPublisherId: origin.publisherId,
      strength: 2,
    })
    expect(releaseTagSignal).toMatchObject({
      mergedIntoId: announcementSignal.id,
      originPublisherId: null,
      strength: 0,
    })
  })

  it('merges an alias first observed months after its target', async () => {
    const announcementUrl = 'https://publisher.example/items/long-running'
    const releaseTagUrl = 'https://github.com/acme/widget/releases/tag/v2.0.0'
    const first = await runIngestion({
      sources: [source],
      publisherHosts: [{ host: 'publisher.example', publisherId: source.publisherId }],
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>long-running</guid>
            <title>Long-running announcement</title>
            <link>${announcementUrl}</link>
          </item></channel></rss>`,
        },
      ],
      now: () => new Date('2026-01-01T08:00:00.000Z'),
    })

    const second = await runIngestion({
      sources: [source],
      initialGraph: first,
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>long-running</guid>
            <title>Long-running announcement</title>
            <link>${announcementUrl}</link>
            <description><![CDATA[<a href="${releaseTagUrl}">Release tag</a>]]></description>
          </item></channel></rss>`,
        },
      ],
      now: () => new Date('2026-08-29T08:00:00.000Z'),
    })

    const announcementLink = second.links.find(link => link.url === announcementUrl)!
    const releaseTagLink = second.links.find(link => link.url === releaseTagUrl)!
    const announcementSignal = second.signals.find(signal => signal.targetLinkId === announcementLink.id)!
    const releaseTagSignal = second.signals.find(signal => signal.targetLinkId === releaseTagLink.id)!
    expect(second.signals).toHaveLength(second.links.length)
    expect(announcementSignal.mergedIntoId).toBeNull()
    expect(releaseTagSignal.mergedIntoId).toBe(announcementSignal.id)
  })

  it('selects the same alias target regardless of Source order and completion order', async () => {
    const firstSource = {
      ...source,
      id: '00000000-0000-4000-8000-000000000131',
      publisherId: '00000000-0000-4000-8000-000000000031',
      endpointUrl: 'https://a-publisher.example/feed.xml',
    }
    const secondSource = {
      ...source,
      id: '00000000-0000-4000-8000-000000000132',
      publisherId: '00000000-0000-4000-8000-000000000032',
      endpointUrl: 'https://b-publisher.example/feed.xml',
    }
    const releaseTagUrl = 'https://github.com/acme/widget/releases/tag/v3.0.0'
    const firstAnnouncementUrl = 'https://a-publisher.example/items/widget-v3'
    const secondAnnouncementUrl = 'https://b-publisher.example/items/widget-v3'

    async function ingestInOrder(
      sources: [typeof firstSource, typeof secondSource],
      firstDelayMs: number,
      secondDelayMs: number,
    ) {
      return runIngestion({
        sources,
        publisherHosts: [
          { host: 'a-publisher.example', publisherId: firstSource.publisherId },
          { host: 'b-publisher.example', publisherId: secondSource.publisherId },
        ],
        responses: [
          { url: 'https://a-publisher.example/robots.txt', status: 404 },
          { url: 'https://b-publisher.example/robots.txt', status: 404 },
          {
            url: firstSource.endpointUrl,
            status: 200,
            delayMs: firstDelayMs,
            body: `<rss><channel><item>
              <guid>first-announcement</guid>
              <title>Widget v3</title>
              <link>${firstAnnouncementUrl}</link>
              <description><![CDATA[<a href="${releaseTagUrl}">Release tag</a>]]></description>
            </item></channel></rss>`,
          },
          {
            url: secondSource.endpointUrl,
            status: 200,
            delayMs: secondDelayMs,
            body: `<rss><channel><item>
              <guid>second-announcement</guid>
              <title>Widget v3</title>
              <link>${secondAnnouncementUrl}</link>
              <description><![CDATA[<a href="${releaseTagUrl}">Release tag</a>]]></description>
            </item></channel></rss>`,
          },
        ],
        now: () => new Date(NOW),
      })
    }

    const first = await ingestInOrder([secondSource, firstSource], 20, 0)
    const second = await ingestInOrder([firstSource, secondSource], 0, 20)
    const liveTargetUrl = (graph: Awaited<ReturnType<typeof runIngestion>>) => {
      const liveSignal = graph.signals.find(signal => signal.mergedIntoId === null)!
      return graph.links.find(link => link.id === liveSignal.targetLinkId)!.url
    }

    expect(liveTargetUrl(first)).toBe(firstAnnouncementUrl)
    expect(liveTargetUrl(second)).toBe(firstAnnouncementUrl)
  })

  it('does not merge an announcement that cites several release tags', async () => {
    const announcementUrl = 'https://publisher.example/items/release-roundup'
    const firstTagUrl = 'https://github.com/acme/first/releases/tag/v1.0.0'
    const secondTagUrl = 'https://github.com/acme/second/releases/tag/v2.0.0'
    const graph = await runIngestion({
      sources: [source],
      publisherHosts: [{ host: 'publisher.example', publisherId: source.publisherId }],
      responses: [
        { url: 'https://publisher.example/robots.txt', status: 404 },
        {
          url: source.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>release-roundup</guid>
            <title>Release roundup</title>
            <link>${announcementUrl}</link>
            <description><![CDATA[
              <a href="${firstTagUrl}">First release</a>
              <a href="${secondTagUrl}">Second release</a>
            ]]></description>
          </item></channel></rss>`,
        },
      ],
      now: () => new Date(NOW),
    })

    expect(graph.signals).toHaveLength(3)
    expect(graph.signals.every(signal => signal.mergedIntoId === null)).toBe(true)
  })
})
