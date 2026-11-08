import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticle, getDraft } from '@/lib/articles/service'
import { verifySession } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'
import { DestinationNavigation } from '../../destinations'
import { ArticleReader } from '../reader'
import { ArticleEditor } from './editor'

export default async function ArticlePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string, saved?: string }>
}) {
  const { role } = await verifySession()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const editing = query.edit === '1'
  if (editing && role !== 'author')
    notFound()
  const article = await getArticle(id)
  if (!article)
    notFound()
  const { t } = await readLocale()
  const draft = editing ? await getDraft(id) : null
  const href = `/articles/${article.id}`
  return (
    <div className="publication-shell">
      <DestinationNavigation role={role} />
      <main className="publication-detail">
        <div className="detail-nav">
          <Link href="/articles">{t('Article directory', '文章目录')}</Link>
          {role === 'author' && <Link href={editing ? href : `${href}?edit=1`}>{editing ? t('View published article', '查看已发布文章') : t('Edit article', '编辑文章')}</Link>}
        </div>
        {editing
          ? <ArticleEditor key={JSON.stringify(draft)} initial={draft ?? article} saved={draft} id={id} showSaved={query.saved === '1'} />
          : <ArticleReader article={article} />}
      </main>
    </div>
  )
}
