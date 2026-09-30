import Link from 'next/link'

const DESTINATIONS = [
  { href: '/', label: 'Today', path: 'M4 5h16v15H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3' },
  { href: '/earlier', label: 'Earlier', path: 'M4 5h16v4H4z M6 9v11h12V9 M9 13h6' },
  { href: '/saved', label: 'Saved', path: 'M6 4h12v17l-6-4-6 4z' },
  { href: '/interests', label: 'Interests', path: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6' },
  { href: '/settings', label: 'Settings', path: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
] as const

type DestinationHref = typeof DESTINATIONS[number]['href']

function DestinationIcon({ path }: { path: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}

export function DestinationNavigation({ current }: { current?: DestinationHref }) {
  return (
    <header className="brief-nav">
      <ZisBrand />
      <nav aria-label="Primary navigation">
        {DESTINATIONS.map(({ href, label }) => <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <span className="brief-nav-note">A little clarity, every day.</span>
    </header>
  )
}

export function ZisBrand() {
  return (
    <Link className="brief-brand" href="/" aria-label="Zis — Today">
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
  return (
    <footer className="mobile-destinations">
      <p className="eyebrow">Your reading space</p>
      <nav aria-label="Footer navigation">
        {DESTINATIONS.map(destination => (
          <Link aria-current={destination.href === current ? 'page' : undefined} href={destination.href} key={destination.href}>
            <DestinationIcon path={destination.path} />
            <span>{destination.label}</span>
          </Link>
        ))}
      </nav>
    </footer>
  )
}
