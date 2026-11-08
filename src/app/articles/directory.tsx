'use client'

import type { ArticleSummary } from '@/lib/articles/types'
import Link from 'next/link'
import { useLocale } from '@/lib/i18n/context'

export function PublicationDate({ date }: { date: Date }) {
  const { language } = useLocale()
  return <time dateTime={date.toISOString()}>{date.toLocaleDateString(language, { dateStyle: 'long', timeZone: 'Asia/Shanghai' })}</time>
}

export function ArticleDirectory({ articles, home }: { articles: ArticleSummary[], home: boolean }) {
  const { t } = useLocale()
  const lead = home ? articles[0] : undefined
  const remaining = lead ? articles.slice(1, 7) : articles
  return (
    <main className="page-content publication-index">
      {lead
        ? (
            <article className="publication-lead">
              <div>
                <PublicationDate date={lead.publishedAt} />
                <h1 className="page-title"><Link href={`/articles/${lead.id}`}>{lead.title}</Link></h1>
                <p>{lead.standfirst}</p>
              </div>
              {lead.imageUrl && <img src={lead.imageUrl} alt="" referrerPolicy="no-referrer" />}
            </article>
          )
        : <h1 className="page-title">{t('Articles', '文章目录')}</h1>}
      {home && lead && (
        <header className="index-section">
          <h2>{t('Recent articles', '近期文章')}</h2>
          <Link href="/articles">{t('View all articles', '查看全部文章')}</Link>
        </header>
      )}
      <ul className="publication-list">
        {remaining.map(article => (
          <li key={article.id}>
            <PublicationDate date={article.publishedAt} />
            <div>
              <h2><Link href={`/articles/${article.id}`}>{article.title}</Link></h2>
              <p>{article.standfirst}</p>
            </div>
          </li>
        ))}
      </ul>
      {!articles.length && <p>{t('No articles have been published yet.', '尚无已发布的文章。')}</p>}
    </main>
  )
}
