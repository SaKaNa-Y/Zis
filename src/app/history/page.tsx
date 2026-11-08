import { listPublicationRuns } from '@/lib/articles/service'
import { verifyAuthor } from '@/lib/auth/dal'
import { DestinationNavigation } from '../destinations'
import { PublicationHistory } from './history'

export const metadata = { title: 'Publication history — Zis' }

export default async function HistoryPage() {
  await verifyAuthor()
  return (
    <div className="publication-shell">
      <DestinationNavigation current="/history" role="author" />
      <PublicationHistory runs={await listPublicationRuns()} now={new Date()} />
    </div>
  )
}
