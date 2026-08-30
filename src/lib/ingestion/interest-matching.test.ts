import type { EmbeddingProvider } from '@/lib/embeddings/provider'
import { describe, expect, it, vi } from 'vitest'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from '@/lib/embeddings/provider'
import { runIngestion } from './pipeline'

const NOW = new Date('2026-08-29T08:00:00.000Z')
const LATER = new Date('2026-08-29T09:00:00.000Z')

const USER_A = '00000000-0000-4000-8000-000000000001'
const USER_B = '00000000-0000-4000-8000-000000000002'
const USER_C = '00000000-0000-4000-8000-000000000003'
const USER_D = '00000000-0000-4000-8000-000000000004'

type BaseGraph = Awaited<ReturnType<typeof runIngestion>>
type TextBasis = 'own' | 'citing' | 'slug'
type StoredVector = readonly number[] | Float32Array

type ExpectedSignal = BaseGraph['signals'][number] & {
  textBasis: TextBasis | null
  embeddingText: string | null
  embeddingTextExpiresAt: Date | null
  embedding: StoredVector | null
  embeddingModel: string | null
  embeddingDimensions: number | null
  embeddingVersion: string | null
  embeddedAt: Date | null
}

interface ExpectedUser {
  id: string
  timezone: string
  cutHour: number
  createdAt: Date
}

