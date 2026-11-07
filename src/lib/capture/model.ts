export interface CaptureSource { id: string, name: string, url: string, kind: 'x' | 'blog', enabled: boolean, trackingSince: string }
export interface CapturePostInput { url: string, publishedAt: string, body: string }
export interface CaptureInput { sourceId: string, title: string, author: string, threadUrl?: string, posts: CapturePostInput[], incompleteReason?: string }
export interface CaptureImageInput { data: Uint8Array, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', alt: string }
export interface CaptureCard { id: string, sourceId: string, sourceName: string, sourceKind: 'x' | 'blog', title: string, author: string, originalUrl: string, threadUrl: string, publishedAt: string, capturedAt: string, expiresAt: string, updatedAt: string, incompleteReason: string | null, continuationOf: string | null, posts: CapturePostInput[], images: { id: string, alt: string }[] }
export interface CaptureRun { id: string, sourceId: string, startedAt: string, finishedAt: string | null, status: 'running' | 'success' | 'partial' | 'failed', addedCount: number, message: string | null }
export interface CaptureStore {
  listSources: () => Promise<CaptureSource[]>
  saveSource: (input: { id?: string, name: string, url: string, kind: 'x' | 'blog', enabled: boolean }) => Promise<CaptureSource>
  getCard: (id: string) => Promise<CaptureCard | null>
  listCards: (limit?: number, before?: string) => Promise<CaptureCard[]>
  saveCapture: (input: CaptureInput, images?: CaptureImageInput[]) => Promise<{ id: string, created: boolean }>
  readImage: (id: string) => Promise<{ data: Uint8Array, mimeType: string } | null>
  listRuns: () => Promise<CaptureRun[]>
  recordRun: (input: { sourceId: string, status: 'success' | 'partial' | 'failed', addedCount: number, message?: string }) => Promise<void>
  storageUsage: () => Promise<{ bytes: number, limitBytes: number }>
  prune: () => Promise<{ cards: number, images: number }>
}
export const IMAGE_LIMIT_BYTES = 128 * 1024 * 1024
export const DATABASE_LIMIT_BYTES = 400 * 1024 * 1024
export const MAX_IMAGE_BYTES = 512 * 1024
export function httpsUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  }
  catch { throw new CaptureValidationError('A valid HTTPS URL is required') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new CaptureValidationError('An HTTPS URL without credentials or custom port is required')
  url.hash = ''
  return url
}
export function canonicalUrl(value: string): string {
  const url = httpsUrl(value)
  if (/^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(url.hostname)) {
    const match = /^\/\w+\/status\/(\d+)(?:\/.*)?$/.exec(url.pathname)
    if (!match)
      throw new CaptureValidationError('An X status URL with a numeric ID is required')
    return `https://x.com/i/status/${BigInt(match[1]!)}`
  }
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^(?:fbclid|gclid)$/.test(key))
      url.searchParams.delete(key)
  }
  return url.toString()
}
export function sourceUrl(value: string, kind: 'x' | 'blog'): string {
  const url = httpsUrl(value)
  if (kind === 'x') {
    if (!/^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(url.hostname) || !/^\/\w{1,15}\/?$/.test(url.pathname))
      throw new CaptureValidationError('Use an X account URL')
    return `https://x.com/${url.pathname.split('/')[1]!.toLowerCase()}`
  }
  return url.toString()
}
export function validateImage(image: CaptureImageInput): void {
  if (!image || !(image.data instanceof Uint8Array) || typeof image.alt !== 'string')
    throw new CaptureValidationError('Invalid image upload')
  const b = image.data
  const match = image.mimeType === 'image/png'
    ? b.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
    : image.mimeType === 'image/jpeg'
      ? b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
      : image.mimeType === 'image/webp' && b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
  if (!match || b.length > MAX_IMAGE_BYTES)
    throw new CaptureValidationError('Images must be JPEG, PNG or WebP and at most 512 KiB')
  if (image.alt.length > 2000)
    throw new CaptureValidationError('Image description is too long')
}
export class CaptureValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CaptureValidationError'
  }
}
