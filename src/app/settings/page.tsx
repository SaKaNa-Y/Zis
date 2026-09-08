import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { verifySession } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { appearanceSettings } from '@/lib/settings/server'
import { generationTime } from '@/lib/settings/timing'
import { DesktopDestinationRail, MobileDestinationFooter } from '../destinations'
import { AccountControls, AppearanceControl } from './controls'

export const metadata: Metadata = { title: 'Settings — Zis' }

export default async function SettingsPage() {
  const { userId } = await verifySession()
  const [reader] = await db().select({ timezone: users.timezone, cutHour: users.cutHour }).from(users).where(eq(users.id, userId))
  if (!reader)
    throw new Error('Reader settings are unavailable')
  const appearance = await appearanceSettings.read()
  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopDestinationRail current="/settings" />
      <div className="min-w-0">
        <main className="mx-auto max-w-measure px-5 py-10 sm:px-8 lg:max-w-measure-lg lg:px-12 lg:py-14">
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg">Settings</h1>
          <section aria-labelledby="appearance-heading" className="mt-register">
            <h2 id="appearance-heading" className="font-display text-body font-semibold">Appearance</h2>
            <p className="mt-3 text-meta text-ink-dim">For this browser only. Your choice stays after signing out.</p>
            <AppearanceControl initialAppearance={appearance} />
          </section>
          <section aria-labelledby="timing-heading" className="mt-register border-t border-rule pt-7">
            <h2 id="timing-heading" className="font-display text-body font-semibold">Your daily Brief</h2>
            <p className="mt-3 text-body text-ink-dim">
              Generation is scheduled to start daily at
              {' '}
              <span className="font-mono tabular-nums">{generationTime()}</span>
              {' '}
              (Asia/Shanghai). It may start or finish later.
            </p>
            <details className="mt-4 text-meta text-ink-dim">
              <summary className="cursor-pointer underline underline-offset-4">How timing works</summary>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt>Stored timezone</dt>
                <dd className="break-words">{reader.timezone}</dd>
                <dt>Cut hour</dt>
                <dd className="font-mono tabular-nums">
                  {String(reader.cutHour).padStart(2, '0')}
                  :00
                </dd>
              </dl>
              <p className="mt-3">The cut hour is the earliest local hour when a running ingestion may create that day’s Brief. It does not schedule another run or guarantee delivery at that time.</p>
              <p className="mt-3">These values are read-only. Today’s and earlier Briefs stay as they are.</p>
            </details>
          </section>
          <section aria-labelledby="account-heading" className="mt-register border-t border-rule pt-7">
            <h2 id="account-heading" className="font-display text-body font-semibold">Account</h2>
            <AccountControls />
          </section>
        </main>
        <MobileDestinationFooter current="/settings" />
      </div>
    </div>
  )
}
