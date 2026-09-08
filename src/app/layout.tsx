import type { Metadata } from 'next'
import { appearanceSettings } from '@/lib/settings/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zis',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await appearanceSettings.read()
  return (
    <html lang="en" className={appearance}>
      <body>{children}</body>
    </html>
  )
}
