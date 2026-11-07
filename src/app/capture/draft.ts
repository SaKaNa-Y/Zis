import type { CaptureCard, CaptureInput, CaptureSource } from '@/lib/capture/model'

type InitialCapture = Pick<CaptureCard, 'sourceId' | 'sourceKind' | 'title' | 'author' | 'threadUrl' | 'incompleteReason' | 'posts'>

export function captureDraft(initial?: InitialCapture): Record<string, string> {
  return {
    sourceId: initial?.sourceId ?? '',
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    threadUrl: initial?.sourceKind === 'x' ? initial.threadUrl : '',
    incompleteReason: initial?.incompleteReason ?? '',
    ...Object.fromEntries(initial?.posts.flatMap((post, index) => [[`url-${index}`, post.url], [`publishedAt-${index}`, post.publishedAt], [`body-${index}`, post.body]]) ?? []),
  }
}

export function capturePayload(data: FormData, posts: number[], sources: CaptureSource[]): CaptureInput {
  const value = (name: string) => String(data.get(name) ?? '')
  const sourceId = value('sourceId')
  const source = sources.find(source => source.id === sourceId)
  return {
    sourceId,
    title: value('title'),
    author: value('author'),
    ...(source?.kind === 'x' && value('threadUrl') ? { threadUrl: value('threadUrl') } : {}),
    incompleteReason: value('incompleteReason') || undefined,
    posts: posts.map(id => ({ url: value(`url-${id}`), publishedAt: value(`publishedAt-${id}`), body: value(`body-${id}`) })),
  }
}
