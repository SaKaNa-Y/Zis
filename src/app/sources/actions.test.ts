import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verify: vi.fn(), allow: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/auth/dal', () => ({ verifySession: mocks.verify }))
vi.mock('@/lib/capture/postgres', () => ({ captureStore: { allowBackfill: mocks.allow } }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
const { allowBackfillAction } = await import('./actions')

beforeEach(() => vi.resetAllMocks())
describe('authenticated backfill action', () => {
  it('requires a session before changing tracking dates', async () => {
    mocks.verify.mockRejectedValue(new Error('redirect:/login'))
    await expect(allowBackfillAction({}, new FormData())).rejects.toThrow('redirect:/login')
    expect(mocks.allow).not.toHaveBeenCalled()
  })
  it('interprets the selected date as Beijing midnight and refreshes source views', async () => {
    mocks.allow.mockResolvedValue(8)
    const form = new FormData()
    form.set('startDate', '2026-11-07')
    const result = await allowBackfillAction({}, form)
    expect(mocks.allow).toHaveBeenCalledWith('2026-11-07T00:00:00+08:00')
    expect(result.success).toContain('8 source(s) updated')
    expect(mocks.revalidate).toHaveBeenCalledWith('/sources')
  })
})
