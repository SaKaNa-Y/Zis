import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { readLocale } from '@/lib/i18n/server'
import { parseReadingStyle, READING_COOKIE } from '@/lib/settings/preferences'
import { appearanceSettings } from '@/lib/settings/server'
import { readStorage } from '@/lib/settings/storage'
import { DestinationNavigation } from '../destinations'
import { AccountControls } from './controls'
import { SettingsPreferences } from './preferences'

export const metadata: Metadata = { title: 'Settings — Zis' }

export default async function SettingsPage() {
  const storage = await readStorage()
  const appearance = await appearanceSettings.read()
  const { language, interfaceLanguage, t } = await readLocale()
  const reading = parseReadingStyle((await cookies()).get(READING_COOKIE)?.value)
  const megabytes = (bytes: number) => (bytes / 1_000_000).toLocaleString(language, { maximumFractionDigits: 2 })
  const displayTime = (date: Date) => date.toLocaleString(language, { timeZone: 'Asia/Shanghai', timeZoneName: 'short' })
  return (
    <div className="publication-shell">
      <DestinationNavigation current="/settings" role="author" />
      <main className="page-content">
        <h1 className="page-title">{t('Settings', '设置')}</h1>
        <section className="settings-section" aria-labelledby="storage-heading">
          <h2 id="storage-heading" className="settings-heading">{t('Storage', '存储')}</h2>
          <dl>
            <dt>{t('PostgreSQL database', 'PostgreSQL 数据库')}</dt>
            <dd>
              {megabytes(storage.databaseBytes)}
              {' '}
              MB
            </dd>
            <dt>{t('Remaining Neon Free project storage', 'Neon 项目免费存储余额')}</dt>
            <dd>{storage.project ? `${megabytes(storage.project.remainingBytes)} MB` : t('Unavailable', '暂时无法获取')}</dd>
            {storage.project && (
              <>
                <dt>{t('Neon measured at', 'Neon 计量时间')}</dt>
                <dd>{displayTime(new Date(storage.project.measuredAt))}</dd>
              </>
            )}
          </dl>
          <p>
            {t('Last checked', '最近检查')}
            {' '}
            ·
            {' '}
            {displayTime(storage.checkedAt)}
          </p>
          <form action="/settings" method="get"><button className="underline" type="submit">{t('Refresh storage', '刷新存储数据')}</button></form>
        </section>
        <SettingsPreferences initialAppearance={appearance} initialReading={reading} initialInterface={interfaceLanguage} />
        <section aria-labelledby="account-heading" className="settings-section">
          <h2 id="account-heading" className="settings-heading">{t('Account security', '账户安全')}</h2>
          <AccountControls />
        </section>
      </main>
    </div>
  )
}
