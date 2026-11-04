'use client'

import type { TranslationAction } from '@/lib/translations/model'
import { useReadingTranslation } from '@/lib/translations/reading'

export function EarlierTitle({ entryId, title, action }: { entryId: string, title: string, action: TranslationAction }) {
  const translation = useReadingTranslation(entryId, { title, summary: null, whyText: '' }, action)
  return (
    <>
      <p lang={translation.lang} className="reading-why mt-2 text-ink-faint">{translation.text.title}</p>
      {translation.controls}
    </>
  )
}
