'use server'

import type { CaptureActionState } from '@/lib/capture/action-service'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { captureActionError, textField } from '@/lib/capture/action-service'
import { CaptureValidationError } from '@/lib/capture/model'
import { captureStore } from '@/lib/capture/postgres'

export async function saveSourceAction(_previous: CaptureActionState, form: FormData): Promise<CaptureActionState> {
  await verifySession()
  try {
    const kind = textField(form, 'kind')
    if (kind !== 'x' && kind !== 'blog')
      throw new CaptureValidationError('Choose X or Blog as the source type.')
    await captureStore.saveSource({
      id: textField(form, 'id') || undefined,
      name: textField(form, 'name'),
      url: textField(form, 'url'),
      kind,
      enabled: form.get('enabled') === 'on' || form.get('enabled') === 'true',
    })
    revalidatePath('/sources')
    revalidatePath('/capture')
    return { success: 'Source saved.' }
  }
  catch (error) {
    return captureActionError(error)
  }
}

export async function recordRunAction(_previous: CaptureActionState, form: FormData): Promise<CaptureActionState> {
  await verifySession()
  try {
    const status = textField(form, 'status')
    const countText = textField(form, 'addedCount')
    const addedCount = Number(countText)
    if (!['success', 'partial', 'failed'].includes(status) || !/^\d+$/.test(countText) || !Number.isSafeInteger(addedCount) || addedCount > 10000)
      throw new CaptureValidationError('Choose a result and enter the number of newly saved cards (0–10000).')
    await captureStore.recordRun({
      sourceId: textField(form, 'sourceId'),
      status: status as 'success' | 'partial' | 'failed',
      addedCount,
      message: textField(form, 'message') || undefined,
    })
    revalidatePath('/')
    revalidatePath('/sources')
    return { success: 'Collection result saved.' }
  }
  catch (error) {
    return captureActionError(error)
  }
}
