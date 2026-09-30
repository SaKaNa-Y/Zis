import type { Metadata } from 'next'
import Link from 'next/link'
import { verifySession } from '@/lib/auth/dal'
import { readEarlierBriefs } from '@/lib/briefs/today'
import { DestinationNavigation, MobileDestinationFooter } from '../destinations'
import { dateLabel } from '../today'

export const metadata: Metadata = {
  title: 'Earlier — Zis',
}

export default async function EarlierPage() {
  const { userId } = await verifySession()
  const briefs = await readEarlierBriefs(userId)

  return (
    <div className="brief-v2 app-shell">
      <DestinationNavigation current="/earlier" />
      <div className="min-w-0">
        <main className="page-content">
          <p className="eyebrow page-eyebrow">The archive</p>
          <h1 className="page-title">Earlier briefs</h1>
          <p className="page-description">A little distance. The same perspective.</p>
          {briefs.length === 0
            ? <p className="mt-register text-body text-ink-dim">Your earlier briefs will appear here after the first day.</p>
            : (
                <ul className="archive-list mt-register">
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
