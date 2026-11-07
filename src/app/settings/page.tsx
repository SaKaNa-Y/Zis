import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'
import { parseReadingStyle, READING_COOKIE } from '@/lib/settings/preferences'
import { appearanceSettings } from '@/lib/settings/server'
import { DestinationNavigation, MobileDestinationFooter } from '../destinations'
import { AccountControls } from './controls'
import { SettingsPreferences } from './preferences'

export const metadata: Metadata = { title: 'Settings — Zis' }

export default async function SettingsPage() {
  await verifySession()
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
            <p>{t('Legacy Brief generation and Interest filtering are retired. Earlier Briefs and Saved items remain in the archive.', '旧简报生成与兴趣筛选已停用。以往简报和收藏仍保留在归档中。')}</p>
            <p className="mt-3">{t('Planned collection starts: 08:00 and 20:00 Asia/Shanghai. An external collector must be configured separately; these are start times, not completion guarantees.', '计划采集开始时间：北京时间 08:00、20:00。需要另行配置外部采集任务；这是开始时间，不保证届时完成。')}</p>
          </footer>
        </main>
        <MobileDestinationFooter current="/settings" />
      </div>
    </div>
  )
}
