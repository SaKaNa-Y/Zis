import { expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({
  verifySession: vi.fn(),
  verifyAuthor: vi.fn(),
  getArticle: vi.fn(),
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  publishDraft: vi.fn(),
  parseArticleContent: vi.fn(),
}))
vi.mock('@/lib/auth/dal', () => deps)
vi.mock('@/lib/articles/service', () => deps)
vi.mock('@/lib/articles/types', () => deps)
vi.mock('@/lib/i18n/server', () => ({ readLocale: async () => ({ t: (en: string) => en }) }))
vi.mock('next/navigation', () => ({ notFound: () => {
  throw new Error('404')
} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

it('never fetches draft content when a reader follows a direct editing link', async () => {
  const { default: page } = await import('./page')
  deps.verifySession.mockResolvedValue({ role: 'reader' })
  const request = { params: Promise.resolve({ id: '403373ce-20d5-4a09-816d-2da74419afe7' }), searchParams: Promise.resolve({ edit: '1' }) }
  await expect(page(request)).rejects.toThrow('404')
  expect(deps.getDraft).not.toHaveBeenCalled()
})

it('denies direct save and publish requests before inspecting their submitted content', async () => {
  const { saveChanges, releaseChanges } = await import('./actions')
  deps.verifyAuthor.mockRejectedValue(new Error('forbidden'))
  for (const action of [saveChanges, releaseChanges])
    await expect(action('id', null, new FormData())).rejects.toThrow('forbidden')
  expect(deps.saveDraft).not.toHaveBeenCalled()
  expect(deps.publishDraft).not.toHaveBeenCalled()
})
