/**
 * The `.env.example` drift check.
 *
 * `.env.example` is the canonical list of every environment variable Zis has,
 * and a canonical list rots the moment a variable is retired from the code and
 * left in the file. So CI asserts the one direction that catches that: every
 * name in `.env.example` is read somewhere in source (docs/repo-and-ci.md §4).
 * Documentation does not catch drift; this does.
 *
 * A name counts as read if it appears outside a comment either as
 * `process.env.NAME` or as a string literal — the second because the canonical
 * accessor in `src/lib/env.ts` names its variables as literals rather than as
 * static property lookups.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Source is `src/` and `scripts/` both — the pipeline reads most of these. */
export const SEARCH_ROOTS = ['src', 'scripts']

export const ENV_EXAMPLE = '.env.example'

const SEARCHED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'drizzle'])

const ASSIGNMENT = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/

/** The names declared in `.env.example`, in file order. */
export function parseEnvExample(text: string): string[] {
  const names: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith('#'))
      continue
    const name = ASSIGNMENT.exec(line)?.[1]
    if (name !== undefined)
      names.push(name)
  }
  return names
}

/**
 * Comments do not count as reads — a name kept alive by the comment explaining
 * that it is used is exactly the drift this check exists to find.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function isReadIn(name: string, source: string): boolean {
  const reference = new RegExp(String.raw`process\.env\.${name}\b|['"\`]${name}['"\`]`)
  return reference.test(source)
}

/** The names in `names` that no file in `sources` reads. */
export function findUnreadNames(names: string[], sources: Map<string, string>): string[] {
  const stripped = [...sources.values()].map(stripComments)
  return names.filter(name => !stripped.some(source => isReadIn(name, source)))
}

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name))
        yield* walk(join(directory, entry.name))
      continue
    }
    if (SEARCHED_EXTENSIONS.some(extension => entry.name.endsWith(extension)))
      yield join(directory, entry.name)
  }
}

export function readSources(roots: string[] = SEARCH_ROOTS, cwd: string = process.cwd()): Map<string, string> {
  const sources = new Map<string, string>()
  for (const root of roots) {
    const absolute = join(cwd, root)
    if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory())
      throw new Error(`Search root ${root}/ does not exist`)
    for (const file of walk(absolute))
      sources.set(relative(cwd, file).split(sep).join('/'), readFileSync(file, 'utf8'))
  }
  return sources
}

function main(): void {
  const names = parseEnvExample(readFileSync(join(process.cwd(), ENV_EXAMPLE), 'utf8'))
  if (names.length === 0)
    throw new Error(`${ENV_EXAMPLE} declares no variables — it is the canonical list, so an empty one is a mistake`)

  const unread = findUnreadNames(names, readSources())
  if (unread.length > 0) {
    for (const name of unread)
      process.stderr.write(`${ENV_EXAMPLE}: ${name} is declared but read nowhere in ${SEARCH_ROOTS.map(root => `${root}/`).join(' or ')}\n`)

    process.stderr.write(
      `\n${unread.length} unread variable(s). Either something stopped reading them, or the list has drifted `
      + `— ${ENV_EXAMPLE} is the canonical list and has to stay true.\n`,
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(`env: all ${names.length} names in ${ENV_EXAMPLE} are read in source\n`)
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href)
  main()