interface ExpectedInterest {
  id: string
  userId: string
  statement: string
  embedding: StoredVector | null
  embeddingInputHash: string | null
  embeddingModel: string | null
  embeddingDimensions: number | null
  embeddingVersion: string | null
  embeddedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ExpectedSignalMatch {
  userId: string
  signalId: string
  matchedInterestId: string | null
  relevance: number | null
  gap: number | null
  matchedAt: Date
}

type ExpectedGraph = Omit<BaseGraph, 'signals' | 'users' | 'interests' | 'readerSignalMatches'> & {
  signals: ExpectedSignal[]
  users: ExpectedUser[]
  interests: ExpectedInterest[]
  readerSignalMatches: ExpectedSignalMatch[]
}

type MatchingRunInput = Omit<Parameters<typeof runIngestion>[0], 'initialGraph'> & {
  initialGraph?: ExpectedGraph
  embeddingProvider: EmbeddingProvider
}

function source(host: string, ordinal: number) {
  return {
    id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    publisherId: `10000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    transport: 'rss' as const,
    endpointUrl: `https://${host}/feed.xml`,
    isAggregator: false,
    disabledAt: null,
    disabledReason: null,
    consecutiveFailures: 0,
    retryAfterAt: null,
    lastPolledAt: null,
    newestItemAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function user(id: string): ExpectedUser {
  return {
    id,
    timezone: 'Asia/Shanghai',
    cutHour: 23,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function interest(id: string, userId: string, statement: string): ExpectedInterest {
  return {
    id,
    userId,
    statement,
    embedding: null,
    embeddingInputHash: null,
    embeddingModel: null,
    embeddingDimensions: null,
    embeddingVersion: null,
    embeddedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function graphWithProfile(
  users: ExpectedUser[],
  interests: ExpectedInterest[],
  publisherHosts: BaseGraph['publisherHosts'] = [],
): ExpectedGraph {
  return {
    sources: [],
    items: [],
    publishers: [],
    publisherHosts,
    links: [],
    signals: [],
    citations: [],
    fetchLogs: [],
    httpCache: [],
    robotsCache: [],
    dormantSourceIds: [],
    users,
    interests,
    readerSignalMatches: [],
    briefs: [],
    briefEntries: [],
    readStates: [],
  }
}

function seedSlugSignal(graph: ExpectedGraph, id: string, url: string): void {
  graph.links.push({ id, url, firstSeenAt: new Date(NOW), createdAt: new Date(NOW) })
  graph.signals.push({
    id,
    targetLinkId: id,
    mergedIntoId: null,
    strength: 0,
    originPublisherId: null,
    textBasis: null,
    embeddingText: null,
    embeddingTextExpiresAt: null,
    embedding: null,
    embeddingModel: null,
    embeddingDimensions: null,
    embeddingVersion: null,
    embeddedAt: null,
    createdAt: new Date(NOW),
  })
}

function unitVector(axis = 0): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS)
  vector[axis] = 1
  return vector
}

function vectorWithCosine(cosine: number): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS)
  vector[0] = cosine
  vector[1] = Math.sqrt(1 - cosine ** 2)
  return vector
}

function fakeProvider(vectors: ReadonlyMap<string, Float32Array>) {
  const fallback = unitVector(3)
  const embed = vi.fn(async (texts: readonly string[]): Promise<readonly Float32Array[]> => {
    return texts.map(text => new Float32Array(vectors.get(text) ?? fallback))
  })
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    embed,
  } satisfies EmbeddingProvider
}

function embeddedTexts(provider: ReturnType<typeof fakeProvider>): string[] {
  return provider.embed.mock.calls.flatMap(([texts]) => [...texts])
}

async function runMatching(input: MatchingRunInput): Promise<ExpectedGraph> {
  return await runIngestion(input as unknown as Parameters<typeof runIngestion>[0]) as unknown as ExpectedGraph
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function signalFor(graph: ExpectedGraph, url: string): ExpectedSignal {
  const link = graph.links.find(candidate => candidate.url === url)
  const signal = graph.signals.find(candidate => candidate.targetLinkId === link?.id && candidate.mergedIntoId === null)
  expect(signal, `live Signal for ${url}`).toBeDefined()
  return signal!
}

function matchFor(graph: ExpectedGraph, userId: string, signalId: string): ExpectedSignalMatch {
  const match = graph.readerSignalMatches.find(candidate => candidate.userId === userId && candidate.signalId === signalId)
  expect(match, `match for ${userId} and ${signalId}`).toBeDefined()
  return match!
}

describe('signal Interest matching through the ingestion seam', () => {
  it('stores the exact own, longest citing, and tokenized slug Text Basis and embeds Interests separately', async () => {
    const ownSource = source('own.example', 101)
    const shortCiter = source('short-citer.example', 102)
    const longCiter = source('long-citer.example', 103)
    const ownUrl = 'https://own.example/articles/precise'
    const citingUrl = 'https://target.example/releases/mathematics'
    const slugUrl = 'https://target.example/2026/08/deep-story_alpha.html'
    const ownBody = collapse(`The body begins. ${'Detailed context '.repeat(100)}`)
    const expectedOwnText = collapse(`Precise own title. ${ownBody}`).slice(0, 1200)
    const longestAnchor = 'Learning more about the mathematical capabilities in this release'
    const firstInterest = 'AI research published by frontier laboratories'
    const secondInterest = 'TypeScript data infrastructure and databases'
    const profile = graphWithProfile(
      [user(USER_A)],
      [
        interest('20000000-0000-4000-8000-000000000001', USER_A, firstInterest),
        interest('20000000-0000-4000-8000-000000000002', USER_A, secondInterest),
      ],
      [ownSource, shortCiter, longCiter].map(candidate => ({
        host: new URL(candidate.endpointUrl).host,
        publisherId: candidate.publisherId,
      })),
    )
    seedSlugSignal(profile, '30000000-0000-4000-8000-000000000001', slugUrl)
    const provider = fakeProvider(new Map([
      [firstInterest, vectorWithCosine(0.8)],
      [secondInterest, vectorWithCosine(0.6)],
    ]))

    const graph = await runMatching({
      sources: [ownSource, shortCiter, longCiter],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [
        { url: 'https://own.example/robots.txt', status: 404 },
        { url: 'https://short-citer.example/robots.txt', status: 404 },
        { url: 'https://long-citer.example/robots.txt', status: 404 },
        {
          url: ownSource.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>own-item</guid><title>Precise own title</title><link>${ownUrl}</link>
            <description>Permanent summary.</description>
            <content><![CDATA[<p>The body begins.</p><p>${'Detailed context '.repeat(100)}</p>]]></content>
          </item></channel></rss>`,
        },
        {
          url: shortCiter.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>short-citation</guid><title>Short newsletter issue</title>
            <link>https://short-citer.example/issues/1</link>
            <description><![CDATA[<a href="${citingUrl}">the spec</a>]]></description>
          </item></channel></rss>`,
        },
        {
          url: longCiter.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>long-citation</guid><title>Long newsletter issue</title>
            <link>https://long-citer.example/issues/1</link>
            <description><![CDATA[<a href="${citingUrl}">Learning more about the <strong>mathematical capabilities</strong> in this release</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    expect(expectedOwnText).toHaveLength(1200)
    expect(graph.items.find(item => item.url === ownUrl)).toMatchObject({
      summary: 'Permanent summary.',
      text: ownBody.slice(0, 1200),
    })
    expect(signalFor(graph, ownUrl)).toMatchObject({
      textBasis: 'own',
      embeddingText: expectedOwnText,
      embeddingTextExpiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embeddingVersion: EMBEDDING_VERSION,
    })
    expect(signalFor(graph, citingUrl)).toMatchObject({
      textBasis: 'citing',
      embeddingText: longestAnchor,
      embeddingTextExpiresAt: null,
    })
    expect(signalFor(graph, slugUrl)).toMatchObject({
      textBasis: 'slug',
      embeddingText: 'target example deep story alpha',
      embeddingTextExpiresAt: null,
    })
    expect(graph.citations.filter(citation => citation.linkId === graph.links.find(link => link.url === citingUrl)?.id))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ anchorText: 'the spec' }),
        expect.objectContaining({ anchorText: longestAnchor }),
      ]))

    const inputs = embeddedTexts(provider)
    expect(inputs.filter(text => text === firstInterest)).toHaveLength(1)
    expect(inputs.filter(text => text === secondInterest)).toHaveLength(1)
    expect(inputs.some(text => text.includes(firstInterest) && text.includes(secondInterest))).toBe(false)
  })

  it('applies the 1200-character storage and compute bound by Unicode code point', async () => {
    const ownSource = source('unicode-own.example', 104)
    const ownUrl = 'https://unicode-own.example/articles/code-points'
    const profile = graphWithProfile([], [], [{
      host: 'unicode-own.example',
      publisherId: ownSource.publisherId,
    }])
    const provider = fakeProvider(new Map())

    const graph = await runMatching({
      sources: [ownSource],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [
        { url: 'https://unicode-own.example/robots.txt', status: 404 },
        {
          url: ownSource.endpointUrl,
          status: 200,
          body: `<rss><channel><item>
            <guid>unicode-own</guid><title>Unicode own title</title><link>${ownUrl}</link>
            <description><![CDATA[${'😀'.repeat(1201)}]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    const summary = graph.items.find(item => item.url === ownUrl)?.summary
    expect(Array.from(summary ?? '')).toHaveLength(1200)
    expect(Array.from(signalFor(graph, ownUrl).embeddingText ?? '')).toHaveLength(1200)
  })

  it('stores exact per-reader MAX cosine, argmax Interest, GAP, and deterministic edge cases', async () => {
    const signalUrl = 'https://ranking.example/items/match.html'
    const signalText = 'ranking example items match'
    const winner = interest('20000000-0000-4000-8000-000000000010', USER_A, 'Winner interest')
    const runnerUp = interest('20000000-0000-4000-8000-000000000011', USER_A, 'Runner-up interest')
    const third = interest('20000000-0000-4000-8000-000000000012', USER_A, 'Third interest')
    const solo = interest('20000000-0000-4000-8000-000000000020', USER_B, 'A single interest')
    const tieHighId = interest('20000000-0000-4000-8000-000000000041', USER_D, 'Tie encountered first')
    const tieLowId = interest('20000000-0000-4000-8000-000000000040', USER_D, 'Tie with lower stable ID')
    const profile = graphWithProfile(
      [user(USER_A), user(USER_B), user(USER_C), user(USER_D)],
      [runnerUp, winner, third, solo, tieHighId, tieLowId],
    )
    seedSlugSignal(profile, '30000000-0000-4000-8000-000000000010', signalUrl)
    const provider = fakeProvider(new Map([
      [signalText, unitVector(0)],
      [winner.statement, vectorWithCosine(0.8)],
      [runnerUp.statement, vectorWithCosine(0.6)],
      [third.statement, vectorWithCosine(0.2)],
      [solo.statement, vectorWithCosine(0.95)],
      [tieHighId.statement, vectorWithCosine(0.7)],
      [tieLowId.statement, vectorWithCosine(0.7)],
    ]))

    const graph = await runMatching({
      sources: [],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [],
    })
    const signal = signalFor(graph, signalUrl)

    const firstReader = matchFor(graph, USER_A, signal.id)
    expect(firstReader.matchedInterestId).toBe(winner.id)
    expect(firstReader.relevance).toBeCloseTo(0.8, 6)
    expect(firstReader.gap).toBeCloseTo(0.2, 6)

    expect(matchFor(graph, USER_B, signal.id)).toMatchObject({
      matchedInterestId: solo.id,
      relevance: expect.closeTo(0.95, 6),
      gap: null,
    })
    expect(matchFor(graph, USER_C, signal.id)).toMatchObject({
      matchedInterestId: null,
      relevance: null,
      gap: null,
    })
    expect(matchFor(graph, USER_D, signal.id)).toMatchObject({
      matchedInterestId: tieLowId.id,
      relevance: expect.closeTo(0.7, 6),
      gap: expect.closeTo(0, 6),
    })
  })

  it('does not re-embed a Signal on exact replay or same-rung Item edits', async () => {
    const ownSource = source('stable.example', 201)
    const targetUrl = 'https://stable.example/posts/one'
    const statement = 'Stable systems and deterministic ingestion'
    const originalText = 'Original title. Original summary'
    const profile = graphWithProfile(
      [user(USER_A)],
      [interest('20000000-0000-4000-8000-000000000101', USER_A, statement)],
      [{ host: 'stable.example', publisherId: ownSource.publisherId }],
    )
    const provider = fakeProvider(new Map([
      [originalText, unitVector(0)],
      [statement, vectorWithCosine(0.8)],
    ]))
    const feed = (title: string, summary: string) => `<rss><channel><item>
      <guid>stable-item</guid><title>${title}</title><link>${targetUrl}</link>
      <description>${summary}</description>
    </item></channel></rss>`

    const first = await runMatching({
      sources: [ownSource],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [
        { url: 'https://stable.example/robots.txt', status: 404 },
        { url: ownSource.endpointUrl, status: 200, body: feed('Original title', 'Original summary') },
      ],
    })
    const initialSignal = signalFor(first, targetUrl)
    const initialVector = Array.from(initialSignal.embedding ?? [])
    const initiallyEmbeddedAt = initialSignal.embeddedAt
    expect(embeddedTexts(provider).filter(text => text === originalText)).toHaveLength(1)

    provider.embed.mockClear()
    const replay = await runMatching({
      sources: [ownSource],
      initialGraph: first,
      embeddingProvider: provider,
      now: () => new Date(LATER),
      responses: [{ url: ownSource.endpointUrl, status: 200, body: feed('Original title', 'Original summary') }],
    })
    expect(embeddedTexts(provider)).toEqual([])

    provider.embed.mockClear()
    const edited = await runMatching({
      sources: [ownSource],
      initialGraph: replay,
      embeddingProvider: provider,
      now: () => new Date('2026-08-29T10:00:00.000Z'),
      responses: [{ url: ownSource.endpointUrl, status: 200, body: feed('Corrected title', 'Corrected summary') }],
    })
    const unchangedSignal = signalFor(edited, targetUrl)
    expect(edited.items.find(item => item.externalId === 'stable-item')).toMatchObject({
      title: 'Corrected title',
      summary: 'Corrected summary',
    })
    expect(embeddedTexts(provider)).toEqual([])
    expect(unchangedSignal).toMatchObject({ textBasis: 'own', embeddingText: originalText })
    expect(Array.from(unchangedSignal.embedding ?? [])).toEqual(initialVector)
    expect(unchangedSignal.embeddedAt).toEqual(initiallyEmbeddedAt)
  })

  it('re-embeds exactly once when a citing Signal improves to own', async () => {
    const citer = source('citer.example', 301)
    const owner = source('owner.example', 302)
    const targetUrl = 'https://owner.example/releases/one'
    const citingText = 'Detailed release announcement'
    const ownText = 'Release one. Full release notes'
    const statement = 'Release engineering and infrastructure'
    const profile = graphWithProfile(
      [user(USER_A)],
      [interest('20000000-0000-4000-8000-000000000201', USER_A, statement)],
      [citer, owner].map(candidate => ({
        host: new URL(candidate.endpointUrl).host,
        publisherId: candidate.publisherId,
      })),
    )
    const provider = fakeProvider(new Map([
      [citingText, unitVector(0)],
      [ownText, unitVector(1)],
      [statement, vectorWithCosine(0.8)],
    ]))

    const first = await runMatching({
      sources: [citer],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [
        { url: 'https://citer.example/robots.txt', status: 404 },
        {
          url: citer.endpointUrl,
          status: 200,
          body: `<rss><channel><item><guid>citing-item</guid><title>Newsletter issue</title>
            <link>https://citer.example/issues/one</link>
            <description><![CDATA[<a href="${targetUrl}">${citingText}</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })
    expect(signalFor(first, targetUrl)).toMatchObject({ textBasis: 'citing', embeddingText: citingText })

    provider.embed.mockClear()
    const second = await runMatching({
      sources: [owner],
      initialGraph: first,
      embeddingProvider: provider,
      now: () => new Date(LATER),
      responses: [
        { url: 'https://owner.example/robots.txt', status: 404 },
        {
          url: owner.endpointUrl,
          status: 200,
          body: `<rss><channel><item><guid>owned-item</guid><title>Release one</title>
            <link>${targetUrl}</link><description>Full release notes</description>
          </item></channel></rss>`,
        },
      ],
    })

    expect(signalFor(second, targetUrl)).toMatchObject({ textBasis: 'own', embeddingText: ownText })
    expect(embeddedTexts(provider)).toEqual([ownText])
  })

  it('re-embeds exactly once when a slug Signal gains citing text', async () => {
    const citer = source('slug-citer.example', 303)
    const targetUrl = 'https://unseen.example/releases/without-text.html'
    const slugText = 'unseen example releases without text'
    const citingText = 'A precise description of the unseen release'
    const statement = 'Software release engineering'
    const profile = graphWithProfile(
      [user(USER_A)],
      [interest('20000000-0000-4000-8000-000000000203', USER_A, statement)],
    )
    seedSlugSignal(profile, '30000000-0000-4000-8000-000000000203', targetUrl)
    const provider = fakeProvider(new Map([
      [slugText, unitVector(0)],
      [citingText, unitVector(1)],
      [statement, vectorWithCosine(0.8)],
    ]))

    const first = await runMatching({
      sources: [],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [],
    })
    expect(signalFor(first, targetUrl)).toMatchObject({ textBasis: 'slug', embeddingText: slugText })

    provider.embed.mockClear()
    const second = await runMatching({
      sources: [citer],
      initialGraph: first,
      embeddingProvider: provider,
      now: () => new Date(LATER),
      responses: [
        { url: 'https://slug-citer.example/robots.txt', status: 404 },
        {
          url: citer.endpointUrl,
          status: 200,
          body: `<rss><channel><item><guid>slug-citing-item</guid><title>Release issue</title>
            <link>https://slug-citer.example/issues/one</link>
            <description><![CDATA[<a href="${targetUrl}">${citingText}</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    expect(signalFor(second, targetUrl)).toMatchObject({ textBasis: 'citing', embeddingText: citingText })
    expect(embeddedTexts(provider).filter(text => text === citingText)).toEqual([citingText])
  })

  it('embeds and matches only the live root after an alias merge', async () => {
    const owner = source('release-owner.example', 304)
    const announcementUrl = 'https://release-owner.example/posts/v2'
    const releaseUrl = 'https://github.com/example/project/releases/tag/v2.0.0'
    const ownText = 'Version two. Complete release notes. Download v2'
    const statement = 'Developer tooling releases'
    const profile = graphWithProfile(
      [user(USER_A)],
      [interest('20000000-0000-4000-8000-000000000204', USER_A, statement)],
      [{ host: 'release-owner.example', publisherId: owner.publisherId }],
    )
    const provider = fakeProvider(new Map([
      [ownText, unitVector(0)],
      [statement, vectorWithCosine(0.8)],
    ]))

    const graph = await runMatching({
      sources: [owner],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [
        { url: 'https://release-owner.example/robots.txt', status: 404 },
        {
          url: owner.endpointUrl,
          status: 200,
          body: `<rss><channel><item><guid>release-v2</guid><title>Version two</title>
            <link>${announcementUrl}</link>
            <description><![CDATA[Complete release notes. <a href="${releaseUrl}">Download v2</a>]]></description>
          </item></channel></rss>`,
        },
      ],
    })

    const root = signalFor(graph, announcementUrl)
    const tombstone = graph.signals.find(signal => signal.targetLinkId === graph.links.find(link => link.url === releaseUrl)?.id)
    expect(tombstone).toMatchObject({ mergedIntoId: root.id, embedding: null, textBasis: null })
    expect(graph.readerSignalMatches.map(match => match.signalId)).toEqual([root.id])
    expect(embeddedTexts(provider)).toEqual([ownText, statement])
  })

  it('recomputes matches after a profile edit without re-embedding Signals', async () => {
    const signalUrl = 'https://profile.example/story/one.html'
    const signalText = 'profile example story one'
    const firstInterest = interest('20000000-0000-4000-8000-000000000301', USER_A, 'Initial winner')
    const editedInterest = interest('20000000-0000-4000-8000-000000000302', USER_A, 'Initial runner-up')
    const profile = graphWithProfile([user(USER_A)], [firstInterest, editedInterest])
    seedSlugSignal(profile, '30000000-0000-4000-8000-000000000301', signalUrl)
    const changedStatement = 'Sharper replacement interest'
    const provider = fakeProvider(new Map([
      [signalText, unitVector(0)],
      [firstInterest.statement, vectorWithCosine(0.8)],
      [editedInterest.statement, vectorWithCosine(0.4)],
      [changedStatement, vectorWithCosine(0.9)],
    ]))

    const first = await runMatching({
      sources: [],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [],
    })
    const signal = signalFor(first, signalUrl)
    expect(matchFor(first, USER_A, signal.id).matchedInterestId).toBe(firstInterest.id)
    const originalVector = Array.from(signal.embedding ?? [])
    const originalEmbeddedAt = signal.embeddedAt

    Object.assign(editedInterest, {
      statement: changedStatement,
      embedding: null,
      embeddingInputHash: null,
      embeddingModel: null,
      embeddingDimensions: null,
      embeddingVersion: null,
      embeddedAt: null,
      updatedAt: new Date(LATER),
    })
    provider.embed.mockClear()
    const second = await runMatching({
      sources: [],
      initialGraph: first,
      embeddingProvider: provider,
      now: () => new Date(LATER),
      responses: [],
    })

    expect(embeddedTexts(provider)).toEqual([changedStatement])
    expect(Array.from(signalFor(second, signalUrl).embedding ?? [])).toEqual(originalVector)
    expect(signalFor(second, signalUrl).embeddedAt).toEqual(originalEmbeddedAt)
    expect(matchFor(second, USER_A, signal.id)).toMatchObject({
      matchedInterestId: editedInterest.id,
      relevance: expect.closeTo(0.9, 6),
      gap: expect.closeTo(0.1, 6),
      matchedAt: LATER,
    })
  })

  it('fails closed without persisting partial state when a provider returns the wrong dimension', async () => {
    const signalUrl = 'https://invalid.example/story/one.html'
    const profileInterest = interest(
      '20000000-0000-4000-8000-000000000401',
      USER_A,
      'A profile statement',
    )
    const profile = graphWithProfile([user(USER_A)], [profileInterest])
    seedSlugSignal(profile, '30000000-0000-4000-8000-000000000401', signalUrl)
    const provider = {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      version: EMBEDDING_VERSION,
      embed: vi.fn(async (texts: readonly string[]) => texts.map(() => new Float32Array(383))),
    } satisfies EmbeddingProvider

    await expect(runMatching({
      sources: [],
      initialGraph: profile,
      embeddingProvider: provider,
      now: () => new Date(NOW),
      responses: [],
    })).rejects.toThrow(/384|dimension/i)

    expect(profile.signals[0]).toMatchObject({
      textBasis: null,
      embeddingText: null,
      embeddingTextExpiresAt: null,
      embedding: null,
      embeddedAt: null,
    })
    expect(profileInterest).toMatchObject({ embedding: null, embeddedAt: null })
    expect(profile.readerSignalMatches).toEqual([])
  })
})
