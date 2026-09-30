import { setImmediate } from 'node:timers/promises'
import { expect, it, vi } from 'vitest'
import { runIngestion } from './pipeline'

it('drains in-flight Source commits and stops taking work after a fatal commit failure', async () => {
  const at = new Date('2026-09-30T01:00:00Z')
  const sources = Array.from({ length: 8 }, (_, index) => ({
    id: `source-${index}`,
    publisherId: `publisher-${index}`,
    transport: 'rss' as const,
    // The last two Sources cover another host and another Source on a busy host.
    endpointUrl: `https://host-${index === 7 ? 1 : index}.example/feed-${index}.xml`,
    isAggregator: false,
    disabledAt: null,
    disabledReason: null,
    consecutiveFailures: 0,
    retryAfterAt: null,
    lastPolledAt: null,
    newestItemAt: null,
    createdAt: at,
  }))
  let failFirst!: (error: Error) => void
  const firstCommit = new Promise<void>((_, reject) => {
    failFirst = reject
  })
  let finishOthers!: () => void
  const otherCommits = new Promise<void>((resolve) => {
    finishOthers = resolve
  })
  let allStarted!: () => void
  const started = new Promise<void>((resolve) => {
    allStarted = resolve
  })
  const committed: string[] = []
  const onSourcesComplete = vi.fn()
  const failure = new Error('Permanent database failure')
  const ingestion = runIngestion({
    sources,
    now: () => at,
    responses: sources.flatMap(source => [
      { url: new URL('/robots.txt', source.endpointUrl).href, status: 404 },
      { url: source.endpointUrl, status: 200, body: '<rss><channel /></rss>' },
    ]),
    onSourceCommitted: async (source) => {
      committed.push(source.id)
      if (committed.length === 6)
        allStarted()
      await (source.id === 'source-0' ? firstCommit : otherCommits)
    },
    onSourcesComplete,
  })
  // Attach the rejection handler before releasing either deferred commit.
  const result = ingestion.then(() => 'completed', error => error)
  await started
  failFirst(failure)
  const beforeDrain = await Promise.race([result, setImmediate('pending')])
  finishOthers()
  expect(await result).toBe(failure)
  expect(beforeDrain).toBe('pending')
  expect(committed.sort()).toEqual(['source-0', 'source-1', 'source-2', 'source-3', 'source-4', 'source-5'])
  expect(onSourcesComplete).not.toHaveBeenCalled()
})
