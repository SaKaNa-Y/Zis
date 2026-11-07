import { describe, expect, it } from 'vitest'
import { captureActionError, parseCaptureForm } from './action-service'
import { CaptureValidationError } from './model'

function form(): FormData {
  const data = new FormData()
  data.set('payload', JSON.stringify({ sourceId: 'source', title: 'Original', author: 'Author', posts: [{ url: 'https://x.com/OpenAI/status/123', publishedAt: '2026-11-07T00:00:00Z', body: 'Original body' }] }))
  return data
}

describe('capture submission boundary', () => {
  it('reads full original text and image descriptions without summaries', async () => {
    const data = form()
    data.set('imageAlts', '["Original screenshot"]')
    data.append('images', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'capture.png', { type: 'image/png' }))
    const parsed = await parseCaptureForm(data)
    expect(parsed.input.posts[0]?.body).toBe('Original body')
    expect(parsed.images[0]?.alt).toBe('Original screenshot')
  })

  it('rejects an oversized image before loading its data', async () => {
    const data = form()
    data.append('images', new File([new Uint8Array(512 * 1024 + 1)], 'capture.png', { type: 'image/png' }))
    await expect(parseCaptureForm(data)).rejects.toThrow('512 KB')
  })

  it('rejects SVG and malformed metadata', async () => {
    const data = form()
    data.append('images', new File(['<svg/>'], 'capture.svg', { type: 'image/svg+xml' }))
    await expect(parseCaptureForm(data)).rejects.toThrow('PNG, JPEG, or WebP')
    data.set('imageAlts', '{')
    await expect(parseCaptureForm(data)).rejects.toThrow('could not be read')
  })

  it('does not disclose database errors or connection details', () => {
    expect(captureActionError(new Error('postgres://private:secret@host'))).toEqual({ error: 'The result could not be confirmed. Refresh the information stream before retrying.' })
    expect(captureActionError(new CaptureValidationError('Capacity reached'))).toEqual({ error: 'Capacity reached' })
  })
})
