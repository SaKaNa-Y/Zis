'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { createReaderSignalActions } from '@/lib/briefs/actions'
import { markBriefSignalRead, saveBriefSignal } from '@/lib/briefs/postgres'

const readerActions = createReaderSignalActions({
  markRead: markBriefSignalRead,
  revalidate: revalidatePath,
  save: saveBriefSignal,
  verifySession,
})

export async function saveSignal(formData: FormData): Promise<void> {
  await readerActions.save(formData)
}

export async function markSignalRead(formData: FormData): Promise<void> {
  await readerActions.markRead(formData)
}
