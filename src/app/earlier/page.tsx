import type { Metadata } from 'next'
import Link from 'next/link'
import { requestTranslation } from '@/app/translation-actions'
import { verifySession } from '@/lib/auth/dal'
import { readEarlierBriefs } from '@/lib/briefs/today'
import { Text } from '@/lib/i18n/context'
import { readLocale } from '@/lib/i18n/server'
import { DesktopDestinationRail, MobileDestinationFooter } from '../destinations'
import { EarlierTitle } from './title'

export const metadata: Metadata = {
  title: 'Earlier — Zis',
}

export default async function EarlierPage() {
  const { userId } = await verifySession()
  const { language, t } = await readLocale()
  const briefs = await readEarlierBriefs(userId)

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopDestinationRail current="/earlier" />
      <div className="min-w-0">
        <main className="mx-auto max-w-measure px-5 py-10 sm:px-8 lg:max-w-measure-lg lg:px-12 lg:py-14">
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg"><Text en="Earlier briefs" zh="往期简报" /></h1>
          {briefs.length === 0
            ? <p className="mt-register text-body text-ink-dim"><Text en="Your earlier briefs will appear here after the first day." zh="从第二天开始，你可以在这里查看往期简报。" /></p>
            : (
                <ul className="mt-register divide-y divide-rule">
                  {briefs.map(brief => (
                    <li className="py-5" key={brief.local_date}>
                      <Link className="text-body underline decoration-rule underline-offset-4 hover:text-ink-dim" href={`/earlier/${brief.local_date}`}>
                        {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${brief.local_date}T12:00:00Z`))}
                      </Link>
                      {brief.lead_title && brief.entry_id
                        ? <EarlierTitle entryId={brief.entry_id} title={brief.lead_title} action={requestTranslation} />
                        : <p className="mt-2 text-meta text-ink-faint">{brief.lead_title ?? t('Nothing cleared the bar', '没有内容达到入选标准')}</p>}
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
