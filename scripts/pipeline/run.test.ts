import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  prepareModel: vi.fn(),
  ingest: vi.fn(),
  translator: vi.fn(),
  safeFetch: vi.fn(),
  network: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mocks.database }))
vi.mock('@/lib/embeddings/transformers', () => ({ prepareTransformersModelCache: mocks.prepareModel }))
vi.mock('@/lib/ingestion/postgres', () => ({ runNeonIngestion: mocks.ingest }))
vi.mock('@/lib/translations/provider', () => ({ createTranslator: mocks.translator }))
vi.mock('@/lib/safe-fetch', () => ({ safeFetch: mocks.safeFetch }))

let directory: string
let summaryPath: string
let output: string[]
let previousExitCode: typeof process.exitCode
let previousArgv: string[]

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  directory = await mkdtemp(join(tmpdir(), 'zis-retired-pipeline-'))
  summaryPath = join(directory, 'summary.md')
  vi.stubEnv('GITHUB_STEP_SUMMARY', summaryPath)
  vi.stubEnv('DATABASE_URL', 'postgresql://test-only-sensitive-credential@example.invalid/db')
  vi.stubEnv('GITHUB_PAT', 'test-only-sensitive-github-token')
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-sensitive-model-token')
  vi.stubGlobal('fetch', mocks.network)
  previousExitCode = process.exitCode
  previousArgv = process.argv
  process.exitCode = 0
  output = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output.push(String(chunk))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    output.push(String(chunk))
    return true
  })
})

afterEach(async () => {
  process.exitCode = previousExitCode
  process.argv = previousArgv
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})

function expectNoWork() {
  for (const mock of Object.values(mocks))
    expect(mock).not.toHaveBeenCalled()
  expect(existsSync(summaryPath)).toBe(false)
  expect(output.join('')).not.toContain('test-only-sensitive')
}

describe.each(['run', 'translate'] as const)('retired %s entrypoint', (entrypoint) => {
  async function execute(args: string[]) {
    process.argv = ['node', `scripts/pipeline/${entrypoint}.ts`, ...args]
    if (entrypoint === 'run')
      await import('./run')
    else
      await import('./translate')
  }

  it.each([{ args: [] }, { args: ['--force'] }])('refuses real execution with arguments $args before any database, model or network work', async ({ args }) => {
    await execute(args)
    expect(process.exitCode).toBe(1)
    expect(output.join('')).toContain('is retired. Use the capture flow; historical data is retained.')
    expectNoWork()
  })

  it('retains a side-effect-free dry-run diagnostic', async () => {
    await execute(['--dry-run'])
    expect(process.exitCode).toBe(0)
    expect(output.join('')).toContain('retired; dry-run only; no work performed.')
    expectNoWork()
  })

  it('reports retirement before credentials are required', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    await execute([])
    expect(process.exitCode).toBe(1)
    expect(output.join('')).toContain('is retired.')
    expectNoWork()
  })
})
