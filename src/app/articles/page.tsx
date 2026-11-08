import { listArticles } from '@/lib/articles/service'
import { verifySession } from '@/lib/auth/dal'
import { DestinationNavigation } from '../destinations'
import { ArticleDirectory } from './directory'

export const metadata = { title: 'Articles — Zis' }

export default async function ArticlesPage() {
  const { role } = await verifySession()
  return (
    <div className="publication-shell">
      <DestinationNavigation role={role} current="/articles" />
      <ArticleDirectory articles={await listArticles()} home={false} />
    </div>
  )
}
