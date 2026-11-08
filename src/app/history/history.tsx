'use client'

import type { PublicationRun } from '@/lib/articles/types'
import Link from 'next/link'
import { useLocale } from '@/lib/i18n/context'

const zone = 'Asia/Shanghai'
const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })

export function PublicationHistory({ runs, now }: { runs: PublicationRun[], now: Date }) {
  const { t, language } = useLocale()
  const labels = {
    running: t('Running', '运行中'),
    empty: t('Finished without publication', '已完成，未发布文章'),
    published: t('Published', '已发布'),
    failed: t('Failed', '失败'),
  }
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: zone })
  const time = new Intl.DateTimeFormat(language, { timeStyle: 'short', timeZone: zone })
  const timestamp = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'medium', timeZone: zone })
  const groups = new Map<string, { date: Date, runs: PublicationRun[] }>()
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(now.valueOf() - offset * 86_400_000)
    groups.set(localDay.format(day), { date: day, runs: [] })
  }
  for (const run of runs.toSorted((a, b) => b.startedAt.valueOf() - a.startedAt.valueOf())) {
    const key = localDay.format(run.startedAt)
    const group = groups.get(key) ?? { date: run.startedAt, runs: [] }
    group.runs.push(run)
    groups.set(key, group)
  }
  const ids = new Set(runs.map(run => run.id))
  return (
    <main className="page-content publication-history">
      <h1 className="page-title">{t('Publication history', '发布历史')}</h1>
      {Array.from(groups, ([day, group]) => (
        <section key={day}>
          <h2>{date.format(group.date)}</h2>
          {!group.runs.length && <p>{t('No publication attempts', '当天没有发布尝试')}</p>}
          {group.runs.map(run => (
            <details className="history-run" id={`run-${run.id}`} key={run.id}>
              <summary>
                <time dateTime={run.startedAt.toISOString()}>{time.format(run.startedAt)}</time>
                {' '}
                {labels[run.status]}
              </summary>
              <dl>
                <dt>{t('Started', '开始时间')}</dt>
                <dd>{timestamp.format(run.startedAt)}</dd>
                {run.finishedAt && (
                  <>
                    <dt>{t('Finished', '结束时间')}</dt>
                    <dd>{timestamp.format(run.finishedAt)}</dd>
                  </>
                )}
              </dl>
              {run.stages.length > 0 && (
                <ol>
                  {run.stages.map((stage, i) => (
                    <li key={i}>
                      {stage.name}
                      {' '}
                      <time dateTime={stage.at}>{time.format(new Date(stage.at))}</time>
                    </li>
                  ))}
                </ol>
              )}
              {run.reason && <p>{run.reason}</p>}
              {run.articles.length > 0 && <ul>{run.articles.map(article => <li key={article.id}><Link href={`/articles/${article.id}`}>{article.title}</Link></li>)}</ul>}
              {run.retryOf && (ids.has(run.retryOf)
                ? <a href={`#run-${run.retryOf}`}>{t('Previous attempt', '上一次尝试')}</a>
                : <p>{t('Previous attempt expired', '上一次尝试已过期')}</p>)}
            </details>
          ))}
        </section>
      ))}
    </main>
  )
}
