import type { Metadata } from 'next'
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
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg">Interests</h1>
          <p className="mt-5 text-body text-ink-dim">One statement for each thing you care about. Aim for no more than 200 characters each.</p>
          <p className="mt-3 text-meta text-ink-faint">Changes apply to the next Brief that has not yet been cut, usually tomorrow. Today’s and earlier Briefs, including their saved explanations, stay as they are.</p>
          {profile.length === 0 && <p className="mt-5 text-body text-ink-dim">Add at least one Interest to start your Brief. Your first Brief needs an Interest Profile.</p>}
          <InterestEditor profile={profile} />
        </main>
        <MobileDestinationFooter current="/interests" />
      </div>
    </div>
  )
}
