'use client'

import type { CaptureSource } from '@/lib/capture/model'
import { useActionState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { recordRunAction, saveSourceAction } from './actions'

export function SourceForm({ source }: { source?: CaptureSource }) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(saveSourceAction, {})
  return (
    <form className="capture-form" action={action}>
      <fieldset disabled={pending}>
        {source && <input type="hidden" name="id" value={source.id} />}
        <label>
          {t('Source name', '来源名称')}
          <input name="name" required defaultValue={source?.name} />
        </label>
        <label>
          {t('Profile or blog URL', '账号主页或博客链接')}
          <input name="url" type="url" required defaultValue={source?.url} />
        </label>
        <label>
          {t('Source type', '来源类型')}
          <select name="kind" defaultValue={source?.kind ?? 'x'}>
            <option value="x">X</option>
            <option value="blog">{t('Blog', '博客')}</option>
          </select>
        </label>
        <label className="capture-checkbox">
          <input name="enabled" type="checkbox" defaultChecked={source?.enabled ?? true} />
          {t('Enabled', '启用')}
        </label>
        <button className="capture-button" type="submit">{pending ? t('Saving…', '保存中…') : t('Save source', '保存来源')}</button>
      </fieldset>
      {state.error && <p role="alert" className="capture-warning">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  )
}

export function RunForm({ sources }: { sources: CaptureSource[] }) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(recordRunAction, {})
  return (
    <form action={action} className="capture-form">
      <fieldset disabled={pending}>
        <label>
          {t('Source', '来源')}
          <select name="sourceId" required>{sources.map(source => <option value={source.id} key={source.id}>{source.name}</option>)}</select>
        </label>
        <label>
          {t('Result', '结果')}
          <select name="status" defaultValue="failed">
            <option value="failed">{t('Failed — source could not be read', '失败 — 无法读取来源')}</option>
            <option value="partial">{t('Partial — missing content', '不完整 — 存在缺失内容')}</option>
            <option value="success">{t('Success — checked source', '成功 — 已检查来源')}</option>
          </select>
        </label>
        <label>
          {t('New cards saved', '已保存的新增卡片数')}
          <input name="addedCount" type="number" min="0" step="1" defaultValue="0" required />
        </label>
        <label>
          {t('Details / failure reason', '详情／失败原因')}
          <textarea name="message" rows={3} />
        </label>
        <p className="capture-note">{t('Report only an actual collection attempt. Access failure is not a successful check with zero new items.', '仅记录实际采集尝试。访问失败不能记作“成功但没有新内容”。')}</p>
        <button className="capture-button" type="submit" disabled={!sources.length}>{pending ? t('Recording…', '记录中…') : t('Record result', '记录结果')}</button>
      </fieldset>
      {state.error && <p role="alert" className="capture-warning">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  )
}
