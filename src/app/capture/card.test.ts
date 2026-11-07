import type { CaptureCard } from '@/lib/capture/model'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InformationCard } from './card'

const card: CaptureCard = {
  sourceKind: 'blog',
  id: 'card1',
  sourceId: 'source1',
  sourceName: 'Example',
  title: 'Original title',
  author: 'Author',
  originalUrl: 'https://example.com/post',
  threadUrl: 'https://example.com/post',
  publishedAt: '2026-11-01T00:00:00Z',
  capturedAt: '2026-11-02T00:00:00Z',
  updatedAt: '2026-11-03T00:00:00Z',
  expiresAt: '2026-11-09T00:00:00Z',
  incompleteReason: 'Missing second image',
  continuationOf: 'https://example.com/old-thread',
  images: [{ id: 'image1', alt: 'Original chart' }],
  posts: [{ url: 'https://example.com/post', publishedAt: '2026-11-01T00:00:00Z', body: '# Heading\n\nFull **original** text.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![external](https://tracker.example/pixel)' }],
}

describe('information card reading', () => {
  it('preserves rich original text and exposes update, expiry and missing-content context', () => {
    const html = renderToStaticMarkup(createElement(InformationCard, { card, t: en => en }))
    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<strong>original</strong>')
    expect(html).toContain('<table>')
    expect(html).toContain('Missing second image')
    expect(html).toContain('Continuation of an expired thread')
    expect(html).toContain('Original position retained')
    expect(html).toContain('2026-11-09 00:00')
    expect(html).toContain('src="/capture/images/image1"')
  })

  it('preserves literal X punctuation, HTML-looking text and line breaks', () => {
    const literal = '<tag> *not emphasis*\nsecond line'
    const html = renderToStaticMarkup(createElement(InformationCard, { card: { ...card, sourceKind: 'x', posts: [{ ...card.posts[0]!, body: literal }] }, t: en => en }))
    expect(html).toContain('&lt;tag&gt; *not emphasis*\nsecond line')
    expect(html).not.toContain('<em>')
  })

  it('places blog attachment references inside the original text', () => {
    const html = renderToStaticMarkup(createElement(InformationCard, { card: { ...card, posts: [{ ...card.posts[0]!, body: 'Before\n\n![chart](attachment:1)\n\nAfter' }] }, t: en => en }))
    expect(html.indexOf('Before')).toBeLessThan(html.indexOf('src="/capture/images/image1"'))
    expect(html.indexOf('src="/capture/images/image1"')).toBeLessThan(html.indexOf('After'))
  })

  it('does not execute raw HTML, unsafe links or remote tracking images', () => {
    const html = renderToStaticMarkup(createElement(InformationCard, { card, t: en => en }))
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('src="https://tracker.example')
  })
})
