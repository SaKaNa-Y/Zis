import type { Metadata } from 'next'
import { savedPageNumber } from '@/lib/bookmarks/saved'
import { savedBookmarks } from '@/lib/bookmarks/server'
import { DesktopDestinationRail, MobileDestinationFooter } from '../destinations'
import { SavedList } from './list'

export const metadata: Metadata = { title: 'Saved — Zis' }

export default async function SavedPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const params = await searchParams
  const saved = await savedBookmarks.read(savedPageNumber(params.page))
  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopDestinationRail current="/saved" />
      <div className="min-w-0">
        <main className="mx-auto max-w-measure px-5 py-10 sm:px-8 lg:max-w-measure-lg lg:px-12 lg:py-14">
          <h1 className="font-display text-title font-semibold tracking-[-0.025em] lg:text-title-lg">Saved</h1>
          <p className="mt-2 text-meta text-ink-dim">Signals you kept, most recently saved first. Saving does not put a Signal back into a Brief.</p>
          <SavedList key={saved.page} saved={saved} />
        </main>
        <MobileDestinationFooter current="/saved" />
      </div>
    </div>
  )
}
