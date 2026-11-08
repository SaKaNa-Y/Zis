import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({ verifyAuthor: vi.fn(), readImage: vi.fn() }))
vi.mock('@/lib/auth/dal', () => ({ verifyAuthor: mocks.verifyAuthor }))
vi.mock('@/lib/capture/postgres', () => ({ captureStore: { readImage: mocks.readImage } }))
const id = '00000000-0000-0000-0000-000000000001'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.verifyAuthor.mockResolvedValue({ role: 'author' })
})
describe('private capture images', () => {
  it('does not read an image before authentication', async () => {
    mocks.verifyAuthor.mockRejectedValue(new Error('sign in'))
    await expect(GET(new Request('https://zis.test'), { params: Promise.resolve({ id }) })).rejects.toThrow('sign in')
    expect(mocks.readImage).not.toHaveBeenCalled()
  })
  it('returns 404 for expired or missing images', async () => {
    mocks.readImage.mockResolvedValue(null)
    expect((await GET(new Request('https://zis.test'), { params: Promise.resolve({ id }) })).status).toBe(404)
  })
  it('prevents persistent caching of private expiring images', async () => {
    mocks.readImage.mockResolvedValue({ data: new Uint8Array([1, 2]), mimeType: 'image/png' })
    const response = await GET(new Request('https://zis.test'), { params: Promise.resolve({ id }) })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Content-Type')).toBe('image/png')
  })
})
