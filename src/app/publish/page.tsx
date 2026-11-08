import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPublicationRuns } from '@/lib/articles/service'
import { verifyAuthor } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'
import { CaptureShell } from '../capture/shared'
import { finishPublication, openPublication, updatePublication } from './actions'

export default async function ProducerPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  await verifyAuthor()
  const { t } = await readLocale()
  const { run: id } = await searchParams
  const run = id ? (await listPublicationRuns()).find(row => row.id === id) : undefined
  if (id && !run)
    notFound()
  return (
    <CaptureShell current="/publish">
      <h1 className="page-title">{t('Publication workspace', '发布工作区')}</h1>
      <p>
        <Link href="/collection">{t('Collected material', '采集资料')}</Link>
        {' '}
        ·
        {' '}
        <Link href="/sources">{t('Configured sources', '已配置来源')}</Link>
      </p>
      {!run
        ? (
            <form className="workspace-form" action={openPublication}>
              <label>
                {t('Attempt key', '发布尝试标识')}
                <input required name="attempt" placeholder="2026-11-08-evening" maxLength={120} />
              </label>
              <button type="submit">{t('Start or resume attempt', '开始或恢复发布尝试')}</button>
            </form>
          )
        : run.status === 'running'
          ? (
              <>
                <p>
                  {t('Attempt', '发布尝试')}
                  {' '}
                  {run.id}
                  {' '}
                  ·
                  {' '}
                  {run.stages.at(-1)?.name ?? t('Started', '已开始')}
                </p>
                <form className="workspace-form" action={updatePublication}>
                  <input type="hidden" name="run" value={run.id} />
                  <label>
                    {t('Current stage', '当前阶段')}
                    <input required name="stage" />
                  </label>
                  <button type="submit">{t('Record stage', '记录阶段')}</button>
                </form>
                <form className="workspace-form" action={finishPublication}>
                  <input type="hidden" name="run" value={run.id} />
                  <label>
                    {t('Articles (JSON array)', '文章（JSON 数组）')}
                    <textarea required name="outputs" rows={10} placeholder="[]" />
                  </label>
                  <label>
                    {t('Reason for publishing zero articles', '未发布文章的原因')}
                    <input name="reason" />
                  </label>
                  <button type="submit">{t('Finish and publish', '完成并发布')}</button>
                </form>
                <form className="workspace-form" action={updatePublication}>
                  <input type="hidden" name="run" value={run.id} />
                  <input type="hidden" name="outcome" value="failed" />
                  <label>
                    {t('Failure reason', '失败原因')}
                    <input required name="reason" />
                  </label>
                  <button type="submit">{t('Record failure', '记录失败')}</button>
                </form>
              </>
            )
          : (
              <p>
                {run.status === 'published'
                  ? t('Published.', '已发布。')
                  : run.status === 'empty' ? t('Finished without publication.', '已完成，未发布文章。') : t('Failed.', '发布失败。')}
                {' '}
                <Link href="/history">{t('View publication history', '查看发布历史')}</Link>
              </p>
            )}
    </CaptureShell>
  )
}
