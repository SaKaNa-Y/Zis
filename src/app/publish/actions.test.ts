import { beforeEach, expect, it, vi } from 'vitest'
import { finishPublication, openPublication } from './actions'

const db = vi.hoisted(() => ({
  startRun: vi.fn(),
  listPublicationRuns: vi.fn(),
  failRun: vi.fn(),
  reportStage: vi.fn(),
  completeRun: vi.fn(),
}))
const verifyAuthor = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/dal', () => ({ verifyAuthor }))
vi.mock('@/lib/articles/service', () => db)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(url)
  },
}))

beforeEach(() => vi.resetAllMocks())

it('denies a reader before parsing or recording an attempt', async () => {
  verifyAuthor.mockRejectedValue(new Error('denied'))
  await expect(openPublication(new FormData())).rejects.toThrow('denied')
  await expect(finishPublication(new FormData())).rejects.toThrow('denied')
  expect(db.startRun).not.toHaveBeenCalled()
  expect(db.completeRun).not.toHaveBeenCalled()
})

it('records a malformed producer submission as a failed attempt', async () => {
  const form = new FormData()
  form.set('run', 'run')
  form.set('outputs', '{')
  await expect(finishPublication(form)).rejects.toThrow('/history')
  expect(db.failRun).toHaveBeenCalledWith('run', 'Invalid publication JSON.')
})

it('reuses the same run and output keys after an uncertain commit', async () => {
  const form = new FormData()
  form.set('run', 'run')
  form.set('outputs', '[]')
  form.set('reason', 'No new material')
  db.completeRun.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(undefined)
  await expect(finishPublication(form)).rejects.toThrow('/history')
  expect(db.completeRun.mock.calls).toEqual([['run', [], 'No new material'], ['run', [], 'No new material']])
  expect(db.failRun).not.toHaveBeenCalled()
})

it('starts a linked retry on resuming a failed scheduled window', async () => {
  db.startRun.mockResolvedValueOnce('original').mockResolvedValueOnce('retry')
  db.listPublicationRuns.mockResolvedValue([{ id: 'original', status: 'failed' }])
  const form = new FormData()
  form.set('attempt', 'evening')
  await expect(openPublication(form)).rejects.toThrow('/publish?run=retry')
  expect(db.startRun.mock.calls).toEqual([['window:evening'], ['retry:original', 'original']])
})
