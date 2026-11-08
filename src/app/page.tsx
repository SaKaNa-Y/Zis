import { listArticles } from '@/lib/articles/service'
import { verifySession } from '@/lib/auth/dal'
import { ArticleDirectory } from './articles/directory'
import { DestinationNavigation } from './destinations'

export default async function Home() {
  const { role } = await verifySession()
  return (
    <div className="publication-shell">
      <DestinationNavigation role={role} current="/" />
      <ArticleDirectory articles={await listArticles()} home />
    </div>
  )
}
