import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * The egress rule, exercised through the real config rather than described.
 *
 * `security-model.md` §1 states that `safeFetch` is the only way out of Zis, and
 * that the claim is held up by lint rather than by review. A check that has
 * never failed has not been verified — and this one is exactly the kind that can
 * stop running silently, since `next lint` disappeared in Next.js 16. So the
 * suite lints text through the project's own `eslint.config.ts` and asserts the
 * errors come back.
 */

const cwd = fileURLToPath(new URL('..', import.meta.url))

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ cwd })
})

async function ruleIdsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? [])
    .map(message => message.ruleId)
    .filter((ruleId): ruleId is string => ruleId !== null)
}

describe('a stray fetch', () => {
  it('fails in src/', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function get(url: string) { return fetch(url) }\n',
      'src/lib/stray.ts',
    )
    expect(ruleIds).toContain('no-restricted-globals')
  })

  it('fails in scripts/ too — the half that actually fetches', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function get(url: string) { return fetch(url) }\n',
      'scripts/pipeline/stray.ts',
    )
    expect(ruleIds).toContain('no-restricted-globals')
  })

  it('fails when it is spelled as a property of a global', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function get(url: string) { return globalThis.fetch(url) }\n',
      'src/lib/stray.ts',
    )
    expect(ruleIds).toContain('zis/no-direct-egress')
  })
})

describe('a second transport', () => {
  it('fails on a static import', async () => {
    const ruleIds = await ruleIdsFor(
      'import { request } from \'undici\'\n\nexport const send = request\n',
      'scripts/pipeline/stray.ts',
    )
    expect(ruleIds).toContain('no-restricted-imports')
  })

  it('fails on a dynamic import', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function load() { return import(\'node:https\') }\n',
      'src/lib/stray.ts',
    )
    expect(ruleIds).toContain('zis/no-direct-egress')
  })

  it('fails on a require', async () => {
    const ruleIds = await ruleIdsFor(
      'export const http = require(\'node:http\')\n',
      'scripts/pipeline/stray.ts',
    )
    expect(ruleIds).toContain('zis/no-direct-egress')
  })
})

describe('the scope is every file, not a list of roots', () => {
  it('fails in tests/ — a request at test time is still a request', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function get(url: string) { return fetch(url) }\n',
      'tests/stray.test.ts',
    )
    expect(ruleIds).toContain('no-restricted-globals')
  })

  it('fails in a root config file', async () => {
    const ruleIds = await ruleIdsFor(
      'export default async function config() { return fetch(\'https://example.com\') }\n',
      'stray.config.ts',
    )
    expect(ruleIds).toContain('no-restricted-globals')
  })
})

describe('the one exemption', () => {
  it('lets safeFetch itself reach the network', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function safeFetch(url: string) { return fetch(url) }\n',
      'src/lib/safe-fetch.ts',
    )
    expect(ruleIds).not.toContain('no-restricted-globals')
    expect(ruleIds).not.toContain('zis/no-direct-egress')
  })

  it('is granted to that path and no other', async () => {
    const ruleIds = await ruleIdsFor(
      'export async function safeFetch(url: string) { return fetch(url) }\n',
      'src/lib/safe-fetch-2.ts',
    )
    expect(ruleIds).toContain('no-restricted-globals')
  })
})
