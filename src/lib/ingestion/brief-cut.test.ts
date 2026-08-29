import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/provider'
import { runIngestion } from './pipeline'

const WAKE_AT = new Date('2026-08-29T00:17:00.000Z')
const USER_ID = '00000000-0000-4000-8000-000000000001'

type BaseGraph = Awaited<ReturnType<typeof runIngestion>>

interface TestPublisher {
  id: string
  slug: string
  name: string
  createdAt: Date
}

interface TestUser {
  id: string
  timezone: string
  cutHour: number
  createdAt: Date
}

interface TestBrief {
  id: string
  userId: string
  localDate: string
  cutAt: Date
  createdAt: Date
}

interface TestBriefEntry {
  briefId: string
  userId: string
  signalId: string
  position: number
  admittedBy: 'interest' | 'convergence'
  whyText: string
  createdAt: Date
}

type TestGraph = Omit<BaseGraph, 'users'> & {
  publishers: TestPublisher[]
  users: TestUser[]
  readStates: Array<{ userId: string, signalId: string, readAt: Date }>
  briefs: TestBrief[]
  briefEntries: TestBriefEntry[]
}

interface SignalFixture {
  key: number
  host: string
  basis: 'own' | 'citing' | 'slug'
  relevance: number
  interestStatement: string
  contributorNames: string[]
}

function uuid(namespace: number, ordinal: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${ordinal.toString().padStart(12, '0')}`
}

function emptyCorpus(): TestGraph {
  return {
    sources: [],
    items: [],
    publisherHosts: [],
    links: [],
    signals: [],
    citations: [],
    publishers: [],
    users: [{
      id: USER_ID,
      timezone: 'Asia/Shanghai',
      cutHour: 6,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }],
    interests: [],
    readerSignalMatches: [],
    readStates: [],
    briefs: [],
    briefEntries: [],
    fetchLogs: [],
    httpCache: [],
    robotsCache: [],
    dormantSourceIds: [],
  }
}

function addSignal(graph: TestGraph, fixture: SignalFixture): string {
  const signalId = uuid(3, fixture.key)
  const originPublisherId = uuid(1, fixture.key * 100)
  const originSourceId = uuid(2, fixture.key * 100)
  const firstSeenAt = new Date(Date.UTC(2026, 7, 28, 0, fixture.key))
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0)
  const interestId = uuid(4, fixture.key)

  graph.publishers.push({
    id: originPublisherId,
    slug: `origin-${fixture.key}`,
    name: `Origin ${fixture.key}`,
    createdAt: firstSeenAt,
  })
  graph.publisherHosts.push({ host: fixture.host, publisherId: originPublisherId })
  graph.sources.push({
    id: originSourceId,
    publisherId: originPublisherId,
    transport: 'rss',
    endpointUrl: `https://${fixture.host}/feed.xml`,
    isAggregator: false,
    disabledAt: null,
    disabledReason: null,
    consecutiveFailures: 0,
    retryAfterAt: null,
    lastPolledAt: firstSeenAt,
    newestItemAt: firstSeenAt,
    createdAt: firstSeenAt,
  })
  graph.links.push({
    id: signalId,
    url: `https://${fixture.host}/stories/${fixture.key}`,
    firstSeenAt,
    createdAt: firstSeenAt,
  })
  graph.signals.push({
    id: signalId,
    targetLinkId: signalId,
    mergedIntoId: null,
    strength: 0,
    originPublisherId,
    textBasis: fixture.basis,
    embeddingText: `Signal ${fixture.key}`,
    embedding: vector,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embeddingVersion: EMBEDDING_VERSION,
    embeddedAt: firstSeenAt,
    createdAt: firstSeenAt,
  })
  graph.interests.push({
    id: interestId,
    userId: USER_ID,
    statement: fixture.interestStatement,
    embedding: vector,
    embeddingInputHash: `hash-${fixture.key}`,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embeddingVersion: EMBEDDING_VERSION,
    embeddedAt: firstSeenAt,
    createdAt: firstSeenAt,
    updatedAt: firstSeenAt,
  })
  graph.readerSignalMatches.push({
    userId: USER_ID,
    signalId,
    matchedInterestId: interestId,
    relevance: fixture.relevance,
    gap: 0,
    matchedAt: firstSeenAt,
  })

  const citationPublisherIds = [originPublisherId]
  for (const [index, name] of fixture.contributorNames.entries()) {
    const publisherId = uuid(1, fixture.key * 100 + index + 1)
    graph.publishers.push({
      id: publisherId,
      slug: name.toLowerCase(),
      name,
      createdAt: firstSeenAt,
    })
    citationPublisherIds.push(publisherId)
  }

  for (const [index, publisherId] of citationPublisherIds.entries()) {
    const sourceId = index === 0 ? originSourceId : uuid(2, fixture.key * 100 + index)
    const itemId = uuid(5, fixture.key * 100 + index)
    const seenAt = new Date(firstSeenAt.getTime() + index * 60_000)
    if (index > 0) {
      graph.sources.push({
        id: sourceId,
        publisherId,
        transport: 'rss',
        endpointUrl: `https://citer-${fixture.key}-${index}.example/feed.xml`,
        isAggregator: false,
        disabledAt: null,
        disabledReason: null,
        consecutiveFailures: 0,
        retryAfterAt: null,
        lastPolledAt: seenAt,
        newestItemAt: seenAt,
        createdAt: seenAt,
      })
    }
    graph.items.push({
      id: itemId,
      sourceId,
      externalId: `item-${fixture.key}-${index}`,
      url: index === 0 ? `https://${fixture.host}/stories/${fixture.key}` : `https://citer-${fixture.key}-${index}.example/items/1`,
      title: `Item ${fixture.key}-${index}`,
      summary: null,
      rawFeedDate: null,
      publishedAt: seenAt,
      fetchedAt: seenAt,
      issueHydratedAt: null,
      createdAt: seenAt,
      updatedAt: seenAt,
    })
    graph.citations.push({
      id: uuid(6, fixture.key * 100 + index),
      itemId,
      sourceId,
      linkId: signalId,
      kind: index === 0 ? 'self' : 'outbound',
      rawUrl: `https://${fixture.host}/stories/${fixture.key}`,
      anchorText: null,
      firstSeenAt: seenAt,
      createdAt: seenAt,
    })
  }

  return signalId
}

