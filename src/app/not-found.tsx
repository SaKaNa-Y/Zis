import Link from 'next/link'
import { Text } from '@/lib/i18n/context'

export default function NotFound() {
  return (
    <main className="page-content publication-state">
      <h1 className="page-title"><Text en="Page unavailable" zh="页面不可用" /></h1>
      <Link href="/"><Text en="Return home" zh="返回首页" /></Link>
    </main>
  )
}
