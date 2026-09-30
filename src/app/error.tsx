'use client'

import Link from 'next/link'
import { DestinationNavigation, MobileDestinationFooter } from './destinations'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="brief-v2">
      <DestinationNavigation />
      <main className="page-content state-content">
        <p className="eyebrow page-eyebrow">An interruption</p>
        <h1 className="page-title">This page could not load.</h1>
        <p role="alert">Please try again. If this continues, return to Today and come back later.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="entry-action">Try again</button>
          <Link href="/" className="entry-action">Return to Today</Link>
        </div>
      </main>
      <MobileDestinationFooter />
    </div>
  )
}
