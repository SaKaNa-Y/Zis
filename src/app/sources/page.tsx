import type { Metadata } from 'next'
import { verifySession } from '@/lib/auth/dal'
import { captureStore } from '@/lib/capture/postgres'
import { readLocale } from '@/lib/i18n/server'
import { CaptureSchedule, CaptureShell, CaptureTime, RunHistory } from '../capture/shared'
import { BackfillForm, RunForm, SourceForm } from './forms'

export const metadata: Metadata = { title: 'Sources — Zis' }
export default async function SourcesPage() {
  await verifySession()
  const { t } = await readLocale()
  const [sources, runs] = await Promise.all([captureStore.listSources(), captureStore.listRuns()])
  return (
    <CaptureShell current="/sources">
      <header className="capture-heading">
        <p className="eyebrow">{t('Follow the source', '从来源开始')}</p>
        <h1 className="page-title">{t('Sources', '来源管理')}</h1>
        <p>{t('New sources start tracking at activation. Use Allow backfill below to include earlier content. Capture original posts, quotes and author continuations, excluding pure reposts and ordinary replies.', '新来源从启用时开始追踪；如需更早内容，可在下方允许补采。收录原创、引用及作者自我续帖，排除纯转推和普通回复。')}</p>
      </header>
      <CaptureSchedule t={t} />
      <section className="capture-section">
        <h2>{t('Configured sources', '已配置来源')}</h2>
        {sources.length === 0 && <p className="capture-note">{t('No sources yet. Add the verified profile or official blog below.', '尚无来源。请在下方添加已核验的账号主页或官方博客。')}</p>}
        {sources.map((source) => {
          const latest = runs.find(run => run.sourceId === source.id)
          return (
            <details className="capture-source" key={source.id}>
              <summary>
                <strong>{source.name}</strong>
                {' '}
                ·
                {' '}
                {source.kind === 'x' ? 'X' : t('Blog', '博客')}
                {' '}
                ·
                {' '}
                {source.enabled ? t('Enabled', '已启用') : t('Paused', '已停用')}
                {latest && (latest.status === 'failed' || latest.status === 'partial') && <span className="capture-status capture-status-failed">{latest.status === 'failed' ? t('Latest run failed', '最近采集失败') : t('Latest run incomplete', '最近采集不完整')}</span>}
              </summary>
              <p>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                  {' '}
                  ↗
                </a>
              </p>
              <p className="capture-note">
                {t('Tracking since', '开始追踪于')}
                {' '}
                <CaptureTime value={source.trackingSince} />
              </p>
              {latest?.message && <p className="capture-note">{latest.message}</p>}
              <SourceForm source={source} />
            </details>
          )
        })}
      </section>
      <section className="capture-section">
        <h2>{t('Add a source', '添加来源')}</h2>
        <SourceForm />
      </section>
      <section className="capture-section">
        <h2>{t('Allow historical backfill', '允许历史补采')}</h2>
        <BackfillForm />
      </section>
      <RunHistory runs={runs} sources={sources} t={t} />
      <section className="capture-section">
        <h2>{t('Report a collection attempt', '记录采集尝试')}</h2>
        <RunForm sources={sources} />
      </section>
    </CaptureShell>
  )
}
