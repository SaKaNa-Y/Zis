import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// Guard the resolved graphs, not only direct dependency ranges: both the app
// and the archived standalone prototype previously retained vulnerable copies.
const lockfiles = ['pnpm-lock.yaml', '.scratch/zis/prototype/PROTOTYPE-calibration/pnpm-lock.yaml']

function atLeast(version: number[], minimum: number[]) {
  for (let index = 0; index < 3; index++) {
    if (version[index] !== minimum[index])
      return version[index]! > minimum[index]!
  }
  return true
}

describe.each(lockfiles)('security floors in %s', (file) => {
  const lock = parse(readFileSync(file, 'utf8')) as { packages: Record<string, unknown> }
  const packages = Object.keys(lock.packages)

  it('excludes versions affected by the September 2026 advisories', () => {
    const affected = packages.filter((key) => {
      const match = /^(next|undici|sharp|esbuild|js-yaml|brace-expansion)@(\d+)\.(\d+)\.(\d+)$/.exec(key)
      if (!match)
        return false
      const version = match.slice(2).map(Number)
      switch (match[1]) {
        case 'next':
          return !atLeast(version, [16, 3, 6]) // GHSA-vcvr-r3jv-pc5j (16.x line)
        case 'undici':
          // The application uses the 8.x line; GHSA-3xpg-4rpp-hhhm et al.
          return !atLeast(version, [8, 10, 2])
        case 'sharp':
          // GHSA-rgj7-g3m4-5g8c also subsumes GHSA-f88m-g3jw-g9cj.
          return !atLeast(version, [0, 35, 4])
        case 'esbuild':
          return !atLeast(version, [0, 25, 0]) // GHSA-67mh-4wv8-2f99
        case 'js-yaml':
          // GHSA-2883-xcg3-v3hh has separate patched 3.x and 4.x lines.
          return version[0] === 3 ? !atLeast(version, [3, 15, 2]) : version[0] === 4 && !atLeast(version, [4, 3, 2])
        case 'brace-expansion':
          // GHSA-q2hr-2g5m-vwhr and the two related recursion advisories.
          if (version[0] === 1)
            return !atLeast(version, [1, 1, 21])
          if (version[0] === 2)
            return !atLeast(version, [2, 1, 7])
          if (version[0] === 3)
            return !atLeast(version, [3, 0, 9])
          return !atLeast(version, [5, 0, 12])
        default:
          return false
      }
    })
    expect(affected).toEqual([])
  })
})
