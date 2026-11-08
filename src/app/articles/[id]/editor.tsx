'use client'

import type { ReactNode } from 'react'
import type { ArticleCitation, ArticleContent } from '@/lib/articles/types'
import { useActionState, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { releaseChanges, saveChanges } from './actions'

function Fields<T>({ values, change, blank, addLabel, removeLabel, children }: {
  values: T[]
  change: (values: T[]) => void
  blank: () => T
  addLabel: string
  removeLabel: string
  children: (value: T, update: (value: T) => void, index: number) => ReactNode
}) {
  return (
    <div className="editor-fields">
      {values.map((value, index) => (
        <fieldset key={index}>
          {children(value, next => change(values.map((item, i) => i === index ? next : item)), index)}
          <button type="button" onClick={() => change(values.filter((_, i) => index !== i))}>{removeLabel}</button>
        </fieldset>
      ))}
      <button type="button" onClick={() => change([...values, blank()])}>{addLabel}</button>
    </div>
  )
}

export function ArticleEditor({ id, initial, saved, showSaved }: { id: string, initial: ArticleContent, saved: ArticleContent | null, showSaved: boolean }) {
  const { t } = useLocale()
  const [content, set] = useState(initial)
  const [saveError, save, saving] = useActionState(saveChanges.bind(null, id), null)
  const [publishError, publish, publishing] = useActionState(releaseChanges.bind(null, id), null)
  const serialized = JSON.stringify(content)
  const matchesSaved = saved !== null && serialized === JSON.stringify(saved)
  const blankParagraph = () => ({ text: '', citations: [] })
  return (
    <section className="article-editor">
      <h1 className="publication-title">{t('Edit article', '编辑文章')}</h1>
      <p>{t('Readers see the published version until you publish this draft.', '发布草稿前，读者看到的仍是已发布版本。')}</p>
      <form action={save}>
        <fieldset disabled={saving || publishing}>
          <label>
            {t('Title', '标题')}
            <input required value={content.title} onChange={e => set({ ...content, title: e.target.value })} />
          </label>
          <label>
            {t('Standfirst', '导语')}
            <textarea required value={content.standfirst} onChange={e => set({ ...content, standfirst: e.target.value })} />
          </label>
          <label>
            {t('Image URL (optional)', '配图网址（可选）')}
            <input type="url" pattern="https://.*" value={content.imageUrl ?? ''} onChange={e => set({ ...content, imageUrl: e.target.value || null })} />
          </label>
          <Fields values={content.sections} change={sections => set({ ...content, sections })} blank={() => ({ heading: '', paragraphs: [blankParagraph()] })} addLabel={t('Add section', '添加章节')} removeLabel={t('Remove section', '移除章节')}>
            {(section, updateSection, index) => (
              <>
                <legend>{t(`Section ${index + 1}`, `第 ${index + 1} 节`)}</legend>
                <label>
                  {t('Heading', '小标题')}
                  <input value={section.heading} onChange={e => updateSection({ ...section, heading: e.target.value })} />
                </label>
                <Fields values={section.paragraphs} change={paragraphs => updateSection({ ...section, paragraphs })} blank={blankParagraph} addLabel={t('Add paragraph', '添加段落')} removeLabel={t('Remove paragraph', '移除段落')}>
                  {(paragraph, updateParagraph, position) => (
                    <>
                      <label>
                        {t(`Paragraph ${position + 1}`, `第 ${position + 1} 段`)}
                        <textarea required rows={4} value={paragraph.text} onChange={e => updateParagraph({ ...paragraph, text: e.target.value })} />
                      </label>
                      <Fields values={paragraph.citations} change={citations => updateParagraph({ ...paragraph, citations })} blank={(): ArticleCitation => ({ title: '', url: '', publisher: '', excerpt: null })} addLabel={t('Add citation', '添加引用')} removeLabel={t('Remove citation', '移除引用')}>
                        {(citation, updateCitation) => (
                          <>
                            <label>
                              {t('Place after these exact words (leave blank for paragraph end)', '将引用放在这些原词之后（留空放在段末）')}
                              <input value={citation.afterText ?? ''} onChange={e => updateCitation({ ...citation, afterText: e.target.value || undefined })} />
                            </label>
                            <label>
                              {t('Source title', '来源标题')}
                              <input required value={citation.title} onChange={e => updateCitation({ ...citation, title: e.target.value })} />
                            </label>
                            <label>
                              {t('Publisher', '发布者')}
                              <input required value={citation.publisher} onChange={e => updateCitation({ ...citation, publisher: e.target.value })} />
                            </label>
                            <label>
                              {t('Original URL', '原文网址')}
                              <input required type="url" value={citation.url} onChange={e => updateCitation({ ...citation, url: e.target.value })} />
                            </label>
                            <label>
                              {t('Verbatim excerpt (optional)', '原文摘录（可选）')}
                              <textarea value={citation.excerpt ?? ''} onChange={e => updateCitation({ ...citation, excerpt: e.target.value || null })} />
                            </label>
                          </>
                        )}
                      </Fields>
                    </>
                  )}
                </Fields>
              </>
            )}
          </Fields>
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
