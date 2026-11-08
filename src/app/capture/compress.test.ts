import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from './compress'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('readable image compression', () => {
  function fallbackImage(fails = false, width = 1200) {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image')
    vi.stubGlobal('Image', class {
      naturalWidth = width
      naturalHeight = 2200
      decode = fails ? vi.fn().mockRejectedValue(new Error('decode failed')) : vi.fn().mockResolvedValue(undefined)
    })
    return revoke
  }

  it.each(['image/jpeg', 'image/webp'])('uses an image element when bitmap decoding rejects %s', async (type) => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('The source image could not be decoded.')))
    const revoke = fallbackImage()
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['small'], { type: 'image/webp' })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    const result = await compressImage(new File(['input'], 'capture', { type }))
    expect(result.type).toBe('image/webp')
    expect([canvas.width, canvas.height]).toEqual([1200, 2200])
    expect(drawImage).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test-image')
  })

  it('identifies the file and rejects the upload when both decoders fail', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('The source image could not be decoded.')))
    const revoke = fallbackImage(true)
    await expect(compressImage(new File(['broken'], 'broken.jpg', { type: 'image/jpeg' }))).rejects.toThrow('broken.jpg: could not decode this image')
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test-image')
  })

  it('enforces dimension limits and releases the URL without a bitmap API', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const revoke = fallbackImage(false, 32768)
    await expect(compressImage(new File(['input'], 'large.png', { type: 'image/png' }))).rejects.toThrow('Split this large image')
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test-image')
  })

  it('keeps dimensions and closes the bitmap after producing a bounded WebP', async () => {
    const close = vi.fn()
    const drawImage = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 2200, close }))
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['small'], { type: 'image/webp' })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    const result = await compressImage(new File(['input'], 'capture.png', { type: 'image/png' }))
    expect([canvas.width, canvas.height]).toEqual([1200, 2200])
    expect(result.type).toBe('image/webp')
    expect(close).toHaveBeenCalledOnce()
  })

  it('rejects an oversized image instead of reducing its readable dimensions or dropping it', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 2200, close }))
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array(600 * 1024)], { type: 'image/webp' })) }) })
    await expect(compressImage(new File(['input'], 'capture.png', { type: 'image/png' }))).rejects.toThrow('512 KiB')
    expect(close).toHaveBeenCalledOnce()
  })
})
