import type { IngestionHealthInput } from './health-report'
import type { IngestionSource, SourceFetchLog } from './pipeline'
import { describe, expect, it } from 'vitest'
import { buildIngestionHealthReport } from './health-report'
import { ROBOTS_AUTO_DISABLED_REASON } from './pipeline'

const START = new Date('2026-09-30T00:00:00Z')
const FINISH = new Date('2026-09-30T00:01:00Z')

function source(overrides: Partial<IngestionSource> = {}): IngestionSource {
  return { id: 'source-id', publisherId: 'publisher', transport: 'rss', endpointUrl: 'https://source.example/feed', isAggregator: false, disabledAt: null, disabledReason: null, consecutiveFailures: 0, retryAfterAt: null, lastPolledAt: null, newestItemAt: null, createdAt: START, ...overrides }
}

function log(overrides: Partial<SourceFetchLog> = {}): SourceFetchLog {
  return { id: 1, sourceId: 'source-id', startedAt: START, durationMs: 50, outcome: 'ok', httpStatus: 200, itemsSeen: 0, itemsNew: 0, bytes: 0, errorMessage: null, ...overrides }
}

function input(overrides: Partial<IngestionHealthInput> = {}): IngestionHealthInput {
  return { wake: { startedAt: START, finishedAt: FINISH, status: 'completed', elapsedMs: 60_000 }, sources: [source()], fetchLogs: [], briefStatus: 'confirmed', ...overrides }
}

describe('ingestion health reporting', () => {
  it('keeps disabled Sources visible when they have no current fetch log', () => {
    const report = buildIngestionHealthReport(input({ sources: [
      source({ id: 'rss-disabled', disabledAt: START, disabledReason: 'automatically disabled after 10 consecutive failures', consecutiveFailures: 10 }),
      source({ id: 'robots-disabled', disabledAt: START, disabledReason: ROBOTS_AUTO_DISABLED_REASON, consecutiveFailures: 10 }),
    ] }))
    expect(report.summaryMarkdown).toContain('2 configured Sources; 2 disabled; 2 require attention; 0 confirmed successful this wake')
    expect(report.summaryMarkdown).toContain('disabled; manual review required')
    expect(report.summaryMarkdown).toContain('disabled; awaiting robots recovery')
    expect(report.annotations).toHaveLength(2)
    expect(report.annotations.join('\n')).toContain('robots-disabled')
  })

  it('does not classify failed, retrying or unpolled Sources as confirmed successful', () => {
    const report = buildIngestionHealthReport(input({
      sources: [source({ id: 'failed' }), source({ id: 'retry', consecutiveFailures: 2 }), source({ id: 'unpolled' }), source({ id: 'unchanged' })],
      fetchLogs: [log({ sourceId: 'failed', outcome: 'parse_error' }), log({ sourceId: 'unchanged', outcome: 'not_modified', httpStatus: 304 })],
    }))
    expect(report.summaryMarkdown).toContain('2 require attention; 1 confirmed successful this wake; 2 without a current outcome')
    expect(report.summaryMarkdown).toContain('retry pending; 2 consecutive failures')
    expect(report.summaryMarkdown).toContain('not polled this wake')
    expect(report.annotations).toHaveLength(2)
  })

  it('uses the latest in-wake outcome and ignores older or later logs', () => {
    const report = buildIngestionHealthReport(input({ fetchLogs: [
      log({ id: 1, outcome: 'parse_error', startedAt: new Date(START.getTime() - 1) }),
      log({ id: 2, outcome: 'timeout' }),
      log({ id: 3, outcome: 'not_modified', httpStatus: 304 }),
      log({ id: 4, outcome: 'http_error', startedAt: new Date(FINISH.getTime() + 1) }),
    ] }))
    expect(report.summaryMarkdown).toContain('1 confirmed successful this wake')
    expect(report.annotations).toEqual([])
  })

  it('reports termination and unavailable Source state without inventing delivery or a healthy inventory', () => {
    const report = buildIngestionHealthReport(input({ wake: { startedAt: START, finishedAt: FINISH, status: 'failed', elapsedMs: 60_000, attempts: 3 }, sources: null, briefStatus: 'unverified' }))
    expect(report.hasErrors).toBe(true)
    expect(report.annotations.some(value => value.startsWith('::error title=Ingestion incomplete::'))).toBe(true)
    expect(report.summaryMarkdown).toContain('Source health is unknown')
    expect(report.summaryMarkdown).toContain('Daily Brief: **unverified**')
    expect(report.summaryMarkdown).not.toContain('0 configured Sources')
  })

  it('reports a missing Brief and budget overrun but accepts an empty persisted Brief', () => {
    const missing = buildIngestionHealthReport(input({ briefStatus: 'missing', wake: { startedAt: START, finishedAt: FINISH, status: 'completed', elapsedMs: 120_001 }, metrics: { decodedReadBytes: 100, compiledWriteBytes: 200, committedStatements: 3, affectedRows: 4 } }))
    expect(missing.hasErrors).toBe(true)
    expect(missing.annotations.some(value => value.startsWith('::error title=Daily Brief missing::'))).toBe(true)
    expect(missing.annotations.some(value => value.startsWith('::warning title=Neon wake budget exceeded::'))).toBe(true)
    expect(missing.summaryMarkdown).toContain('These are not billed network transfer')
    const emptyPersistedBrief = buildIngestionHealthReport(input({ fetchLogs: [log({ itemsSeen: 0, itemsNew: 0 })] }))
    expect(emptyPersistedBrief.hasErrors).toBe(false)
    expect(emptyPersistedBrief.annotations).toEqual([])
  })

  it('escapes workflow-command injection and omits URL credentials and raw errors', () => {
    const maliciousId = 'source%0A\r\n::error title=Injected::payload|<script>'
    const report = buildIngestionHealthReport(input({
      sources: [source({ id: maliciousId, endpointUrl: 'https://user:secret-password@source.example/private-path?token=secret-token', disabledReason: 'private-disabled-detail', consecutiveFailures: 1 })],
      fetchLogs: [log({ sourceId: maliciousId, outcome: 'http_error', errorMessage: 'secret-stack-and-query' })],
    }))
    expect(report.annotations).toHaveLength(1)
    expect(report.annotations[0]).toContain('source%250A%0D%0A::error title=Injected::')
    expect(report.annotations[0]).not.toMatch(/[\r\n]/)
    expect(report.summaryMarkdown).toContain('&#124;&lt;script&gt;')
    const combined = `${report.summaryMarkdown}${report.annotations.join('')}`
    for (const secret of ['secret-password', 'secret-token', 'private-path', 'private-disabled-detail', 'secret-stack-and-query'])
      expect(combined).not.toContain(secret)
  })
})
