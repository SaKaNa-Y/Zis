import { describe, expect, it } from 'vitest'
import { findUnreadNames, parseEnvExample, SEARCH_ROOTS } from './env-example'

describe('parsing .env.example', () => {
  it('takes the names and ignores comments, blanks and values', () => {
    const example = [
      '# a comment mentioning IMAGINARY_VARIABLE',
      '',
      'DATABASE_URL=postgresql://user:password@host/db',
      'SESSION_SECRET=',
      '   GITHUB_PAT=   ',
    ].join('\n')
    expect(parseEnvExample(example)).toEqual(['DATABASE_URL', 'SESSION_SECRET', 'GITHUB_PAT'])
  })

  it('ignores an export prefix', () => {
    expect(parseEnvExample('export DEEPSEEK_API_KEY=sk-test')).toEqual(['DEEPSEEK_API_KEY'])
  })
})

describe('finding names nothing reads', () => {
  const sources = new Map([
    ['src/lib/env.ts', 'const url = process.env.DATABASE_URL\nconst pat = process.env[`GITHUB_PAT`]'],
    ['src/lib/env.test.ts', 'process.env.SESSION_SECRET'],
  ])

  it('passes a name that is read somewhere', () => {
    expect(findUnreadNames(['DATABASE_URL', 'GITHUB_PAT'], sources)).toEqual([])
  })

  it('counts the canonical accessor, which names the variable as a literal', () => {
    const accessor = new Map([['src/lib/env.ts', 'export const url = () => required(\'DATABASE_URL\')']])
    expect(findUnreadNames(['DATABASE_URL'], accessor)).toEqual([])
  })

  it('reports a name nothing reads', () => {
    expect(findUnreadNames(['DATABASE_URL', 'CLOUDFLARE_API_TOKEN'], sources))
      .toEqual(['CLOUDFLARE_API_TOKEN'])
  })

  it('does not count a name that only appears as a longer one', () => {
    const shadowed = new Map([['src/a.ts', 'process.env.DATABASE_URL_POOLED']])
    expect(findUnreadNames(['DATABASE_URL'], shadowed)).toEqual(['DATABASE_URL'])
  })

  it('does not count a mention in a comment as a read', () => {
    const commented = new Map([['src/a.ts', '// SESSION_SECRET is read elsewhere, honest\nconst x = 1']])
    expect(findUnreadNames(['SESSION_SECRET'], commented)).toEqual(['SESSION_SECRET'])
  })
})

describe('search roots', () => {
  it('covers scripts as well as src', () => {
    expect(SEARCH_ROOTS).toEqual(['src', 'scripts'])
  })
})
