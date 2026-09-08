import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import SavedPage from './page'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/bookmarks/server', () => ({ savedBookmarks: { read } }))
vi.mock('./actions', () => ({ changeBookmark: async () => ({ error: 'Not used in server rendering' }) }))
vi.mock('server-only', () => ({}))
beforeEach(() => vi.resetAllMocks())

it('renders the empty state with both navigation layouts and a path back to Today', async () => {
  read.mockResolvedValue({ entries: [], page: 1, hasNext: false })
  const html = renderToStaticMarkup(await SavedPage({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('No saved Signals yet.')
  expect(html).toContain('href="/"')
  expect(html.match(/aria-current="page"[^>]*href="\/saved"/g)).toHaveLength(2)
  expect(html).not.toContain('Next page')
})

it('renders original and dated provenance links and finite pagination', async () => {
  read.mockResolvedValue({ entries: [{
    signalId: '00000000-0000-4000-8000-000000000001',
    entryId: '00000000-0000-4000-8000-000000000002',
    title: 'Database internals',
    originName: 'Example',
    originUrl: 'https://example.com/story',
    savedAt: '2026-09-05T09:00:00Z',
    savedDate: '2026-09-05',
    briefDate: '2026-09-01',
  }], page: 2, hasNext: true })
  const html = renderToStaticMarkup(await SavedPage({ searchParams: Promise.resolve({ page: '2' }) }))
  expect(read).toHaveBeenCalledWith(2)
  expect(html).toContain('href="https://example.com/story"')
  expect(html).toContain('target="_blank"')
  expect(html).toContain('href="/signals/00000000-0000-4000-8000-000000000002"')
  expect(html).toContain('1 Sept 2026')
  expect(html).toContain('Remove')
  expect(html).toContain('href="/saved?page=1"')
  expect(html).toContain('href="/saved?page=3"')
  expect(html).not.toContain('Mark read')
})

it('propagates authentication redirects without rendering saved content', async () => {
  read.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(SavedPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT')
})
