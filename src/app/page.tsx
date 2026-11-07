import type { Metadata } from 'next'
import Link from 'next/link'
import { verifySession } from '@/lib/auth/dal'
import { captureStore } from '@/lib/capture/postgres'
import { readLocale } from '@/lib/i18n/server'
import { InformationCard } from './capture/card'
import { CaptureSchedule, CaptureShell, RunHistory } from './capture/shared'

export const metadata: Metadata = { title: 'Information — Zis' }

export default async function Home({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await verifySession()
  const { t } = await readLocale()
  const { before } = await searchParams
  const [cards, sources, runs] = await Promise.all([captureStore.listCards(31, before), captureStore.listSources(), captureStore.listRuns()])
  const visible = cards.slice(0, 30)
  const last = visible.at(-1)
  return (
    <CaptureShell current="/">
      <header className="capture-heading">
        <p className="eyebrow">{t('Original words. In order.', '原文，按时间呈现。')}</p>
        <h1 className="page-title">{t('Information', '信息流')}</h1>
        <p>{t('Full original content, newest publication first. Thread updates keep their original position. Text and images expire seven days after first capture.', '完整原文，按原文发布时间倒序排列。推文串续更保持原位置；正文和图片自首次录入起七天后删除。')}</p>
        <Link className="capture-button" href="/capture">
          {t('Add information', '添加信息')}
          {' '}
          +
        </Link>
      </header>
      <CaptureSchedule t={t} />
      <RunHistory runs={runs.slice(0, 6)} sources={sources} t={t} />
      <section aria-label={t('Information cards', '信息卡片')} className="capture-feed">
        {visible.length
          ? visible.map(card => <InformationCard key={card.id} card={card} t={t} />)
          : (
              <div className="capture-empty">
                <h2>{t(before ? 'No more information' : 'Your information stream starts here', before ? '没有更早的信息' : '从这里开始你的信息流')}</h2>
                <p>{t('Add a source, then save complete original text and images through Add information. No content has been generated or imported automatically.', '先添加来源，再通过“添加信息”保存完整原文和图片。内容不会自动生成或导入。')}</p>
                <Link href="/sources">
                  {t('Manage sources', '管理来源')}
                  {' '}
                  →
                </Link>
              </div>
            )}
      </section>
      <nav className="capture-pagination" aria-label={t('Information pagination', '信息流分页')}>
        {before && (
          <Link href="/">
            ←
            {t('Newest', '最新信息')}
          </Link>
        )}
        {cards.length > 30 && last && (
          <Link href={`/?before=${encodeURIComponent(`${last.publishedAt}|${last.id}`)}`}>
            {t('Older information', '更早的信息')}
            {' '}
            →
          </Link>
        )}
      </nav>
    </CaptureShell>
  )
}
