import { expect, it } from 'vitest'
import { runIngestion } from './pipeline'

const at = new Date('2026-09-05T14:00:00Z')

async function ingest(endpointUrl: string, host: string, body: string) {
  const source = {
    id: 'source',
    publisherId: 'publisher',
    transport: 'rss' as const,
    endpointUrl,
    isAggregator: false,
    disabledAt: null,
    disabledReason: null,
    consecutiveFailures: 0,
    retryAfterAt: null,
    lastPolledAt: null,
    newestItemAt: null,
    createdAt: at,
  }
  return runIngestion({
    sources: [source],
    publisherHosts: [{ host, publisherId: source.publisherId }],
    now: () => at,
    responses: [
      { url: `${new URL(endpointUrl).origin}/robots.txt`, status: 404 },
      { url: endpointUrl, status: 200, headers: { 'content-type': 'application/rss+xml' }, body: `<rss version="2.0"><channel>${body}</channel></rss>` },
    ],
  })
}

it('retains a Console review as an unaddressed Item citing the reviewed project', async () => {
  const graph = await ingest('https://console.dev/rss.xml', 'console.dev', `
    <item><title>Tool: llgo</title><link>https://github.com/xgo-dev/llgo?ref=console.dev</link>
    <description>Go compiler based on LLVM. What we like: native targets.</description></item>`)
  expect(graph.items).toHaveLength(1)
  expect(graph.items[0]).toMatchObject({ url: null, externalId: 'https://github.com/xgo-dev/llgo' })
  expect(graph.citations).toHaveLength(1)
  expect(graph.citations[0]).toMatchObject({ kind: 'outbound', anchorText: 'Tool: llgo' })
  expect(graph.links[0]?.url).toBe('https://github.com/xgo-dev/llgo')
  expect(graph.signals[0]).toMatchObject({ strength: 1, originPublisherId: null })
})

it('uses a publisher-owned RSS permalink instead of its tracking link', async () => {
  const graph = await ingest('https://css-weekly.com/feed/', 'css-weekly.com', `
    <item><title>Issue 631</title><link>https://feedpress.me/link/24028/17255561/issue-631</link>
    <guid isPermaLink="true">https://css-weekly.com/issue-631/</guid></item>`)
  expect(graph.items[0]?.url).toBe('https://css-weekly.com/issue-631')
  expect(graph.links.map(link => link.url)).toEqual(['https://css-weekly.com/issue-631'])
  expect(graph.citations[0]?.kind).toBe('self')
  expect(graph.signals[0]).toMatchObject({ strength: 0, originPublisherId: 'publisher' })
})

it('does not count the guest author as an independent voice on the curated guest article', async () => {
  const graph = await ingest('https://www.joshwcomeau.com/rss.xml', 'joshwcomeau.com', `
    <item><title>You Don’t Need a UI Framework</title>
    <link>https://www.smashingmagazine.com/2022/05/you-dont-need-ui-framework/</link></item>`)
  expect(graph.signals[0]).toMatchObject({ strength: 0, originPublisherId: 'publisher' })
})

it('does not turn an opaque GUID into a publisher-owned address', async () => {
  const graph = await ingest('https://css-weekly.com/feed/', 'css-weekly.com', `
    <item><title>Opaque identifier</title><link>https://other.example/article</link>
    <guid isPermaLink="false">https://css-weekly.com/not-a-permalink</guid></item>`)
  expect(graph.items[0]?.url).toBe('https://other.example/article')
})

it('keeps ordinary RSS links as publication addresses even when unregistered', async () => {
  const graph = await ingest('https://ordinary.example/rss.xml', 'ordinary.example', `
    <item><title>Unregistered publication</title><link>https://unknown.example/article</link></item>`)
  expect(graph.items[0]?.url).toBe('https://unknown.example/article')
  expect(graph.citations[0]?.kind).toBe('self')
})
