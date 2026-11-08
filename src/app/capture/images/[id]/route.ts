import { verifyAuthor } from '@/lib/auth/dal'
import { captureStore } from '@/lib/capture/postgres'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  await verifyAuthor()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response(null, { status: 404 })
  const image = await captureStore.readImage(id)
  if (!image)
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  return new Response(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'default-src \'none\'; sandbox',
    },
  })
}
