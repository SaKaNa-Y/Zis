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

/**
 * Every JavaScript and TypeScript file, not a list of roots.
 *
 * `security-model.md` §1 bans an exemption list, "because an exemption list is
 * the shape a bypass path takes" — and a scope list is an exemption list with a
 * friendlier name. Scoping to `src/` and `scripts/` would have left `tests/` and
 * the root config files free to fetch, which is the same half-enforced state the
 * rule exists to prevent. Lint and typecheck cover `scripts/` as required by
 * docs/repo-and-ci.md §2 and §6; this covers everything else too.
 */
const EGRESS_SCOPE = ['**/*.{js,mjs,cjs,jsx,ts,tsx}']

const REASON = 'Every request in Zis goes through safeFetch — see security-model.md §1.'

/** Transports. Importing one is asking for a second way out. */
const BANNED_MODULES = [
  'undici',
  'node:http',
  'node:https',
  'http',
  'https',
  'node:net',
  'node:tls',
  'node-fetch',
  'axios',
  'got',
].map(name => ({ name, message: REASON }))

/** Globals that reach the network, whether or not they are called `fetch`. */
const BANNED_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'EventSource',
  'WebSocket',
].map(name => ({ name, message: REASON }))

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
