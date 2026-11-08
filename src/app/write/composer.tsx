'use client'

import type { ArticleContent } from '@/lib/articles/types'
import { useActionState, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { ContentFields } from '../articles/content-fields'
import { publishWriting, saveWriting } from './actions'

export function Composer({ id, revision, initial, saved }: { id: string, revision: number, initial: ArticleContent, saved: boolean }) {
  const { t } = useLocale()
  const [content, set] = useState(initial)
  const [error, save, pending] = useActionState(saveWriting.bind(null, id, revision), null)
  return (
    <form action={save} className="article-editor">
      <fieldset disabled={pending}>
        <ContentFields content={content} set={set} />
        <input type="hidden" name="content" value={JSON.stringify(content)} />
        <button className="editor-save" formNoValidate>{t('Save draft', '保存草稿')}</button>
        <button className="editor-publish" name="intent" value="preview">{t('Preview', '预览')}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {saved && content === initial && <p role="status">{t('Draft saved.', '草稿已保存。')}</p>}
    </form>
  )
}

export function PublishButton({ id, revision }: { id: string, revision: number }) {
  const { t } = useLocale()
  const [error, publish, pending] = useActionState(publishWriting.bind(null, id, revision), null)
  return (
    <form action={publish} className="article-editor">
      <button className="editor-publish" disabled={pending}>{t('Publish article', '发布文章')}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
