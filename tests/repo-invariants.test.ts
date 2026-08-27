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
  jobs?: Record<string, { steps?: { name?: string, uses?: string, run?: string, with?: Record<string, unknown> }[] }>
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
})
