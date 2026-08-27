/**
 * Walking the source tree, shared by both checks.
 *
 * They must agree on what "source" means. If the no-`px` scan and the
 * `.env.example` check each carried their own walk, one could quietly stop
 * covering a directory the other still covered, and the half-enforced result
 * would read exactly like the enforced one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import process from 'node:process'

/**
 * Both checks cover `scripts/` as well as `src/`, per docs/repo-and-ci.md §2:
 * covering only `src/` enforces a rule on the half of the tree that renders
 * nothing and fetches nothing.
 */
export const SOURCE_ROOTS = ['src', 'scripts']

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'drizzle'])

function* walk(directory: string, extensions: string[]): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name))
        yield* walk(join(directory, entry.name), extensions)
      continue
    }
    if (extensions.some(extension => entry.name.endsWith(extension)))
      yield join(directory, entry.name)
  }
}

/**
 * Every file under `roots` with one of `extensions`, keyed by its
 * forward-slashed path relative to `cwd` so that a reported location reads the
 * same on Windows as it does on the runner.
 *
 * A missing root throws rather than passing vacuously — a check that silently
 * scans nothing is the failure mode both of these exist to prevent.
 */
export function readSourceFiles(
  extensions: string[],
  roots: string[] = SOURCE_ROOTS,
  cwd: string = process.cwd(),
): Map<string, string> {
  const files = new Map<string, string>()
  for (const root of roots) {
    const absolute = join(cwd, root)
    if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory())
      throw new Error(`Source root ${root}/ does not exist`)
    for (const file of walk(absolute, extensions))
      files.set(relative(cwd, file).split(sep).join('/'), readFileSync(file, 'utf8'))
  }
  return files
}
