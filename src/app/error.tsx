'use client'

import Link from 'next/link'
import { Text } from '@/lib/i18n/context'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-content publication-state">
      <h1 className="page-title"><Text en="This page could not load." zh="页面加载失败。" /></h1>
      <button onClick={reset}><Text en="Try again" zh="重试" /></button>
      <Link href="/"><Text en="Return home" zh="返回首页" /></Link>
    </main>
  )
}
