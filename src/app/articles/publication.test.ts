import type { ArticleSummary } from '@/lib/articles/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DestinationNavigation } from '../destinations'
import { ArticleDirectory } from './directory'

const newest: ArticleSummary = {
  id: 'latest',
  title: 'A quieter chip',
  standfirst: 'How a smaller die saves energy.',
  sourceCount: 2,
  publishedAt: new Date('2026-11-08T00:00:00Z'),
  imageUrl: null,
}
const earlier = { ...newest, title: 'The power budget', id: 'earlier' }

it('opens the latest article from its headline and keeps earlier work available', () => {
  const html = renderToStaticMarkup(createElement(ArticleDirectory, { articles: [newest, earlier], home: true }))
  expect(html).toMatch(/<h1[^>]*><a[^>]*href="\/articles\/latest"[^>]*>A quieter chip/)
  expect(html).toContain(newest.standfirst)
  expect(html).toContain('href="/articles/earlier"')
  expect(html).toContain('href="/articles"')
})

it('exposes history and the author menu only for an author', () => {
  for (const role of ['author', 'reader'] as const) {
    const html = renderToStaticMarkup(createElement(DestinationNavigation, { role, current: '/' }))
    expect(html).toContain('href="/articles"')
    for (const link of ['/history', '/saved', '/settings'])
      expect(html.includes(`href="${link}"`)).toBe(role === 'author')
  }
})

it('numbers one reference across multiple citation occurrences and retains each excerpt at its claim', async () => {
  const { ArticleReader } = await import('./reader')
  const source = { title: 'Bench notes', publisher: 'Lab', url: 'https://lab.example.test/measurements' }
  const paragraphs = ['The first run.', 'A second run.', 'A final run.'].map((text, index) => ({
    text,
    citations: [{ ...source, excerpt: ['Four joules', 'Three joules'][index] ?? null }],
  }))
  const article = { ...newest, sourceCount: 1, sections: [{ heading: 'Results', paragraphs }] }
  const html = renderToStaticMarkup(createElement(ArticleReader, { article }))
  expect(html.match(/aria-label="Reference 1: Bench notes"/g)).toHaveLength(3)
  expect(html).toMatch(/The first run\.[\s\S]*Four joules[\s\S]*A second run\.[\s\S]*Three joules/)
  expect(html.match(/<blockquote/g)).toHaveLength(2)
  expect(html.match(/<dialog/g)).toHaveLength(3)
  expect(html.match(/href="https:\/\/lab.example.test\/measurements"/g)).toHaveLength(4)
})
