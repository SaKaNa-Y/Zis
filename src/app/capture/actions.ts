'use server'

import type { CaptureActionState } from '@/lib/capture/action-service'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { captureActionError, parseCaptureForm } from '@/lib/capture/action-service'
import { captureStore } from '@/lib/capture/postgres'

export async function saveCaptureAction(_previous: CaptureActionState, form: FormData): Promise<CaptureActionState> {
  await verifySession()
  try {
    const { input, images } = await parseCaptureForm(form)
    const saved = await captureStore.saveCapture(input, images)
    revalidatePath('/')
    revalidatePath('/sources')
    return { id: saved.id, success: saved.created ? 'Information saved.' : 'Information updated. The expiry time did not change.' }
  }
  catch (error) {
    return captureActionError(error)
  }
}
