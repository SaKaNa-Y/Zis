import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveCaptureAction } from './actions'

const mocks = vi.hoisted(() => ({ verifySession: vi.fn(), saveCapture: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/dal', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/capture/postgres', () => ({ captureStore: { saveCapture: mocks.saveCapture } }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.verifySession.mockResolvedValue({ userId: 'reader' })
})

describe('capture action', () => {
  it('authenticates before reading or writing a submission', async () => {
    mocks.verifySession.mockRejectedValue(new Error('sign in'))
    await expect(saveCaptureAction({}, new FormData())).rejects.toThrow('sign in')
    expect(mocks.saveCapture).not.toHaveBeenCalled()
  })

  it('passes validated input to the store and refreshes the stream', async () => {
    const form = new FormData()
    form.set('payload', JSON.stringify({ sourceId: 'source', title: 'Original', author: 'Author', posts: [{ url: 'https://x.com/OpenAI/status/123', publishedAt: '2026-11-07T00:00:00Z', body: 'Original body' }] }))
    mocks.saveCapture.mockResolvedValue({ id: 'card', created: true })
    expect(await saveCaptureAction({}, form)).toEqual({ id: 'card', success: 'Information saved.' })
    expect(mocks.saveCapture).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })
})
