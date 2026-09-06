import type { Metadata } from 'next'
import Link from 'next/link'
import { verifySession } from '@/lib/auth/dal'
import { readEarlierBriefs } from '@/lib/briefs/today'
import { DesktopDestinationRail, MobileDestinationFooter } from '../destinations'
import { dateLabel } from '../today'

export const metadata: Metadata = {
  title: 'Earlier — Zis',
}

export default async function EarlierPage() {
  const { userId } = await verifySession()
  const briefs = await readEarlierBriefs(userId)

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopDestinationRail current="/earlier" />
      <div className="min-w-0">
        <main className="mx-auto max-w-measure px-5 py-10 sm:px-8 lg:max-w-measure-lg lg:px-12 lg:py-14">
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg">Earlier briefs</h1>
          {briefs.length === 0
            ? <p className="mt-register text-body text-ink-dim">Your earlier briefs will appear here after the first day.</p>
            : (
                <ul className="mt-register divide-y divide-rule">
                  {briefs.map(brief => (
                    <li className="py-5" key={brief.local_date}>
                      <Link className="text-body underline decoration-rule underline-offset-4 hover:text-ink-dim" href={`/earlier/${brief.local_date}`}>
                        {dateLabel(brief.local_date)}
                      </Link>
                      <p className="mt-2 text-meta text-ink-faint">
                        {brief.lead_title ?? 'Nothing cleared the bar'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
        </main>
        <MobileDestinationFooter current="/earlier" />
      </div>
    </div>
  )
}
