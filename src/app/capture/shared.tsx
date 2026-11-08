import type { CaptureRun, CaptureSource } from '@/lib/capture/model'
import Link from 'next/link'
import { DestinationNavigation } from '../destinations'

export type Translate = (en: string, zh: string) => string

export function CaptureShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="brief-v2 app-shell capture-shell">
      <DestinationNavigation role="author" />
      <main className="page-content capture-content">{children}</main>
    </div>
  )
}

export function CaptureTime({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      {new Date(value).toISOString().replace('T', ' ').slice(0, 16)}
      {' '}
      UTC
    </time>
  )
}

export function CaptureSchedule({ t }: { t: Translate }) {
  return <p className="capture-note">{t('Collection is planned for 08:00 and 20:00 Beijing time. The automatic browser schedule is not configured; recorded runs below are actual reports.', '计划每天北京时间 08:00、20:00 开始采集。自动浏览器定时任务尚未配置；下方仅展示实际记录的采集报告。')}</p>
}

export function RunHistory({ runs, sources, t }: { runs: CaptureRun[], sources: CaptureSource[], t: Translate }) {
  return (
    <section className="capture-section" aria-labelledby="runs-heading">
      <h2 id="runs-heading">{t('Collection activity', '采集动态')}</h2>
      {runs.length === 0
        ? <p className="capture-note">{t('No collection runs have been reported yet.', '尚无采集报告。')}</p>
        : (
            <ol className="capture-runs">
              {runs.map(run => (
                <li key={run.id}>
                  <div className="capture-meta">
                    <strong>{sources.find(s => s.id === run.sourceId)?.name ?? t('Unknown source', '未知来源')}</strong>
                    <span className={`capture-status capture-status-${run.status}`}>{({ running: t('Running', '采集中'), success: t('Success', '成功'), partial: t('Incomplete', '不完整'), failed: t('Failed', '失败') })[run.status]}</span>
                    <span>
                      {run.addedCount}
                      {' '}
                      {t('added', '条新增')}
                    </span>
                  </div>
                  <p>
                    <CaptureTime value={run.finishedAt ?? run.startedAt} />
                    {run.message && (
                      <>
                        {' · '}
                        {run.message}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
      <Link href="/sources">
        {t('Manage sources and report a run', '管理来源并记录采集结果')}
        {' '}
        →
      </Link>
    </section>
  )
}
