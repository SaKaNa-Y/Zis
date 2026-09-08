import type { PersistedGraph } from './pipeline'
import { expect, it, vi } from 'vitest'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runIngestion } from './pipeline'

const firstAt = new Date('2026-09-08T00:00:00Z')
const nextAt = new Date('2026-09-08T01:00:00Z')

function vector(axis: number): Float32Array {
  const result = new Float32Array(EMBEDDING_DIMENSIONS)
  result[axis] = 1
  return result
}

const provider = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  version: EMBEDDING_VERSION,
  embed: async (texts: readonly string[]) => texts.map(text => vector(text === 'Databases' ? 1 : 0)),
}

async function initial(): Promise<PersistedGraph> {
  const graph = await runIngestion({ sources: [], responses: [], now: () => firstAt })
  graph.users = ['reader-a', 'reader-b'].map(id => ({ id, timezone: 'UTC', cutHour: 23, createdAt: firstAt }))
  graph.interests = graph.users.flatMap(user => ['Software', 'Databases'].map(statement => ({
    id: `${user.id}-${statement}`,
    userId: user.id,
    statement,
    embedding: null,
    embeddingInputHash: null,
    embeddingModel: null,
    embeddingDimensions: null,
    embeddingVersion: null,
    embeddedAt: null,
    createdAt: firstAt,
    updatedAt: firstAt,
  })))
  graph.links.push({ id: 'signal', url: 'https://example.com/software', firstSeenAt: firstAt, createdAt: firstAt })
  await runIngestion({ sources: [], responses: [], initialGraph: graph, embeddingProvider: provider, now: () => new Date(firstAt.getTime() - 1000) })
  graph.readerMatchProfiles = undefined
  return runIngestion({ sources: [], responses: [], initialGraph: graph, embeddingProvider: provider, now: () => firstAt })
}

it('reuses unchanged reader matches across wakes without calling the model', async () => {
  const graph = await initial()
  const originalMatches = structuredClone(graph.readerSignalMatches)
  const embed = vi.fn(provider.embed)
  const result = await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: { ...provider, embed },
  })
  expect(result.readerSignalMatches).toEqual(originalMatches)
  expect(embed).not.toHaveBeenCalled()
})

it('keeps reusable vectors in storage and loads only a Signal missing a reader match', async () => {
  const graph = await initial()
  const original = structuredClone(graph.readerSignalMatches)
  const storedVector = graph.signals[0]!.embedding
  if (!Array.isArray(storedVector))
    throw new Error('The first wake must produce a vector')
  graph.signals[0]!.embedding = { stored: true }
  const loadSignalEmbeddings = vi.fn(async (ids: readonly string[]) =>
    new Map(ids.map(id => [id, storedVector])))
  await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).not.toHaveBeenCalled()
  expect(graph.readerSignalMatches).toEqual(original)

  graph.readerSignalMatches = graph.readerSignalMatches.filter(match => match.userId !== 'reader-b')
  const result = await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).toHaveBeenCalledExactlyOnceWith(['signal'])
  expect(result.readerSignalMatches).toEqual([
    original[0],
    { ...original[1], matchedAt: nextAt },
  ])
})

