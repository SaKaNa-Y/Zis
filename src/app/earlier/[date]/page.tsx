import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { isBriefDate, readDatedBrief } from '@/lib/briefs/today'
import { markSignalRead, saveSignal } from '../../actions'
import { TodayBriefView } from '../../today'

export const metadata: Metadata = {
  title: 'Earlier Brief — Zis',
}

export default async function DatedBriefPage({ params }: { params: Promise<{ date: string }> }) {
  const { userId } = await verifySession()
  const { date } = await params
  if (!isBriefDate(date))
    notFound()
  const brief = await readDatedBrief(userId, date)
  if (!brief.hasBrief)
    notFound()

  return (
    <TodayBriefView
      actionTargets={{ markRead: markSignalRead, save: saveSignal }}
      brief={brief}
      period="earlier"
    />
  )
}
