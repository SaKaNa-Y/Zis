'use server'

import type { Language } from '@/lib/settings/preferences'
import type { TranslationResult } from '@/lib/translations/model'
import { verifySession } from '@/lib/auth/dal'
import { isLanguage } from '@/lib/settings/preferences'
import { readSignalProvenance } from '@/lib/signals/provenance'
import { queueTranslation } from '@/lib/translations/store'

export async function requestTranslation(entryId: string, language: Language, retry = false): Promise<TranslationResult> {
  const { userId } = await verifySession()
  if (!isLanguage(language) || !/^[0-9a-f-]{36}$/i.test(entryId))
    return { state: 'failed' }
  // Resolve owned content on the server. The client cannot submit text to the AI queue.
  const entry = await readSignalProvenance(userId, entryId)
  if (!entry)
    return { state: 'failed' }
  return queueTranslation(userId, language, { title: entry.title, summary: entry.summary, whyText: entry.whyText }, retry === true)
}
