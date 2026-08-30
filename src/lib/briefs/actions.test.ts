import { describe, expect, it, vi } from 'vitest'
import { createReaderSignalActions } from './actions'

vi.mock('server-only', () => ({}))

const READER_ID = '00000000-0000-4000-8000-000000000076'
const OTHER_READER_ID = '00000000-0000-4000-8000-000000000099'
const SIGNAL_ID = '00000000-0000-4000-8000-000000000760'

describe('today reader actions', () => {
  it('derives Bookmark ownership from the verified session and remains idempotent', async () => {
    const bookmarks = new Set<string>()
    const verifySession = vi.fn(async () => ({ userId: READER_ID }))
    const revalidate = vi.fn()
    const actions = createReaderSignalActions({
      markRead: async () => {},
      revalidate,
      save: async (userId, signalId) => {
        bookmarks.add(`${userId}:${signalId}`)
      },
      verifySession,
    })
    const formData = new FormData()
    formData.set('signalId', SIGNAL_ID)
    formData.set('userId', OTHER_READER_ID)

    await actions.save(formData)
    await actions.save(formData)

    expect(verifySession).toHaveBeenCalledTimes(2)
    expect(bookmarks).toEqual(new Set([`${READER_ID}:${SIGNAL_ID}`]))
    expect(revalidate).toHaveBeenNthCalledWith(1, '/')
    expect(revalidate).toHaveBeenNthCalledWith(2, '/')
  })

  it('marks Read State with the authenticated reader and rejects malformed input before mutation', async () => {
    const markRead = vi.fn(async () => {})
    const verifySession = vi.fn(async () => ({ userId: READER_ID }))
    const revalidate = vi.fn()
    const actions = createReaderSignalActions({
      markRead,
      revalidate,
      save: async () => {},
      verifySession,
    })
    const valid = new FormData()
    valid.set('signalId', SIGNAL_ID)

    await actions.markRead(valid)

    expect(markRead).toHaveBeenCalledWith(READER_ID, SIGNAL_ID)
    expect(revalidate).toHaveBeenCalledWith('/')

    const invalid = new FormData()
    invalid.set('signalId', 'not-a-signal')
    await expect(actions.markRead(invalid)).rejects.toThrow('valid Signal id')
    expect(markRead).toHaveBeenCalledTimes(1)
    expect(verifySession).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledTimes(1)
  })
})
