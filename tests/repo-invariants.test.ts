import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

/**
 * The repository-shaped decisions from `docs/repo-and-ci.md`, asserted rather
 * than described. Each one here is a claim another document already leans on.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const workflowsDirectory = join(root, '.github', 'workflows')

interface Workflow {
  on?: Record<string, unknown>
  jobs?: Record<string, { steps?: { name?: string, uses?: string, run?: string, with?: Record<string, unknown>, env?: Record<string, string> }[] }>
}

function readWorkflows(): { file: string, workflow: Workflow }[] {
  return readdirSync(workflowsDirectory)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => ({ file, workflow: parse(readFileSync(join(workflowsDirectory, file), 'utf8')) as Workflow }))
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  engines: { node: string, pnpm: string }
  packageManager: string
}

describe('the runtime is pinned in three places', () => {
  const major = '22'

  it('.nvmrc says Node 22', () => {
    expect(readFileSync(join(root, '.nvmrc'), 'utf8').trim()).toBe(major)
  })

  it('package.json engines says the same', () => {
    expect(packageJson.engines.node).toBe(`${major}.x`)
  })

  it('every setup-node in every workflow says the same', () => {
    const versions = readWorkflows().flatMap(({ workflow }) =>
      Object.values(workflow.jobs ?? {})
        .flatMap(job => job.steps ?? [])
        .filter(step => step.uses?.startsWith('actions/setup-node') === true)
        .map(step => String(step.with?.['node-version'] ?? '')),
    )
    expect(versions.length).toBeGreaterThan(0)
    for (const version of versions)
      expect(version).toBe(major)
  })

  it('pnpm is pinned by packageManager, which is what the workflow installs from', () => {
    expect(packageJson.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/)
    const [, pinned] = /^pnpm@(\d+)\./.exec(packageJson.packageManager) ?? []
    expect(packageJson.engines.pnpm).toBe(`${pinned}.x`)
  })
})

describe('no workflow is scheduled', () => {
  it('has no schedule trigger anywhere', () => {
    // ADR-0010 makes publication one-way and the cron is gated behind the public
    // flip. A `schedule:` that arrives before that gate spends the budget the
    // gate exists to protect.
    for (const { file, workflow } of readWorkflows()) {
      const triggers = Object.keys(workflow.on ?? {})
      expect(triggers, file).not.toHaveLength(0)
      expect(triggers, file).not.toContain('schedule')
    }
  })

  it('keeps ingestion manual and migrations out of the runner', () => {
    const ingest = parse(readFileSync(join(workflowsDirectory, 'ingest.yml'), 'utf8')) as Workflow
    expect(Object.keys(ingest.on ?? {})).toEqual(['workflow_dispatch'])

    const steps = Object.values(ingest.jobs ?? {}).flatMap(job => job.steps ?? [])
    expect(steps.map(step => step.run)).toContain('pnpm exec tsx scripts/pipeline/run.ts')
    expect(steps.some(step => /db:migrate|drizzle-kit\s+migrate/.test(step.run ?? ''))).toBe(false)
    expect(steps.find(step => step.run === 'pnpm exec tsx scripts/pipeline/run.ts')?.env)
      .toHaveProperty('DATABASE_URL')
  })

  it('never gives the Vercel-only session secret to GitHub Actions', () => {
    for (const file of readdirSync(workflowsDirectory)) {
      if (!file.endsWith('.yml') && !file.endsWith('.yaml'))
        continue
      expect(readFileSync(join(workflowsDirectory, file), 'utf8'), file)
        .not
        .toContain('SESSION_SECRET')
    }
  })
})

describe('authentication code stays on the server', () => {
  it.each([
    'src/lib/auth/credentials.ts',
    'src/lib/auth/dal.ts',
    'src/lib/auth/postgres.ts',
    'src/lib/auth/session.ts',
  ])('%s carries the server-only boundary', (file) => {
    expect(readFileSync(join(root, file), 'utf8')).toContain('import \'server-only\'')
  })
})

describe('ci is one sequential job, cheapest first', () => {
  const ci = parse(readFileSync(join(workflowsDirectory, 'ci.yml'), 'utf8')) as Workflow

  it('is a single job — three parallel ones bill three minutes', () => {
    expect(Object.keys(ci.jobs ?? {})).toHaveLength(1)
  })

  it('runs typecheck, then lint, then the px scan, then the tests', () => {
    const commands = Object.values(ci.jobs ?? {})
      .flatMap(job => job.steps ?? [])
      .map(step => step.run)
      .filter((run): run is string => run !== undefined)

    const order = ['pnpm typecheck', 'pnpm lint', 'pnpm check:no-px', 'pnpm test']
      .map(command => commands.indexOf(command))

    expect(order).not.toContain(-1)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('runs the .env.example drift check', () => {
    const commands = Object.values(ci.jobs ?? {}).flatMap(job => job.steps ?? []).map(step => step.run)
    expect(commands).toContain('pnpm check:env')
  })
})

describe('the pipeline imports the shared modules rather than copying them', () => {
  it('resolves src/lib under tsx with the app\'s own tsconfig', () => {
    const output = execFileSync(
      process.execPath,
      [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'scripts', 'pipeline', 'run.ts'), '--dry-run'],
      { cwd: root, encoding: 'utf8' },
    )
    expect(output).toContain('shared modules resolve')
  })

  it('surfaces dormant Sources for manual review in the Actions log', () => {
    const runner = readFileSync(join(root, 'scripts', 'pipeline', 'run.ts'), 'utf8')
    expect(runner).toContain('graph.dormantSourceIds')
    expect(runner).toContain('::warning title=Dormant Source::')
  })

  it('warms the local model cache before the first Neon query', () => {
    const runner = readFileSync(join(root, 'scripts', 'pipeline', 'run.ts'), 'utf8')
    const cacheWarm = runner.indexOf('await prepareTransformersModelCache(safeFetch)')
    const neonWake = runner.indexOf('await runNeonIngestion(')

    expect(cacheWarm).toBeGreaterThan(-1)
    expect(neonWake).toBeGreaterThan(-1)
    expect(cacheWarm).toBeLessThan(neonWake)
  })

  it('reports the complete stage order and the timed Neon wake through prune', () => {
    const runner = readFileSync(join(root, 'scripts', 'pipeline', 'run.ts'), 'utf8')
    const expectedStages = [
      'stage 0 assertion',
      'select due',
      'fetch',
      'normalize',
      'hydrate',
      'canonicalize',
      'citation-worthiness',
      'alias merge',
      'strength',
      'embed',
      'match',
      'admission',
      'cut',
      'order',
      'prune',
    ]

    let previousStage = -1
    for (const stage of expectedStages) {
      const stageIndex = runner.indexOf(`'${stage}'`)
      expect(stageIndex).toBeGreaterThan(previousStage)
      previousStage = stageIndex
    }

    expect(runner).toMatch(/PIPELINE_STAGE_ORDER\.join\(' -> '\)/)
    expect(runner).toMatch(/zis pipeline stage order: \$\{PIPELINE_STAGE_ORDER\.join\(' -> '\)\}/)
    expect(runner).toContain('const NEON_WAKE_BUDGET_MS = 120_000')
    expect(runner).toContain('const neonWakeStartedAt = Date.now()')
    expect(runner).toContain('const neonWakeElapsedMs = Date.now() - neonWakeStartedAt')
    expect(runner).toMatch(/zis pipeline Neon wake through prune: \$\{neonWakeElapsedMs\} ms/)
    expect(runner).toMatch(/budget \$\{NEON_WAKE_BUDGET_MS\} ms/)
    expect(runner).toContain('if (neonWakeElapsedMs > NEON_WAKE_BUDGET_MS)')
    expect(runner).toContain('::warning title=Neon wake budget exceeded::')
    expect(runner).toContain('from the first Neon query through completed prune')

    const cacheWarm = runner.indexOf('await prepareTransformersModelCache(safeFetch)')
    const timerStart = runner.indexOf('const neonWakeStartedAt = Date.now()')
    const neonWake = runner.indexOf('await runNeonIngestion(')
    const timerStop = runner.indexOf('const neonWakeElapsedMs = Date.now() - neonWakeStartedAt')

    expect(cacheWarm).toBeLessThan(timerStart)
    expect(timerStart).toBeLessThan(neonWake)
    expect(neonWake).toBeLessThan(timerStop)
  })
})
