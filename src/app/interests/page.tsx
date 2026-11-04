import type { Metadata } from 'next'
import { Text } from '@/lib/i18n/context'
import { interestProfile } from '@/lib/interests/server'
import { DesktopDestinationRail, MobileDestinationFooter } from '../destinations'
import { InterestEditor } from './editor'

export const metadata: Metadata = { title: 'Interests — Zis' }

export default async function InterestsPage() {
  const profile = await interestProfile.read()
  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopDestinationRail current="/interests" />
      <div className="min-w-0">
        <main className="mx-auto max-w-measure px-5 py-10 sm:px-8 lg:max-w-measure-lg lg:px-12 lg:py-14">
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg"><Text en="Interests" zh="关注兴趣" /></h1>
          <p className="mt-5 text-body text-ink-dim"><Text en="One statement for each thing you care about. Aim for no more than 200 characters each." zh="每条写下一个你关心的方向，尽量不超过 200 个字符。" /></p>
          <p className="mt-3 text-meta text-ink-faint"><Text en="Changes apply to the next Brief that has not yet been cut, usually tomorrow. Today’s and earlier Briefs, including their saved explanations, stay as they are." zh="修改会应用于下一份尚未生成的简报，通常是明天。今天及往期简报和入选理由保持不变。" /></p>
          {profile.length === 0 && <p className="mt-5 text-body text-ink-dim"><Text en="Add at least one Interest to start your Brief. Your first Brief needs an Interest Profile." zh="添加至少一条关注兴趣，开始生成你的简报。" /></p>}
          <InterestEditor profile={profile} />
        </main>
        <MobileDestinationFooter current="/interests" />
      </div>
    </div>
  )
}
