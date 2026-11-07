const MAX_IMAGE_BYTES = 512 * 1024
export const MAX_IMAGES = 8
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

/** Compress without resizing so captured text stays readable; reject oversized results. */
export async function compressImage(file: File): Promise<File> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Only PNG, JPEG and WebP images are supported. / 仅支持 PNG、JPEG 和 WebP 图片。')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 40_000_000 || bitmap.width > 32767 || bitmap.height > 32767)
      throw new Error('Split this large image into readable sections. / 请将大图分割为清晰可读的部分。')
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Image processing is unavailable. / 图片处理不可用。')
    context.drawImage(bitmap, 0, 0)
    for (const quality of [0.9, 0.8, 0.7]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
      if (blob?.type === 'image/webp' && blob.size <= MAX_IMAGE_BYTES)
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
    }
    throw new Error(`${file.name}: still exceeds 512 KiB. Split it into smaller readable sections. / 压缩后仍超过 512 KiB，请分割图片。`)
  }
  finally {
    bitmap.close()
  }
}
