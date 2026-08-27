/**
 * The no-`px` scan.
 *
 * ADR-0009 answers "where is the text-size control?" with "the platform already
 * ships a better one", and that answer holds only while every size in the
 * product is `rem` or `ch`: browser zoom and the OS root font size then scale
 * the type and the 33rem measure together. A single arbitrary type size in
 * pixels breaks that silently, on a surface with no test that would notice — so
 * it is a CI invariant rather than a review item.
 *
 * It is a standalone scan rather than an ESLint rule on purpose
 * (docs/repo-and-ci.md §2). The sizes live in Tailwind class strings and CSS,
 * which ESLint reads poorly; forcing them into ESLint is how the rule ends up
 * half-enforced, and a half-enforced check is worse than an absent one because
 * ADR-0009 cites it as enforced.
 *
 * `px` remains permitted for hairline borders and outlines, which should *not*
 * scale with zoom, and inside media-query conditions, which are none of type
 * size, line-height, spacing or the measure.
 *
 * There is no exclusion list. This file and its test are scanned like every
 * other: the patterns below never spell a `px` length literally, and the test
 * assembles its fixtures at runtime.
 */

import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { readSourceFiles, SOURCE_ROOTS } from './tree'

/** Re-exported so the roots this check covers are assertable on their own. */
export const SCAN_ROOTS = SOURCE_ROOTS

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']

export interface PxViolation {
  file: string
  line: number
  column: number
  text: string
  reason: string
}

/** A `px` length: a number immediately followed by the unit. */
const PX_LENGTH = /(?:^|[^\w.])(?:\d+(?:\.\d+)?|\.\d+)px\b/

/**
 * Tailwind utilities whose arbitrary value is a type size, a line-height, a
 * spacing step or the measure. Longer names first so that `max-w` is not read
 * as `w` — the lookbehind also refuses a utility glued to a prefix, which is
 * what keeps `border-t-[…]` out.
 */
const TAILWIND_UTILITY = /(?<![\w-])(?:text|leading|tracking|indent|max-w|min-w|max-h|min-h|space-x|space-y|gap-x|gap-y|scroll-p[trblxyse]?|scroll-m[trblxyse]?|gap|size|basis|inset-x|inset-y|inset|top|right|bottom|left|p[trblxyse]?|m[trblxyse]?|w|h)-\[([^\]\s]*)\]/g

/** `[font-size:…]` — the same sizes, spelled as an arbitrary property. */
const ARBITRARY_PROPERTY = /\[(font-size|line-height|letter-spacing|word-spacing|text-indent|margin[\w-]*|padding[\w-]*|row-gap|column-gap|gap|width|min-width|max-width|height|min-height|max-height):([^\]]*)\]/g

/** `style={{ fontSize: '…' }}` — the same sizes, spelled in JavaScript. */
const STYLE_OBJECT_PROPERTY = /\b(fontSize|lineHeight|letterSpacing|wordSpacing|textIndent|margin[A-Z]\w*|margin|padding[A-Z]\w*|padding|rowGap|columnGap|gap|width|minWidth|maxWidth|height|minHeight|maxHeight|inset|top|right|bottom|left)\s*:\s*['"`]([^'"`]*)['"`]/g

/** A CSS declaration, including custom properties. */
const CSS_DECLARATION = /(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}]*)/g

/**
 * The exception, and the only one: a hairline border or outline should not
 * scale with zoom. Shadows are decoration and carry no information either.
 */
const HAIRLINE_PROPERTY = /(?:^|[-_])(?:border|outline|ring|divide|shadow)(?:$|[-_A-Z])/i

/** At-rule preludes — a breakpoint in `px` is not a size the reader reads. */
const AT_RULE_PRELUDE = /@(?:media|container|supports)[^{]*/g

function hasPxLength(value: string): boolean {
  return PX_LENGTH.test(value)
}

function positionOf(source: string, index: number): { line: number, column: number } {
  const before = source.slice(0, index)
  const line = before.split('\n').length
  const column = index - (before.lastIndexOf('\n') + 1) + 1
  return { line, column }
}

/**
 * Every `px` length in `source` that ADR-0009 forbids. Pure, so that the rule
 * itself is unit-tested rather than only exercised against the tree.
 */
export function findPxViolations(filePath: string, source: string): PxViolation[] {
  const violations: PxViolation[] = []
  const isCss = filePath.endsWith('.css')

  const add = (index: number, text: string, reason: string): void => {
    const { line, column } = positionOf(source, index)
    violations.push({ file: filePath, line, column, text: text.trim(), reason })
  }

  for (const match of source.matchAll(TAILWIND_UTILITY)) {
    const [text, value] = match
    if (hasPxLength(value ?? '') && !HAIRLINE_PROPERTY.test(text))
      add(match.index, text, 'a Tailwind size in px — use rem or ch')
  }

  for (const match of source.matchAll(ARBITRARY_PROPERTY)) {
    const [text, property, value] = match
    if (hasPxLength(value ?? '') && !HAIRLINE_PROPERTY.test(property ?? ''))
      add(match.index, text, 'an arbitrary property in px — use rem or ch')
  }

  if (!isCss) {
    for (const match of source.matchAll(STYLE_OBJECT_PROPERTY)) {
      const [text, property, value] = match
      if (hasPxLength(value ?? '') && !HAIRLINE_PROPERTY.test(property ?? ''))
        add(match.index, text, 'an inline style in px — use rem or ch')
    }
  }

  if (isCss) {
    // Blank the at-rule preludes rather than dropping them, so reported
    // positions still point at the real line and column.
    const declarations = source.replace(AT_RULE_PRELUDE, prelude => ' '.repeat(prelude.length))
    for (const match of declarations.matchAll(CSS_DECLARATION)) {
      const [, property, value] = match
      if (property === undefined || value === undefined)
        continue
      if (hasPxLength(value) && !HAIRLINE_PROPERTY.test(property)) {
        const index = match.index + match[0].indexOf(property)
        add(index, `${property}: ${value}`, 'a CSS length in px — use rem or ch')
      }
    }
  }

  return violations
}

export function scan(roots: string[] = SCAN_ROOTS, cwd: string = process.cwd()): PxViolation[] {
  return [...readSourceFiles(SCANNED_EXTENSIONS, roots, cwd)]
    .flatMap(([file, source]) => findPxViolations(file, source))
}

function main(): void {
  const violations = scan()
  for (const violation of violations)
    process.stderr.write(`${violation.file}:${violation.line}:${violation.column}  ${violation.text}  — ${violation.reason}\n`)

  if (violations.length > 0) {
    process.stderr.write(
      `\n${violations.length} px violation(s). ADR-0009: no px in type size, line-height, `
      + 'spacing or the measure — browser zoom is the text-size control, and this scan is what keeps it working.\n',
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(`no-px: clean across ${SCAN_ROOTS.map(root => `${root}/`).join(' and ')}\n`)
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href)
  main()
