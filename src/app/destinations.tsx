'use client'

import type { VerifiedSession } from '@/lib/auth/dal'
import Link from 'next/link'
import { useLocale } from '@/lib/i18n/context'

export function ZisBrand() {
  const { t } = useLocale()
  return <Link className="publication-brand" href="/" aria-label={t('Zis home', 'Zis 首页')}>Zis</Link>
}

export function DestinationNavigation({ current, role = 'reader' }: { current?: string, role?: VerifiedSession['role'] }) {
  const { t } = useLocale()
  const link = (href: string, en: string, zh: string) =>
    <Link href={href} aria-current={current === href ? 'page' : undefined}>{t(en, zh)}</Link>

  return (
    <header className="publication-header">
      <ZisBrand />
      <nav aria-label={t('Primary navigation', '主导航')}>
        {link('/', 'Home', '首页')}
        {link('/articles', 'Articles', '文章目录')}
      </nav>
      {role === 'author' && (
        <nav className="author-navigation" aria-label={t('Author navigation', '作者工作导航')}>
          {link('/write', 'Write article', '写文章')}
          {link('/collection', 'Collected material', '采集资料')}
          {link('/capture', 'Add information', '添加信息')}
          {link('/sources', 'Sources', '来源管理')}
          {link('/publish', 'Publication workspace', '发布工作区')}
          {link('/history', 'History', '发布历史')}
          {link('/saved', 'Bookmarks', '收藏')}
          {link('/settings', 'Settings', '设置')}
        </nav>
      )}
    </header>
  )
}
