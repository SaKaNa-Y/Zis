import { DestinationNavigation, MobileDestinationFooter } from './destinations'

export default function Loading() {
  return (
    <div className="brief-v2">
      <DestinationNavigation />
      <main className="page-content state-content" aria-busy="true">
        <p className="eyebrow page-eyebrow">A moment of quiet</p>
        <h1 className="page-title">Loading your reading space.</h1>
        <p role="status">Bringing your page into view…</p>
      </main>
      <MobileDestinationFooter />
    </div>
  )
}