function setCitationTimeline(graph: TestGraph, signalId: string, firstSeenAt: Date): void {
  const citations = graph.citations.filter(citation => citation.linkId === signalId)
  for (const [index, citation] of citations.entries())
    citation.firstSeenAt = new Date(firstSeenAt.getTime() + index * 60_000)
}

function addMergedTombstone(graph: TestGraph, rootSignalId: string, key: number): string {
  const id = uuid(8, key)
  const createdAt = new Date('2026-08-28T00:00:00.000Z')
  graph.links.push({
    id,
    url: `https://alias.example/${key}`,
    firstSeenAt: createdAt,
    createdAt,
  })
  graph.signals.push({
    id,
    targetLinkId: id,
    mergedIntoId: rootSignalId,
    strength: 0,
    originPublisherId: null,
    textBasis: null,
    embeddingText: null,
    embedding: null,
    embeddingModel: null,
    embeddingDimensions: null,
    embeddingVersion: null,
    embeddedAt: null,
    createdAt,
  })
  return id
}

async function runCut(corpus: TestGraph, wakeAt: Date = WAKE_AT): Promise<TestGraph> {
  return await runIngestion({
    sources: [],
    responses: [],
    initialGraph: corpus as unknown as BaseGraph,
    now: () => new Date(wakeAt),
  }) as unknown as TestGraph
}

