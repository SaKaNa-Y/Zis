import type { Metadata } from 'next'
import Link from 'next/link'
import { readArchivedBookmarks } from '@/lib/bookmarks/server'
import { readLocale } from '@/lib/i18n/server'
import { DestinationNavigation } from '../destinations'

export const metadata: Metadata = { title: 'Bookmarks — Zis' }

export default async function SavedPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { page: requested } = await searchParams
  const page = typeof requested === 'string' && /^[1-9]\d{0,6}$/.test(requested) ? Number(requested) : 1
  const { entries, hasNext } = await readArchivedBookmarks(page)
  const { language, t } = await readLocale()
  return (
    <div className="publication-shell">
      <DestinationNavigation current="/saved" role="author" />
      <main className="page-content">
        <h1 className="page-title">{t('Bookmarks', '收藏')}</h1>
        {entries.length === 0 && <p>{t('No saved bookmarks.', '暂无收藏。')}</p>}
        {entries.map(entry => (
          <article key={entry.id} className="settings-section">
            <h2 className="settings-heading">{entry.title}</h2>
            <time dateTime={entry.savedAt.toISOString()}>{entry.savedAt.toLocaleDateString(language, { timeZone: 'Asia/Shanghai' })}</time>
            {entry.body
              ? <p className="reading-body whitespace-pre-line">{entry.body}</p>
              : entry.summary && (
                <p className="reading-body">
                  {t('Summary', '摘要')}
                  {' '}
                  ·
                  {' '}
                  {entry.summary}
                </p>
              )}
            {/^https?:\/\//i.test(entry.url) && <a className="underline" href={entry.url}>{t('Open original', '查看原文')}</a>}
          </article>
        ))}
        <nav aria-label={t('Bookmark pages', '收藏分页')}>
          {page > 1 && <Link href={`/saved?page=${page - 1}`}>{t('Previous page', '上一页')}</Link>}
          {hasNext && <Link href={`/saved?page=${page + 1}`}>{t('Next page', '下一页')}</Link>}
        </nav>
      </main>
    </div>
  )
}
