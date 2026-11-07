import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from './compress'

afterEach(() => vi.unstubAllGlobals())

describe('readable image compression', () => {
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
