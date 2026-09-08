'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { savedBookmarks } from '@/lib/bookmarks/server'

export async function changeBookmark(formData: FormData): Promise<{ receipt?: string | null, error?: string }> {
  await verifySession()
  let receipt: string | null = null
  try {
    const operation = formData.get('operation')
    if (operation === 'remove') {
      const signalId = formData.get('signalId')
      if (typeof signalId !== 'string')
        throw new Error('Missing Signal')
      receipt = await savedBookmarks.remove(signalId)
    }
    else if (operation === 'undo') {
      const token = formData.get('receipt')
      if (typeof token !== 'string')
        throw new Error('Missing Undo receipt')
      await savedBookmarks.undo(token)
    }
    else {
      throw new Error('Unknown Bookmark operation')
    }
  }
  catch {
    return { error: 'Your change could not be saved. Please try again.' }
  }
  revalidatePath('/saved')
  revalidatePath('/')
  revalidatePath('/earlier/[date]', 'page')
  return { receipt }
}
