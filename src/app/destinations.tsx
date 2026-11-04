'use client'

import Link from 'next/link'

import { Text, useLocale } from '@/lib/i18n/context'

const DESTINATIONS = [
  { href: '/', label: 'Today', zh: '今天' },
  { href: '/earlier', label: 'Earlier', zh: '往期' },
  { href: '/saved', label: 'Saved', zh: '收藏' },
  { href: '/interests', label: 'Interests', zh: '关注兴趣' },
  { href: '/settings', label: 'Settings', zh: '设置' },
] as const

type DestinationHref = typeof DESTINATIONS[number]['href']

export function DesktopDestinationRail({ current }: { current?: DestinationHref }) {
  const { t } = useLocale()
  return (
    <aside className="hidden border-r border-rule px-8 py-12 lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start">
      <p className="font-mono text-date font-semibold uppercase tracking-[0.22em] text-ink">
        Zis
      </p>
      <nav aria-label={t('Primary navigation', '主导航')} className="mt-10 text-meta">
        {DESTINATIONS.map(destination => (
          <Link
            aria-current={destination.href === current ? 'page' : undefined}
            className={destination.href === current ? 'block py-1.5 text-ink' : 'block py-1.5 text-ink-faint hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {t(destination.label, destination.zh)}
          </Link>
        ))}
      </nav>
      <p className="mt-12 max-w-[10rem] text-meta text-ink-faint">
        <Text en="A private, bounded brief. It ends on purpose." zh="私人的每日简报，读完即可安心离开。" />
      </p>
    </aside>
  )
}

export function MobileDestinationFooter({ current }: { current?: DestinationHref }) {
  const { t } = useLocale()
  return (
    <footer className="mx-5 border-t border-rule pb-10 pt-5 lg:hidden">
      <nav aria-label={t('Footer navigation', '页尾导航')} className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint">
        {DESTINATIONS.map(destination => (
          <Link
            aria-current={destination.href === current ? 'page' : undefined}
            className={destination.href === current ? 'text-ink' : 'hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {t(destination.label, destination.zh)}
          </Link>
        ))}
      </nav>
    </footer>
  )
}
