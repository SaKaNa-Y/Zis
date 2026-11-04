import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { readLocale } from '@/lib/i18n/server'
import { parseReadingStyle, READING_COOKIE } from '@/lib/settings/preferences'
import { appearanceSettings } from '@/lib/settings/server'
import { generationTime } from '@/lib/settings/timing'
import { DestinationNavigation, MobileDestinationFooter } from '../destinations'
import { AccountControls } from './controls'
import { SettingsPreferences } from './preferences'

export const metadata: Metadata = { title: 'Settings — Zis' }

export default async function SettingsPage() {
  const { userId } = await verifySession()
  const [reader] = await db().select({ timezone: users.timezone, cutHour: users.cutHour }).from(users).where(eq(users.id, userId))
  if (!reader)
    throw new Error('Reader settings are unavailable')
  const appearance = await appearanceSettings.read()
  const locale = await readLocale()
  const reading = parseReadingStyle((await cookies()).get(READING_COOKIE)?.value)
  const { t } = locale
  return (
    <div className="brief-v2 app-shell">
      <DestinationNavigation current="/settings" />
      <div className="min-w-0">
        <main className="page-content">
          <header className="mb-10">
            <p className="eyebrow page-eyebrow">{t('Your space', '你的空间')}</p>
            <h1 className="page-title">{t('Settings', '设置')}</h1>
            <p className="mt-3 text-meta text-ink-dim">{t('Make room for the way you read.', '按你的习惯，安静地阅读。')}</p>
          </header>
          <SettingsPreferences initialAppearance={appearance} initialReading={reading} initialInterface={locale.interfaceLanguage} initialContent={locale.contentLanguage} />
          <section aria-labelledby="account-heading" className="settings-section">
            <h2 id="account-heading" className="settings-heading">{t('Account security', '账户安全')}</h2>
            <AccountControls />
          </section>
          <footer className="mt-8 border-t border-rule pt-6 text-meta text-ink-dim">
            <p>
              {t('Your daily Brief is scheduled to start at', '每日简报计划于')}
              {' '}
              {generationTime()}
              {' '}
              (Asia/Shanghai)
              {t('. It may start or finish later.', ' 开始生成，实际开始或完成时间可能延后。')}
            </p>
            <details className="mt-3">
              <summary className="w-fit cursor-pointer underline underline-offset-4">{t('How timing works', '了解生成时间')}</summary>
              <p className="mt-3">
                {t('Stored timezone', '当前时区')}
                :
                {' '}
                {reader.timezone}
                .
                {' '}
                {t('Cut hour', '生成起始小时')}
                :
                {' '}
                {String(reader.cutHour).padStart(2, '0')}
                :00.
              </p>
              <p className="mt-3">{t('The cut hour is the earliest local hour when a running ingestion may create that day’s Brief. It does not schedule another run or guarantee delivery at that time.', '生成起始小时表示采集任务最早可在当地几点生成当日简报。它不会额外安排任务，也不保证届时完成。')}</p>
            </details>
          </footer>
        </main>
        <MobileDestinationFooter current="/settings" />
      </div>
    </div>
  )
}
