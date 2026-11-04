import type { Metadata } from 'next'
import { requestTranslation } from '@/app/translation-actions'
import { savedPageNumber } from '@/lib/bookmarks/saved'
import { savedBookmarks } from '@/lib/bookmarks/server'
import { Text } from '@/lib/i18n/context'
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
          <p className="eyebrow page-eyebrow"><Text en="Your collection" zh="你的收藏" /></p>
          <h1 className="page-title"><Text en="Saved" zh="收藏" /></h1>
          <p className="mt-2 text-meta text-ink-dim"><Text en="Signals you kept, most recently saved first. Saving does not put a Signal back into a Brief." zh="你收藏的内容，按收藏时间从新到旧排列。收藏不会让内容再次出现在简报中。" /></p>
          <SavedList translationAction={requestTranslation} key={saved.page} saved={saved} />
        </main>
        <MobileDestinationFooter current="/saved" />
      </div>
    </div>
  )
}
