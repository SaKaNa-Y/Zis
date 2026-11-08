'use client'

import type { ArticleContent } from '@/lib/articles/types'
import { useActionState, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { ContentFields } from '../content-fields'
import { releaseChanges, saveChanges } from './actions'

export function ArticleEditor({ id, initial, saved, showSaved }: { id: string, initial: ArticleContent, saved: ArticleContent | null, showSaved: boolean }) {
  const { t } = useLocale()
  const [content, set] = useState(initial)
  const [saveError, save, saving] = useActionState(saveChanges.bind(null, id), null)
  const [publishError, publish, publishing] = useActionState(releaseChanges.bind(null, id), null)
  const serialized = JSON.stringify(content)
  const matchesSaved = saved !== null && serialized === JSON.stringify(saved)
  return (
    <section className="article-editor">
      <h1 className="publication-title">{t('Edit article', '编辑文章')}</h1>
      <p>{t('Readers see the published version until you publish this draft.', '发布草稿前，读者看到的仍是已发布版本。')}</p>
      <form action={save}>
        <fieldset disabled={saving || publishing}>
          <ContentFields content={content} set={set} />
          <input type="hidden" name="content" value={serialized} />
          <button className="editor-save" type="submit">{t('Save draft', '保存草稿')}</button>
        </fieldset>
        {saveError && <p role="alert">{saveError}</p>}
        {showSaved && matchesSaved && <p role="status">{t('Draft saved.', '草稿已保存。')}</p>}
      </form>
      {saved && (
        <form action={publish}>
          <input type="hidden" name="content" value={JSON.stringify(saved)} />
          <button className="editor-publish" disabled={!matchesSaved || saving || publishing}>{t('Publish saved draft', '发布已保存的草稿')}</button>
          {publishError && <p role="alert">{publishError}</p>}
        </form>
      )}
    </section>
  )
}
