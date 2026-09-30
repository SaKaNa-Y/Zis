import type { Metadata } from 'next'
import { savedPageNumber } from '@/lib/bookmarks/saved'
import { savedBookmarks } from '@/lib/bookmarks/server'
import { DestinationNavigation, MobileDestinationFooter } from '../destinations'
import { SavedList } from './list'

export const metadata: Metadata = { title: 'Saved — Zis' }

export default async function SavedPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const params = await searchParams
  const saved = await savedBookmarks.read(savedPageNumber(params.page))
  return (
    <div className="brief-v2 app-shell">
      <DestinationNavigation current="/saved" />
      <div className="min-w-0">
        <main className="page-content">
          <p className="eyebrow page-eyebrow">Your collection</p>
          <h1 className="page-title">Saved</h1>
          <p className="mt-2 text-meta text-ink-dim">Signals you kept, most recently saved first. Saving does not put a Signal back into a Brief.</p>
          <SavedList key={saved.page} saved={saved} />
        </main>
        <MobileDestinationFooter current="/saved" />
      </div>
    </div>
  )
}
