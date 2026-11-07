import type { CaptureSource } from '@/lib/capture/model'
import { describe, expect, it } from 'vitest'
import { captureDraft, capturePayload } from './draft'

const sources: CaptureSource[] = [
  { id: 'blog', name: 'Blog', kind: 'blog', url: 'https://example.com', enabled: true, trackingSince: '2026-11-07T00:00:00Z' },
  { id: 'x', name: 'X', kind: 'x', url: 'https://x.com/example', enabled: true, trackingSince: '2026-11-07T00:00:00Z' },
]
const initial = {
  sourceId: 'blog',
  sourceKind: 'blog' as const,
  title: 'Title',
  author: 'Author',
  threadUrl: 'https://example.com/article',
  incompleteReason: null,
  posts: [{ url: 'https://example.com/article', publishedAt: '2026-11-07T00:00:00Z', body: 'Complete original' }],
}
function formData(draft: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(draft)) data.set(key, value)
  return data
}

describe('capture editing payload', () => {
  it('prefills a blog without sending a prohibited thread URL', () => {
    const draft = captureDraft(initial)
    expect(draft.threadUrl).toBe('')
    const payload = capturePayload(formData(draft), [0], sources)
    expect(payload).not.toHaveProperty('threadUrl')
    expect(payload.posts).toEqual(initial.posts)
  })

  it('preserves the original root when editing an X thread', () => {
    const draft = captureDraft({ ...initial, sourceId: 'x', sourceKind: 'x', threadUrl: 'https://x.com/example/status/123' })
    expect(capturePayload(formData(draft), [0], sources).threadUrl).toBe('https://x.com/example/status/123')
  })

  it('omits a stale thread URL after switching from X to a blog', () => {
    const data = formData({ ...captureDraft(initial), threadUrl: 'https://x.com/example/status/123', sourceId: 'blog' })
    expect(capturePayload(data, [0], sources)).not.toHaveProperty('threadUrl')
  })
})
