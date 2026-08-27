import antfu from '@antfu/eslint-config'
import zis from './eslint-rules'

/**
 * `@antfu/eslint-config`, adopted as-is with `nextjs: true`. Nothing it decides
 * is overridden; the Zis rules below are composed on top of it.
 *
 * This config is reached by an explicit `eslint` step in CI. `next lint` is
 * removed in Next.js 16, so a workflow that leans on it enforces nothing while
 * still looking like it enforces something — which is worse than never having
 * had the rule, because `security-model.md` claims it is enforced.
 */

/**
 * The one module allowed to reach the network. It arrives with slice 1; the
 * exemption is written now so the rule below is complete rather than
 * provisional, and until that file exists the exemption covers nothing — which
 * is the safe direction to be wrong in.
 */
const SAFE_FETCH_MODULE = 'src/lib/safe-fetch.ts'

/** Lint covers `scripts/` as well as `src/` — docs/repo-and-ci.md §2 and §6. */
const EGRESS_SCOPE = ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}']

const BANNED_MODULES = [
  { name: 'undici', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'node:http', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'node:https', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'http', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'https', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'node:net', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'node:tls', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'node-fetch', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'axios', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'got', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
]

const BANNED_GLOBALS = [
  { name: 'fetch', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'XMLHttpRequest', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'EventSource', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
  { name: 'WebSocket', message: 'Every request in Zis goes through safeFetch — see security-model.md §1.' },
]

export default antfu(
  {
    type: 'app',
    nextjs: true,
    ignores: ['.scratch/**', 'drizzle/**', 'docs/**'],
  },
  {
    name: 'zis/egress',
    files: EGRESS_SCOPE,
    ignores: [SAFE_FETCH_MODULE],
    plugins: { zis },
    rules: {
      'no-restricted-globals': ['error', ...BANNED_GLOBALS],
      'no-restricted-imports': ['error', { paths: BANNED_MODULES }],
      'zis/no-direct-egress': 'error',
    },
  },
)
