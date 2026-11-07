import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { captureStore } from '@/lib/capture/postgres'
import { readLocale } from '@/lib/i18n/server'
import { CaptureForm } from './form'
import { CaptureShell } from './shared'

export const metadata: Metadata = { title: 'Add information — Zis' }
export default async function CapturePage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  await verifySession()
  const { t } = await readLocale()
  const { card: cardId } = await searchParams
  const initial = cardId ? await captureStore.getCard(cardId) : undefined
  if (cardId && !initial)
    notFound()
  const [sources, usage] = await Promise.all([captureStore.listSources(), captureStore.storageUsage()])
  return (
    <CaptureShell current="/capture">
      <header className="capture-heading">
        <p className="eyebrow">{t('Keep the original', '保存原文')}</p>
        <h1 className="page-title">{initial ? t('Update information', '续更／补全信息') : t('Add information', '添加信息')}</h1>
        <p>{t('Save a post, an author’s thread, or a complete blog item. This is also the authenticated entry point for browser collection.', '保存单条内容、作者推文串或完整博客。这也是浏览器采集使用的登录后录入入口。')}</p>
      </header>
      <div className="capture-storage">
        <p>
          {t('Capture storage', '采集存储')}
          :
          {' '}
          {(usage.bytes / 1024 / 1024).toFixed(1)}
          {' '}
          /
          {' '}
          {(usage.limitBytes / 1024 / 1024).toFixed(0)}
          {' '}
          MiB
        </p>
        <progress value={usage.bytes} max={Math.max(usage.limitBytes, 1)} aria-label={t('Capture storage usage', '采集存储用量')} />
        <p className="capture-note">{t('Uploads stop at the configured limit; there is no paid overflow.', '达到配置上限即停止上传，不自动付费扩容。')}</p>
      </div>
      {sources.some(source => source.enabled)
        ? <CaptureForm sources={sources} initial={initial ?? undefined} />
        : (
            <p className="capture-empty">
              {t('Enable a source before saving content.', '请先启用来源，再保存内容。')}
              {' '}
              <Link href="/sources">
                {t('Manage sources', '管理来源')}
                {' '}
                →
              </Link>
            </p>
          )}
    </CaptureShell>
  )
}
