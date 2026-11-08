import { Text } from '@/lib/i18n/context'

export default function Loading() {
  return <main className="page-content publication-state" aria-busy="true"><p role="status"><Text en="Loading…" zh="正在加载…" /></p></main>
}
