import type { Metadata } from 'next'
import { requestTranslation } from '@/app/translation-actions'
import { verifySession } from '@/lib/auth/dal'
import { readTodayBrief } from '@/lib/briefs/today'
import { markSignalRead, saveSignal } from './actions'
import { TodayBriefView } from './today'

export const metadata: Metadata = {
  title: 'Today — Zis',
}

export default async function Home() {
  const { userId } = await verifySession()
  const brief = await readTodayBrief(userId)

  return (
    <TodayBriefView
      translationAction={requestTranslation}
      actionTargets={{ markRead: markSignalRead, save: saveSignal }}
      brief={brief}
    />
  )
}
