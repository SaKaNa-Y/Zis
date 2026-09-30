import type { PersistedGraph } from './pipeline'
import { expect, it } from 'vitest'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runIngestion } from './pipeline'

it('resolves provenance once per graph instead of rescanning every Citation for every Signal', async () => {
  const at = new Date('2026-09-30T00:00:00Z')
  const graph: PersistedGraph = await runIngestion({ sources: [], responses: [], now: () => at })
  const size = 5000
  let citationLinkReads = 0
  graph.sources.push({ id: 'source', publisherId: 'publisher', transport: 'rss', endpointUrl: 'https://publisher.example/feed', isAggregator: false, disabledAt: null, disabledReason: null, consecutiveFailures: 0, retryAfterAt: null, lastPolledAt: null, newestItemAt: null, createdAt: at })
  for (let index = 0; index < size; index++) {
    const id = `item-${index}`
    graph.links.push({ id, url: `https://example.org/story-${index}`, firstSeenAt: at, createdAt: at })
    graph.items.push({ id, sourceId: 'source', externalId: id, url: null, title: `Story ${index}`, summary: null, text: null, rawFeedDate: null, publishedAt: at, fetchedAt: at, issueHydratedAt: null, createdAt: at, updatedAt: at, ingestionInputHash: null })
    graph.citations.push({ id, itemId: id, sourceId: 'source', get linkId() {
      citationLinkReads++
      return id
    }, kind: 'outbound', rawUrl: `https://example.org/story-${index}`, anchorText: `Story ${index}`, firstSeenAt: at, createdAt: at })
  }
  await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => at,
    embeddingProvider: {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      version: EMBEDDING_VERSION,
      embed: async texts => texts.map(() => {
        const vector = new Float32Array(EMBEDDING_DIMENSIONS)
        vector[0] = 1
        return vector
      }),
    },
  })
  expect(graph.signals).toHaveLength(size)
  expect(graph.signals.every(signal => signal.strength === 1 && signal.textBasis === 'citing')).toBe(true)
  // A work bound is deterministic across machines, unlike a wall-clock limit.
  expect(citationLinkReads).toBeLessThan(size * 10)

  let signalLinkReads = 0
  for (const signal of graph.signals) {
    const linkId = signal.targetLinkId
    Object.defineProperty(signal, 'targetLinkId', {
      get() {
        signalLinkReads++
        return linkId
      },
    })
  }
  await runIngestion({ sources: [], responses: [], initialGraph: graph, now: () => at })
  expect(graph.signals).toHaveLength(size)
  expect(signalLinkReads).toBeLessThan(size * 10)
}, 30_000)
