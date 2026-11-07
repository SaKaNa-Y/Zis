'use client'

import Link from 'next/link'
import { Text, useLocale } from '@/lib/i18n/context'

const DESTINATIONS = [
  { href: '/', label: 'Information', zh: '信息流', path: 'M4 5h16v15H4z M8 9h8 M8 13h8 M8 17h5' },
  { href: '/capture', label: 'Add information', zh: '添加信息', path: 'M12 4v16 M4 12h16' },
  { href: '/sources', label: 'Sources', zh: '来源管理', path: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6' },
  { href: '/settings', label: 'Settings', zh: '设置', path: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
] as const

type DestinationHref = typeof DESTINATIONS[number]['href'] | '/earlier' | '/saved' | '/interests'

function DestinationIcon({ path }: { path: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}

export function DestinationNavigation({ current }: { current?: DestinationHref }) {
  const { t } = useLocale()
  return (
    <header className="brief-nav">
      <ZisBrand />
      <nav aria-label={t('Primary navigation', '主导航')}>
        {DESTINATIONS.map(({ href, label, zh }) => <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>{t(label, zh)}</Link>)}
      </nav>
      <span className="brief-nav-note"><Text en="A little clarity, every day." zh="每天，多一点清晰。" /></span>
    </header>
  )
}

export function ZisBrand() {
  const { t } = useLocale()
  return (
    <Link className="brief-brand" href="/" aria-label={t('Zis — Information', 'Zis — 信息流')}>
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M6 7h20L9 25h17" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M5 25 25 7" stroke="url(#zis-violet)" strokeWidth="5" />
        <defs>
          <linearGradient id="zis-violet">
            <stop stopColor="#6c3bff" />
            <stop offset="1" stopColor="#b39aff" />
          </linearGradient>
        </defs>
      </svg>
      <span>Zis</span>
    </Link>
  )
}

export function MobileDestinationFooter({ current }: { current?: DestinationHref }) {
  const { t } = useLocale()
  return (
    <footer className="mobile-destinations">
      <p className="eyebrow"><Text en="Your reading space" zh="你的阅读空间" /></p>
      <nav aria-label={t('Footer navigation', '页尾导航')}>
        {DESTINATIONS.map(destination => (
          <Link aria-current={destination.href === current ? 'page' : undefined} href={destination.href} key={destination.href}>
            <DestinationIcon path={destination.path} />
            <span>{t(destination.label, destination.zh)}</span>
          </Link>
        ))}
      </nav>
    </footer>
  )
}
