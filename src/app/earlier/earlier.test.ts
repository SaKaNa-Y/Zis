import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DatedBriefPage from './[date]/page'
import EarlierPage from './page'

const { verifySession, readDatedBrief, readEarlierBriefs } = vi.hoisted(() => ({
  verifySession: vi.fn(),
  readDatedBrief: vi.fn(),
  readEarlierBriefs: vi.fn(),
}))

vi.mock('@/lib/auth/dal', () => ({ verifySession }))
vi.mock('@/lib/briefs/today', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/briefs/today')>(),
  readDatedBrief,
  readEarlierBriefs,
}))
vi.mock('server-only', () => ({}))
vi.mock('../actions', () => ({ markSignalRead: async () => {}, saveSignal: async () => {} }))

beforeEach(() => {
  vi.resetAllMocks()
  verifySession.mockResolvedValue({ userId: 'reader-from-session' })
})

describe('earlier routes', () => {
  it('requires authentication before reading a dated Brief or listing history', async () => {
    verifySession.mockRejectedValue(new Error('unauthorized'))
    await expect(DatedBriefPage({ params: Promise.resolve({ date: '2026-09-05' }) })).rejects.toThrow('unauthorized')
    await expect(EarlierPage()).rejects.toThrow('unauthorized')
    expect(readDatedBrief).not.toHaveBeenCalled()
    expect(readEarlierBriefs).not.toHaveBeenCalled()
  })

  it('returns not found for impossible dates and missing reader Briefs', async () => {
    await expect(DatedBriefPage({ params: Promise.resolve({ date: '2026-02-30' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(readDatedBrief).not.toHaveBeenCalled()
    readDatedBrief.mockResolvedValue({ hasBrief: false })
    await expect(DatedBriefPage({ params: Promise.resolve({ date: '2026-09-05' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(readDatedBrief).toHaveBeenCalledWith('reader-from-session', '2026-09-05')
  })

  it('renders a cut empty historic Brief with its own date and Earlier navigation', async () => {
    readDatedBrief.mockResolvedValue({ entries: [], hasBrief: true, localDate: '2026-09-05', previousBriefDate: '2026-09-03' })
    const html = renderToStaticMarkup(await DatedBriefPage({ params: Promise.resolve({ date: '2026-09-05' }) }))
    expect(html).toContain('Saturday, 5 September 2026')
    expect(html).toContain('Nothing cleared the bar on this day.')
    expect(html).toContain('href="/earlier/2026-09-03"')
    expect(html).toContain('Previous Brief')
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/earlier"/)
  })

  it('lists stored Brief dates including empty Briefs with working date destinations', async () => {
    readEarlierBriefs.mockResolvedValue([{ local_date: '2026-09-05', lead_title: 'Inside the storage engine' }, { local_date: '2026-09-04', lead_title: null }])
    const html = renderToStaticMarkup(await EarlierPage())
    expect(readEarlierBriefs).toHaveBeenCalledWith('reader-from-session')
    expect(html).toContain('href="/earlier/2026-09-05"')
    expect(html).toContain('href="/earlier/2026-09-04"')
    expect(html).toContain('Inside the storage engine')
    expect(html).toContain('Nothing cleared the bar')
    expect(html).not.toContain(' entries')
  })
})
