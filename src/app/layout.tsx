import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LocaleProvider } from '@/lib/i18n/context'
import { readLocale } from '@/lib/i18n/server'
import { parseReadingStyle, READING_COOKIE } from '@/lib/settings/preferences'
import { appearanceSettings } from '@/lib/settings/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zis',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await appearanceSettings.read()
  const locale = await readLocale()
  const reading = parseReadingStyle((await cookies()).get(READING_COOKIE)?.value)
  return (
    <html lang={locale.language === 'zh' ? 'zh-CN' : 'en'} className={appearance} data-reading-size={reading.size} data-reading-font={reading.font}>
      <body><LocaleProvider language={locale.language} contentLanguage={locale.contentLanguage}>{children}</LocaleProvider></body>
    </html>
  )
}
