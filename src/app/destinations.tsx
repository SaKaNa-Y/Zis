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
        {role === 'author' && (
          <>
            {link('/history', 'History', '发布历史')}
            <details className="author-menu">
              <summary>{t('Author', '作者')}</summary>
              <div>
                {link('/write', 'Write article', '写文章')}
                {link('/saved', 'Bookmarks', '收藏')}
                {link('/settings', 'Settings', '设置')}
              </div>
            </details>
          </>
        )}
      </nav>
    </header>
  )
}
