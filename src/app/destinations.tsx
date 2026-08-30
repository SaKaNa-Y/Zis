import Link from 'next/link'

const DESTINATIONS = [
  { href: '/', label: 'Today' },
  { href: '/earlier', label: 'Earlier' },
  { href: '/saved', label: 'Saved' },
  { href: '/interests', label: 'Interests' },
  { href: '/settings', label: 'Settings' },
] as const

type DestinationHref = typeof DESTINATIONS[number]['href']

export function DesktopDestinationRail({ current }: { current?: DestinationHref }) {
  return (
    <aside className="hidden border-r border-rule px-8 py-12 lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start">
      <p className="font-mono text-date font-semibold uppercase tracking-[0.22em] text-ink">
        Zis
      </p>
      <nav aria-label="Primary navigation" className="mt-10 text-meta">
        {DESTINATIONS.map(destination => (
          <Link
            aria-current={destination.href === current ? 'page' : undefined}
            className={destination.href === current ? 'block py-1.5 text-ink' : 'block py-1.5 text-ink-faint hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {destination.label}
          </Link>
        ))}
      </nav>
      <p className="mt-12 max-w-[10rem] text-meta text-ink-faint">
        A private, bounded brief. It ends on purpose.
      </p>
    </aside>
  )
}

export function MobileDestinationFooter({ current }: { current?: DestinationHref }) {
  return (
    <footer className="mx-5 border-t border-rule pb-10 pt-5 lg:hidden">
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint">
        {DESTINATIONS.map(destination => (
          <Link
            aria-current={destination.href === current ? 'page' : undefined}
            className={destination.href === current ? 'text-ink' : 'hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {destination.label}
          </Link>
        ))}
      </nav>
    </footer>
  )
}