describe('brief admission through the ingestion seam', () => {
  it('cuts every admitted Signal into deterministic routes, positions, and frozen why-text', async () => {
    const corpus = emptyCorpus()
    const strongestInterest = addSignal(corpus, {
      key: 1,
      host: 'database.example',
      basis: 'own',
      relevance: 0.82,
      interestStatement: 'Database internals',
      contributorNames: ['Alpha', 'Beta'],
    })
    const secondInterest = addSignal(corpus, {
      key: 2,
      host: 'runtime.example',
      basis: 'citing',
      relevance: 0.72,
      interestStatement: 'Runtime releases',
      contributorNames: ['Gamma', 'Lambda', 'Omega'],
    })
    const convergence = addSignal(corpus, {
      key: 3,
      host: 'unexpected.example',
      basis: 'own',
      relevance: 0.69,
      interestStatement: 'Unrelated interest',
      contributorNames: ['Delta', 'Epsilon', 'Eta', 'Zeta'],
    })

    const graph = await runCut(corpus)

    expect(graph.briefs).toHaveLength(1)
    expect(graph.briefs[0]).toMatchObject({
      userId: USER_ID,
      localDate: '2026-08-29',
      cutAt: WAKE_AT,
    })
    expect(graph.briefEntries.map(entry => ({
      signalId: entry.signalId,
      position: entry.position,
      admittedBy: entry.admittedBy,
      whyText: entry.whyText,
    }))).toEqual([
      {
        signalId: strongestInterest,
        position: 1,
        admittedBy: 'interest',
        whyText: '2 Publishers converged · Alpha, Beta · origin: database.example · matched: "Database internals"',
      },
      {
        signalId: secondInterest,
        position: 2,
        admittedBy: 'interest',
        whyText: '3 Publishers converged · Gamma, Lambda, Omega · origin: runtime.example · matched: "Runtime releases"',
      },
      {
        signalId: convergence,
        position: 3,
        admittedBy: 'convergence',
        whyText: '4 Publishers converged · Delta, Epsilon, Eta, +1 · origin: unexpected.example · no Interest matched — surfacing on convergence alone',
      },
    ])
  })

  it('admits only Signals clearing every eligibility bar without a recent window or entry limit', async () => {
    const corpus = emptyCorpus()
    const strengthOne = addSignal(corpus, {
      key: 10,
      host: 'strength-one.example',
      basis: 'own',
      relevance: 0.9,
      interestStatement: 'Strength one',
      contributorNames: ['Only one'],
    })
    const tooOld = addSignal(corpus, {
      key: 11,
      host: 'too-old.example',
      basis: 'own',
      relevance: 0.9,
      interestStatement: 'Too old',
      contributorNames: ['One', 'Two'],
    })
    setCitationTimeline(corpus, tooOld, new Date(WAKE_AT.getTime() - 7 * 24 * 60 * 60 * 1000 - 1))

    const previouslyBriefed = addSignal(corpus, {
      key: 12,
      host: 'already-briefed.example',
      basis: 'own',
      relevance: 0.9,
      interestStatement: 'Already briefed',
      contributorNames: ['One', 'Two'],
    })
    const priorBriefId = uuid(7, 1)
    corpus.briefs.push({
      id: priorBriefId,
      userId: USER_ID,
      localDate: '2026-08-28',
      cutAt: new Date('2026-08-28T00:17:00.000Z'),
      createdAt: new Date('2026-08-28T00:17:00.000Z'),
    })
    corpus.briefEntries.push({
      briefId: priorBriefId,
      userId: USER_ID,
      signalId: addMergedTombstone(corpus, previouslyBriefed, 1),
      position: 1,
      admittedBy: 'interest',
      whyText: 'Frozen prior explanation',
      createdAt: new Date('2026-08-28T00:17:00.000Z'),
    })

    const alreadyRead = addSignal(corpus, {
      key: 13,
      host: 'already-read.example',
      basis: 'own',
      relevance: 0.9,
      interestStatement: 'Already read',
      contributorNames: ['One', 'Two'],
    })
    corpus.readStates.push({
      userId: USER_ID,
      signalId: addMergedTombstone(corpus, alreadyRead, 2),
      readAt: WAKE_AT,
    })

    const unmatchedStrengthTwo = addSignal(corpus, {
      key: 14,
      host: 'unmatched-two.example',
      basis: 'citing',
      relevance: 0.669,
      interestStatement: 'Below the citing bar',
      contributorNames: ['One', 'Two'],
    })

    const eligibleIds: string[] = []
    for (let index = 0; index < 15; index++) {
      const signalId = addSignal(corpus, {
        key: 20 + index,
        host: `eligible-${index}.example`,
        basis: 'own',
        relevance: 0.8,
        interestStatement: `Eligible ${index}`,
        contributorNames: ['One', 'Two'],
      })
      const firstSeenAt = index === 0
        ? new Date(WAKE_AT.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(WAKE_AT.getTime() - (48 + index * 6) * 60 * 60 * 1000)
      setCitationTimeline(corpus, signalId, firstSeenAt)
      eligibleIds.push(signalId)
    }

    const graph = await runCut(corpus)
    const today = graph.briefs.find(brief => brief.localDate === '2026-08-29')
    expect(today).toBeDefined()
    expect(graph.briefEntries
      .filter(entry => entry.briefId === today?.id)
      .map(entry => entry.signalId)).toEqual([...eligibleIds].sort())
    expect(graph.briefEntries.some(entry => [
      strengthOne,
      tooOld,
      previouslyBriefed,
      alreadyRead,
      unmatchedStrengthTwo,
    ].includes(entry.signalId) && entry.briefId === today?.id)).toBe(false)
  })

  it('uses inclusive per-basis bars and assigns exactly one Admission route', async () => {
    const corpus = emptyCorpus()
    const ownBoundary = addSignal(corpus, {
      key: 40,
      host: 'own-boundary.example',
      basis: 'own',
      relevance: 0.70,
      interestStatement: 'Own boundary',
      contributorNames: ['One', 'Two'],
    })
    const citingBoundary = addSignal(corpus, {
      key: 41,
      host: 'citing-boundary.example',
      basis: 'citing',
      relevance: 0.67,
      interestStatement: 'Citing boundary',
      contributorNames: ['One', 'Two'],
    })
    const matchedStrengthThree = addSignal(corpus, {
      key: 42,
      host: 'matched-three.example',
      basis: 'own',
      relevance: 0.71,
      interestStatement: 'Matched at Strength three',
      contributorNames: ['One', 'Two', 'Three'],
    })
    const ownBelow = addSignal(corpus, {
      key: 43,
      host: 'own-below.example',
      basis: 'own',
      relevance: 0.699,
      interestStatement: 'Below own boundary',
      contributorNames: ['One', 'Two', 'Three'],
    })
    const slugStrengthTwo = addSignal(corpus, {
      key: 44,
      host: 'slug-two.example',
      basis: 'slug',
      relevance: 0.99,
      interestStatement: 'High cosine slug',
      contributorNames: ['One', 'Two'],
    })
    const slugStrengthThree = addSignal(corpus, {
      key: 45,
      host: 'slug-three.example',
      basis: 'slug',
      relevance: 0.99,
      interestStatement: 'High cosine slug',
      contributorNames: ['One', 'Two', 'Three'],
    })

    const graph = await runCut(corpus)
    expect(graph.briefEntries.map(entry => [entry.signalId, entry.admittedBy])).toEqual([
      [matchedStrengthThree, 'interest'],
      [ownBoundary, 'interest'],
      [citingBoundary, 'interest'],
      [slugStrengthThree, 'convergence'],
      [ownBelow, 'convergence'],
    ])
    expect(graph.briefEntries.some(entry => entry.signalId === slugStrengthTwo)).toBe(false)
  })

  it('cuts once per local day and never recomputes a frozen explanation', async () => {
    const corpus = emptyCorpus()
    addSignal(corpus, {
      key: 50,
      host: 'daily.example',
      basis: 'own',
      relevance: 0.8,
      interestStatement: 'Daily database systems',
      contributorNames: ['First Publisher', 'Second Publisher'],
    })

    const beforeCut = await runCut(corpus, new Date('2026-08-28T21:17:00.000Z'))
    expect(beforeCut.briefs).toEqual([])

    const firstCut = await runCut(beforeCut, new Date('2026-08-28T22:17:00.000Z'))
    expect(firstCut.briefs.map(brief => brief.localDate)).toEqual(['2026-08-29'])
    expect(firstCut.briefEntries).toHaveLength(1)
    const frozenWhyText = firstCut.briefEntries[0]!.whyText

    firstCut.interests[0]!.statement = 'Edited after cut'
    firstCut.publishers.find(publisher => publisher.name === 'First Publisher')!.name = 'Renamed Publisher'
    const replay = await runCut(firstCut, new Date('2026-08-29T12:17:00.000Z'))
    expect(replay.briefs.map(brief => brief.localDate)).toEqual(['2026-08-29'])
    expect(replay.briefEntries.map(entry => entry.whyText)).toEqual([frozenWhyText])

    const nextDay = await runCut(replay, new Date('2026-08-29T22:17:00.000Z'))
    expect(nextDay.briefs.map(brief => brief.localDate)).toEqual(['2026-08-29', '2026-08-30'])
    expect(nextDay.briefEntries).toHaveLength(1)
  })
})
