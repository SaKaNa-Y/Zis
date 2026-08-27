import { describe, expect, it } from 'vitest'
import { findPxViolations, SCAN_ROOTS } from './no-px'

/**
 * Every offending literal in this file is assembled at runtime by `px()`, so
 * that the file testing the scan is itself covered by the scan rather than
 * excluded from it. There is no exclusion list — see `no-px.ts`.
 */
function px(n: number): string {
  return `${n}p${'x'}`
}

describe('tailwind arbitrary values', () => {
  it('flags a type size', () => {
    const [found] = findPxViolations('src/a.tsx', `<p className="text-[${px(17)}]">`)
    expect(found?.text).toBe(`text-[${px(17)}]`)
    expect(found?.line).toBe(1)
  })

  it('flags a line-height, a tracking value and the measure', () => {
    const source = [
      `leading-[${px(20)}]`,
      `tracking-[${px(1)}]`,
      `max-w-[${px(600)}]`,
    ].join('\n')
    const found = findPxViolations('src/a.tsx', source)
    expect(found.map(v => v.line)).toEqual([1, 2, 3])
  })

  it('flags every spacing family, including the ones whose name contains px', () => {
    const source = [
      `p-[${px(4)}]`,
      `px-[${px(4)}]`,
      `my-[${px(4)}]`,
      `gap-[${px(4)}]`,
      `space-y-[${px(4)}]`,
      `mt-[${px(4)}]`,
    ].join('\n')
    expect(findPxViolations('src/a.tsx', source)).toHaveLength(6)
  })

  it('flags an arbitrary property that spells the declaration out', () => {
    const source = `<p className="[font-size:${px(17)}]">`
    expect(findPxViolations('src/a.tsx', source)).toHaveLength(1)
  })

  it('passes rem, ch and unitless values', () => {
    const source = '<p className="text-[1.0625rem] max-w-[33rem] leading-[1.6] gap-[2ch]">'
    expect(findPxViolations('src/a.tsx', source)).toEqual([])
  })

  it('passes a hairline border, which should not scale with zoom', () => {
    const source = `<hr className="border-t-[${px(1)}] outline-[${px(1)}]" />`
    expect(findPxViolations('src/a.tsx', source)).toEqual([])
  })
})

describe('css declarations', () => {
  it('flags type size, spacing and the measure', () => {
    const source = [
      `.a { font-size: ${px(17)}; }`,
      `.b { padding-block: ${px(8)}; }`,
      `.c { max-width: ${px(600)}; }`,
      `.d { line-height: ${px(24)}; }`,
    ].join('\n')
    expect(findPxViolations('src/a.css', source)).toHaveLength(4)
  })

  it('flags a px token in an @theme block', () => {
    const source = `@theme {\n  --text-body: ${px(17)};\n}`
    expect(findPxViolations('src/a.css', source)).toHaveLength(1)
  })

  it('passes border and outline widths', () => {
    const source = [
      `.a { border-bottom: ${px(1)} solid var(--color-rule); }`,
      `.b { border-width: ${px(1)}; }`,
      `.c { outline: ${px(2)} solid var(--color-accent); }`,
    ].join('\n')
    expect(findPxViolations('src/a.css', source)).toEqual([])
  })

  it('passes a media query, which is neither type, spacing nor the measure', () => {
    const source = `@media (min-width: ${px(640)}) {\n  .a { font-size: 1rem; }\n}`
    expect(findPxViolations('src/a.css', source)).toEqual([])
  })
})

describe('inline style objects', () => {
  it('flags a px value on a type or spacing property', () => {
    const source = `<p style={{ fontSize: '${px(17)}', marginTop: '${px(8)}' }}>`
    expect(findPxViolations('src/a.tsx', source)).toHaveLength(2)
  })

  it('passes a px value on a border width', () => {
    const source = `<p style={{ borderTopWidth: '${px(1)}' }}>`
    expect(findPxViolations('src/a.tsx', source)).toEqual([])
  })
})

describe('scan roots', () => {
  it('covers scripts as well as src, or the rule is enforced on the wrong half', () => {
    expect(SCAN_ROOTS).toEqual(['src', 'scripts'])
  })
})
