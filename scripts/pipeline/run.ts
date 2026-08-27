/**
 * The pipeline the Actions runner executes, under `tsx`, with the app's own
 * `tsconfig`.
 *
 * It imports the shared modules from `src/lib/` **directly** through the `@/`
 * alias. That is the whole point of this file existing in slice 0 with nothing
 * to run: a copy of `safeFetch` in a standalone script would be a second egress
 * that the lint rule never sees, and `security-model.md` §1's claim that
 * `safeFetch` is the only way out would quietly be false
 * (docs/repo-and-ci.md §6). `--dry-run` resolves the seam and exits, which is
 * what the repo-invariant test exercises.
 *
 * Nothing fetches yet. The stages below are named, not implemented.
 */

import process from 'node:process'
import * as env from '@/lib/env'

/** The Actions-side variable set (docs/repo-and-ci.md §4). */
const ACTIONS_ENV = [
  env.databaseUrl,
  env.deepseekApiKey,
  env.cloudflareAccountId,
  env.cloudflareApiToken,
  env.githubPat,
]

function main(argv: string[]): void {
  if (argv.includes('--dry-run')) {
    process.stdout.write('zis pipeline: shared modules resolve; no stage is implemented yet\n')
    return
  }

  // Fail closed on a runner that is missing any of its variables, before
  // anything wakes the database.
  for (const read of ACTIONS_ENV)
    read()

  throw new Error('No pipeline stage is implemented yet — run with --dry-run')
}

main(process.argv.slice(2))
