import Link from 'next/link'
import { DestinationNavigation, MobileDestinationFooter } from './destinations'

export default function NotFound() {
  return (
    <div className="brief-v2">
      <DestinationNavigation />
      <main className="page-content state-content">
        <p className="eyebrow page-eyebrow">Not here</p>
        <h1 className="page-title">This page is unavailable.</h1>
        <p>The link may be incomplete, or the page may no longer be available.</p>
        <Link href="/" className="entry-action">Return to Today</Link>
      </main>
      <MobileDestinationFooter />
    </div>
  )
}
