import type { CaptureImageInput, CaptureInput } from './model'
import { CaptureValidationError } from './model'

export interface CaptureActionState {
  error?: string
  success?: string
  id?: string
}

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

export function textField(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

/** Bounds are checked before allocating file buffers. The store validates content. */
export async function parseCaptureForm(form: FormData): Promise<{ input: CaptureInput, images: CaptureImageInput[] }> {
  const payload = textField(form, 'payload')
  if (!payload || new TextEncoder().encode(payload).byteLength > 512 * 1024)
    throw new CaptureValidationError('Enter the original content (up to 512 KB per submission).')
  let input: CaptureInput
  let alts: unknown
  try {
    input = JSON.parse(payload) as CaptureInput
    alts = JSON.parse(textField(form, 'imageAlts') || '[]')
  }
  catch {
    throw new CaptureValidationError('The content could not be read. Review the form and try again.')
  }
  if (!Array.isArray(alts) || alts.some(alt => typeof alt !== 'string' || alt.length > 1000))
    throw new CaptureValidationError('Image descriptions must be text, up to 1000 characters each.')
  const files = form.getAll('images').filter((file): file is File => typeof file !== 'string' && file.size > 0)
  if (files.length > 8 || files.some(file => file.size > 512 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES)
    throw new CaptureValidationError('Use up to eight images, at most 512 KB each and 3 MB in total.')
  const images = await Promise.all(files.map(async (file, index) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new CaptureValidationError('Use PNG, JPEG, or WebP images.')
    return {
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type as CaptureImageInput['mimeType'],
      alt: (alts as string[])[index] ?? '',
    }
  }))
  return { input, images }
}

export function captureActionError(error: unknown): CaptureActionState {
  return {
    error: error instanceof CaptureValidationError
      ? error.message
      : 'The result could not be confirmed. Refresh the information stream before retrying.',
  }
}