it.each(['delete-winner', 'delete-runner-up', 'edit', 'add'] as const)('invalidates only the edited reader after %s', async (change) => {
  const graph = await initial()
  const original = structuredClone(graph.readerSignalMatches)
  const storedVector = graph.signals[0]!.embedding
  if (!Array.isArray(storedVector))
    throw new Error('The first wake must produce a vector')
  graph.signals[0]!.embedding = { stored: true }
  const software = graph.interests.find(interest => interest.id === 'reader-a-Software')!
  if (change === 'delete-winner')
    graph.interests = graph.interests.filter(interest => interest.id !== software.id)
  else if (change === 'delete-runner-up')
    graph.interests = graph.interests.filter(interest => interest.id !== 'reader-a-Databases')
  else if (change === 'edit')
    software.statement = 'Databases'
  else
    graph.interests.push({ ...software, id: 'reader-a-New', statement: 'New software' })
  const loadSignalEmbeddings = vi.fn(async (ids: readonly string[]) => new Map(ids.map(id => [id, storedVector])))
  const result = await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).toHaveBeenCalledExactlyOnceWith(['signal'])
  expect(result.readerSignalMatches.find(match => match.userId === 'reader-b')).toEqual(original[1])
  const changed = result.readerSignalMatches.find(match => match.userId === 'reader-a')!
  expect(changed.matchedAt).toEqual(nextAt)
  if (change === 'delete-winner')
    expect(changed).toMatchObject({ matchedInterestId: 'reader-a-Databases', relevance: 0, gap: null })
  if (change === 'delete-runner-up')
    expect(changed).toMatchObject({ matchedInterestId: software.id, relevance: 1, gap: null })
  if (change === 'edit')
    expect(changed).toMatchObject({ relevance: 0, gap: 0 })
  if (change === 'add')
    expect(changed).toMatchObject({ relevance: 1, gap: 0 })
})

it('does not publish a new matching checkpoint when deferred vectors cannot be loaded', async () => {
  const graph = await initial()
  const profiles = structuredClone(graph.readerMatchProfiles)
  const matches = structuredClone(graph.readerSignalMatches)
  graph.signals[0]!.embedding = { stored: true }
  graph.interests[0]!.statement = 'Changed statement'
  await expect(runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings: async () => new Map(),
  })).rejects.toThrow('embedding dimensions')
  expect(graph.readerMatchProfiles).toEqual(profiles)
  expect(graph.readerSignalMatches).toEqual(matches)
})

it('matches a new Signal without downloading vectors for unchanged Signals', async () => {
  const graph = await initial()
  const previous = structuredClone(graph.readerSignalMatches)
  graph.signals[0]!.embedding = { stored: true }
  graph.links.push({ id: 'new-signal', url: 'https://example.com/new-software', firstSeenAt: nextAt, createdAt: nextAt })
  const loadSignalEmbeddings = vi.fn(async () => new Map<string, number[]>())
  await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).not.toHaveBeenCalled()
  expect(graph.readerSignalMatches.filter(match => match.signalId === 'signal')).toEqual(previous)
  expect(graph.readerSignalMatches.filter(match => match.signalId === 'new-signal')).toHaveLength(2)
})

it('rematches after the halfvec round trip before reusing a newly embedded Signal', async () => {
  const graph = await initial()
  const signal = graph.signals[0]!
  signal.embeddedAt = firstAt
  signal.embedding = { stored: true }
  for (const match of graph.readerSignalMatches) {
    match.relevance = 0.8
    match.gap = 0.2
  }
  const rounded = Array.from<number>({ length: EMBEDDING_DIMENSIONS }).fill(0)
  rounded[0] = 0.7998046875
  rounded[1] = 0.60009765625
  const loadSignalEmbeddings = vi.fn(async () => new Map([['signal', rounded]]))
  await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).toHaveBeenCalledExactlyOnceWith(['signal'])
  expect(graph.readerSignalMatches[0]!.relevance).toBeLessThan(0.8)
  expect(graph.readerSignalMatches[0]!.relevance).toBeGreaterThan(0.79)
  const matched = structuredClone(graph.readerSignalMatches)
  await runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => new Date(nextAt.getTime() + 1000),
    embeddingProvider: provider,
    loadSignalEmbeddings,
  })
  expect(loadSignalEmbeddings).toHaveBeenCalledTimes(1)
  expect(graph.readerSignalMatches).toEqual(matched)
})

it('still rejects a deferred vector from a different embedding model', async () => {
  const graph = await initial()
  graph.signals[0]!.embedding = { stored: true }
  graph.signals[0]!.embeddingVersion = 'different-version'
  await expect(runIngestion({
    sources: [],
    responses: [],
    initialGraph: graph,
    now: () => nextAt,
    embeddingProvider: provider,
  })).rejects.toThrow('explicit full re-embed')
})
