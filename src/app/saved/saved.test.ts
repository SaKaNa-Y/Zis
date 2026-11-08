import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import SavedPage from './page'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/bookmarks/server', () => ({ readArchivedBookmarks: read }))
vi.mock('@/lib/i18n/server', () => ({ readLocale: async () => ({ language: 'en', t: (en: string) => en }) }))
vi.mock('../destinations', () => ({ DestinationNavigation: () => null }))

it('renders summary-only bookmarks as text with a link to the original', async () => {
  read.mockResolvedValue({ entries: [{
    id: 'abc',
    title: 'Original',
    body: null,
    summary: '<img src=x>',
    url: 'https://example.org/story',
    savedAt: new Date('2026-11-08'),
  }], hasNext: false })
  const html = renderToStaticMarkup(await SavedPage({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('Summary')
  expect(html).toContain('&lt;img src=x&gt;')
  expect(html).toContain('href="https://example.org/story"')
  expect(html).not.toContain('<img')
})
