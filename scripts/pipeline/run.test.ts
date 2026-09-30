import type { IngestionSource } from '@/lib/ingestion/pipeline'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  prepareModel: vi.fn(),
  embeddingProvider: vi.fn(),
  ingest: vi.fn(),
  snapshot: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mocks.database }))
vi.mock('@/lib/embeddings/transformers', () => ({
  prepareTransformersModelCache: mocks.prepareModel,
  createTransformersEmbeddingProvider: mocks.embeddingProvider,
}))
vi.mock('@/lib/ingestion/postgres', () => ({ runNeonIngestion: mocks.ingest }))
vi.mock('@/lib/ingestion/health-snapshot', () => ({ readIngestionHealthSnapshot: mocks.snapshot }))

let directory: string
let summaryPath: string
let output: string[]
let previousExitCode: typeof process.exitCode
let previousArgv: string[]

function source(overrides: Partial<IngestionSource> = {}): IngestionSource {
  return { id: '00000000-0000-4000-8000-000000000001', publisherId: '00000000-0000-4000-8000-000000000002', transport: 'rss', endpointUrl: 'https://source.example/feed', isAggregator: false, disabledAt: null, disabledReason: null, consecutiveFailures: 0, retryAfterAt: null, lastPolledAt: null, newestItemAt: null, createdAt: new Date('2026-09-01T00:00:00Z'), ...overrides }
}

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  directory = await mkdtemp(join(tmpdir(), 'zis-run-health-'))
  summaryPath = join(directory, 'summary.md')
  vi.stubEnv('GITHUB_STEP_SUMMARY', summaryPath)
  vi.stubEnv('DATABASE_URL', 'postgresql://test-only-sensitive-credential@example.invalid/db')
  vi.stubEnv('GITHUB_PAT', 'test-only-sensitive-github-token')
  previousExitCode = process.exitCode
  previousArgv = process.argv
  process.exitCode = 0
  process.argv = ['node', 'scripts/pipeline/run.ts']
  output = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output.push(String(chunk))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    output.push(String(chunk))
    return true
  })
  mocks.database.mockReturnValue({})
  mocks.prepareModel.mockResolvedValue(undefined)
  mocks.embeddingProvider.mockReturnValue({})
  mocks.ingest.mockResolvedValue({ sources: [source()], fetchLogs: [], items: [], dormantSourceIds: [] })
  mocks.snapshot.mockResolvedValue({ sources: [source()], fetchLogs: [], briefStatus: 'confirmed' })
})

afterEach(async () => {
  process.exitCode = previousExitCode
  process.argv = previousArgv
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

async function runAndReadSummary(): Promise<string> {
  await import('./run')
  let summary = ''
  await vi.waitFor(async () => {
    summary = await readFile(summaryPath, 'utf8')
    expect(summary).toContain('Database transaction retries: 0.')
  })
  return summary
}

describe('pipeline entrypoint health reporting', () => {
  it('fails after a permanent ingestion error and keeps unknown Source state distinct from a healthy empty inventory', async () => {
    mocks.ingest.mockRejectedValue(new Error('private SQL parameters and reader Interest text'))
    mocks.snapshot.mockRejectedValue(new Error('private database URL and stack'))
    const summary = await runAndReadSummary()
    await vi.waitFor(() => expect(process.exitCode).toBe(1))
    expect(summary).toContain('Wake: **failed**')
    expect(summary).toContain('Source health is unknown')
    expect(summary).not.toContain('0 configured Sources')
    expect(output.join('')).toContain('::error title=Ingestion incomplete::')
    expect(`${summary}${output.join('')}`).not.toContain('private')
    expect(`${summary}${output.join('')}`).not.toContain('test-only-sensitive')
  })

  it('fails a completed ingestion when the expected daily Brief is missing', async () => {
    mocks.snapshot.mockResolvedValue({ sources: [source()], fetchLogs: [], briefStatus: 'missing' })
    const summary = await runAndReadSummary()
    await vi.waitFor(() => expect(process.exitCode).toBe(1))
    expect(summary).toContain('Wake: **completed**')
    expect(summary).toContain('Daily Brief: **missing**')
    expect(output.join('')).toContain('::error title=Daily Brief missing::')
  })

  it('warns about a disabled Source without failing a completed run with a confirmed Brief', async () => {
    mocks.snapshot.mockResolvedValue({ sources: [source({ disabledAt: new Date(), disabledReason: 'automatically disabled after 10 consecutive failures', consecutiveFailures: 10 })], fetchLogs: [], briefStatus: 'confirmed' })
    const summary = await runAndReadSummary()
    expect(process.exitCode).toBe(0)
    expect(summary).toContain('1 disabled; 1 require attention; 0 confirmed successful this wake')
    expect(output.join('')).toContain('::warning title=Source needs attention::')
    expect(output.join('')).not.toContain('::error')
  })

  it('identifies a missing preflight credential without starting ingestion or printing credential values', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const summary = await runAndReadSummary()
    await vi.waitFor(() => expect(process.exitCode).toBe(1))
    expect(mocks.prepareModel).not.toHaveBeenCalled()
    expect(mocks.database).not.toHaveBeenCalled()
    expect(mocks.ingest).not.toHaveBeenCalled()
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(output.join('')).toContain('DATABASE_URL')
    expect(summary).toContain('Source health is unknown')
    expect(`${summary}${output.join('')}`).not.toContain('test-only-sensitive')
  })
})
