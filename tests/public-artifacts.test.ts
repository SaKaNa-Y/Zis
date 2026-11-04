import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('keeps bearer access-token query parameters out of the published calibration artifact', () => {
  const artifact = readFileSync('.scratch/zis/prototype/PROTOTYPE-calibration/findings.json', 'utf8')
  // Do not include the original token in a fixture or an assertion failure.
  expect(/[?&](?:amp;)?access_?token=/i.test(artifact)).toBe(false)
})
