import { beforeEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => vi.fn())
const read = vi.hoisted(() => vi.fn())
const queue = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/dal', () => ({ verifySession: auth }))
vi.mock('@/lib/signals/provenance', () => ({ readSignalProvenance: read }))
vi.mock('@/lib/translations/store', () => ({ queueTranslation: queue }))
const { requestTranslation } = await import('./translation-actions')
const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.resetAllMocks()
  auth.mockResolvedValue({ userId: 'owner' })
})
it('rejects unauthorized requests before reading or queuing any text', async () => {
  auth.mockRejectedValue(new Error('unauthorized'))
  await expect(requestTranslation(id, 'zh')).rejects.toThrow('unauthorized')
  expect(read).not.toHaveBeenCalled()
  expect(queue).not.toHaveBeenCalled()
})
it('does not enqueue an entry outside the reader’s Briefs', async () => {
  read.mockResolvedValue(null)
  expect(await requestTranslation(id, 'zh')).toEqual({ state: 'failed' })
  expect(read).toHaveBeenCalledWith('owner', id)
  expect(queue).not.toHaveBeenCalled()
})
it('queues only text resolved from the owned entry and preserves explicit retry', async () => {
  const original = { title: 'Original title', summary: null, whyText: 'Frozen reason' }
  read.mockResolvedValue(original)
  queue.mockResolvedValue({ state: 'queued' })
  expect(await requestTranslation(id, 'zh', true)).toEqual({ state: 'queued' })
  expect(queue).toHaveBeenCalledWith('owner', 'zh', original, true)
})
