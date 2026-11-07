import { execFileSync, spawnSync } from 'node:child_process'
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
  concurrency?: { 'group'?: string, 'cancel-in-progress'?: boolean }
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

describe('legacy automated execution is retired', () => {
  it('has no automatic ingestion or translation triggers and no executable worker steps', () => {
    for (const file of ['ingest.yml', 'translate.yml']) {
      const source = readFileSync(join(workflowsDirectory, file), 'utf8')
      const workflow = parse(source) as Workflow
      expect(Object.keys(workflow.on ?? {})).toEqual(['workflow_dispatch'])
      expect(Object.keys(workflow.jobs ?? {})).toEqual(['retired'])
      const steps = Object.values(workflow.jobs ?? {}).flatMap(job => job.steps ?? [])
      expect(steps).toHaveLength(1)
      expect(steps[0]?.run).toMatch(/^echo '::notice::.* is retired/)
      expect(steps[0]?.uses).toBeUndefined()
      expect(steps[0]?.env).toBeUndefined()
      expect(source).not.toContain('secrets.')
    }
  })

  it('contains no current legacy Source configuration, including disabled RSS entries', () => {
    const register = JSON.parse(readFileSync(join(root, 'docs/source-register.json'), 'utf8'))
    expect(register.publishers).toEqual([])
    expect(register.totals).toEqual({ publishers: 0, sources: 0 })
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

describe('retired CLI entrypoints fail closed', () => {
  it.each(['run', 'translate'])('%s permits only a side-effect-free dry-run', (name) => {
    const script = join(root, 'scripts', 'pipeline', `${name}.ts`)
    const output = execFileSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), script, '--dry-run'], { cwd: root, encoding: 'utf8' })
    expect(output).toContain('retired; dry-run only; no work performed')
    // No database, model, cache, network or worker module can initialize at import time.
    const source = readFileSync(script, 'utf8')
    expect(source.match(/^import .*$/gm)).toEqual(['import process from \'node:process\''])
  })

  it.each(['run', 'translate'])('%s refuses real execution even with credentials supplied', (name) => {
    const result = spawnSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'scripts', 'pipeline', `${name}.ts`)], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: 'postgresql://retired:retired@127.0.0.1:1/retired', DEEPSEEK_API_KEY: 'test-retired-key', GITHUB_PAT: 'test-retired-token' },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('is retired. Use the capture flow; historical data is retained.')
    expect(result.stdout).toBe('')
  })
})

describe('security workflow boundaries', () => {
  it('pins external actions to immutable commits in every workflow', () => {
    for (const { workflow } of readWorkflows()) {
      for (const job of Object.values(workflow.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (step.uses && !step.uses.startsWith('./'))
            expect(step.uses).toMatch(/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/)
        }
      }
    }
  })

  it('gives CodeQL only source read and result upload, without application secrets or execution', () => {
    const source = readFileSync(join(workflowsDirectory, 'codeql.yml'), 'utf8')
    const workflow = parse(source)
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.analyze.permissions).toEqual({ 'contents': 'read', 'security-events': 'write' })
    expect(workflow.on).not.toHaveProperty('schedule')
    expect(source).not.toContain('secrets.')
    expect(workflow.jobs.analyze.steps.some((step: { run?: string }) => step.run)).toBe(false)
    expect(workflow.jobs.analyze.steps.find((step: { with?: Record<string, unknown> }) => step.with?.languages)?.with)
      .toMatchObject({ 'languages': 'javascript-typescript', 'build-mode': 'none' })
  })
})
