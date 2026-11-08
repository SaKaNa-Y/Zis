'use client'

import type { CaptureCard, CaptureSource } from '@/lib/capture/model'
import { useActionState, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { saveCaptureAction } from './actions'
import { compressImage, MAX_IMAGES, MAX_UPLOAD_BYTES } from './compress'
import { captureDraft, capturePayload } from './draft'

export function CaptureForm({ sources, initial }: { sources: CaptureSource[], initial?: CaptureCard }) {
  const { t } = useLocale()
  const [posts, setPosts] = useState(initial?.posts.map((_, index) => index) ?? [0])
  const [files, setFiles] = useState<File[]>([])
  const [draft, setDraft] = useState(() => captureDraft(initial))
  const selectedSource = sources.find(source => source.id === draft.sourceId)
  function field(name: string) {
    return { value: draft[name] ?? '', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(current => ({ ...current, [name]: event.target.value })) }
  }

  const [state, action, pending] = useActionState(async (previous: { error?: string, success?: string, id?: string }, data: FormData) => {
    try {
      if (files.length > MAX_IMAGES)
        throw new Error(t('Choose at most 8 images.', '最多选择 8 张图片。'))
      const images: File[] = []
      for (const file of files)
        images.push(await compressImage(file))
      if (images.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES)
        throw new Error(t('Compressed images exceed 3 MiB total. Split this upload; no images were saved.', '压缩后图片总量超过 3 MiB，请拆分上传；本次未保存图片。'))
      for (const file of images)
        data.append('images', file)
      data.set('imageAlts', JSON.stringify(files.map((_, index) => String(data.get(`alt-${index}`) ?? ''))))
      data.set('payload', JSON.stringify(capturePayload(data, posts, sources)))
      // Send the composed payload only, without duplicating each full-text editor field.
      for (const key of [...data.keys()]) {
        if (!['payload', 'images', 'imageAlts'].includes(key))
          data.delete(key)
      }
      return await saveCaptureAction(previous, data)
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : t('Could not save. Please retry.', '保存失败，请重试。') }
    }
  }, {})
  return (
    <form action={action} className="capture-form">
      <fieldset disabled={pending}>
        <label>
          {t('Source', '来源')}
          <select name="sourceId" required {...field('sourceId')}>
            <option value="" disabled>{t('Choose a source', '选择来源')}</option>
            {sources.filter(source => source.enabled).map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
        </label>
        <label>
          {t('Title', '标题')}
          <input name="title" {...field('title')} required maxLength={1000} />
        </label>
        <label>
          {t('Author', '作者')}
          <input name="author" {...field('author')} required />
        </label>
        {selectedSource?.kind === 'x' && (
          <label>
            {t('Thread’s first post URL (optional for a single post)', '推文串首帖链接（单条内容可留空）')}
            <input name="threadUrl" {...field('threadUrl')} type="url" />
            <small>{t('Use the same first-post URL when adding continuations or completing an existing thread.', '续更或补全推文串时，请使用相同的首帖链接。')}</small>
          </label>
        )}
        {posts.map((id, index) => (
          <fieldset className="capture-post-editor" key={id}>
            <legend>
              {t('Original post', '原文')}
              {' '}
              {index + 1}
            </legend>
            <label>
              {t('Original URL', '原文链接')}
              <input name={`url-${id}`} {...field(`url-${id}`)} type="url" required />
            </label>
            <label>
              {t('Original publication time (ISO 8601 with timezone)', '原文发布时间（ISO 8601，含时区）')}
              <input name={`publishedAt-${id}`} {...field(`publishedAt-${id}`)} required placeholder="2026-11-07T08:00:00+08:00" />
            </label>
            <label>
              {t('Complete original text (blog: Markdown; X: plain text)', '完整原文（博客：Markdown；X：纯文本）')}
              <textarea name={`body-${id}`} {...field(`body-${id}`)} rows={12} required />
              <small>{t('Preserve headings, lists, links, quotations, code and tables. Do not summarize or translate. Upload images below.', '保留标题层级、列表、链接、引用、代码和表格；不摘要、不翻译。图片请在下方上传。')}</small>
            </label>
            {posts.length > 1 && <button type="button" onClick={() => setPosts(current => current.filter(item => item !== id))}>{t('Remove this post', '移除此条')}</button>}
          </fieldset>
        ))}
        <button type="button" onClick={() => setPosts(current => [...current, Math.max(...current) + 1])}>
          {t('Add author continuation', '添加作者续帖')}
          {' '}
          +
        </button>
        <label>
          {t('Missing content / reason (leave blank when complete)', '缺失内容及原因（完整时留空）')}
          <textarea name="incompleteReason" {...field('incompleteReason')} rows={3} />
        </label>
        {initial && <p className="capture-note">{t('Existing images stay attached. Upload only new images. Clear the missing-content reason when the capture is complete.', '已有图片继续保留，仅上传新增图片。补全后请清空缺失原因。')}</p>}
        <p className="capture-note">{t('For blog image placement, insert ![description](attachment:1) in the body for the first image, attachment:2 for the second, and so on. Existing images come before new uploads.', '博客正文可插入 ![描述](attachment:1) 定位第一张图片，attachment:2 定位第二张，依此类推。已有图片排在新增图片之前。')}</p>
        <label>
          {t('Images or screenshots', '图片或截图')}
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} />
          <small>{t('Up to 8 images; WebP compression keeps original dimensions. Maximum 512 KiB each and 3 MiB per upload. Oversized images are rejected, never silently omitted.', '最多 8 张，压缩为 WebP 并保留原始尺寸；每张不超过 512 KiB，每次合计不超过 3 MiB。超限会明确报错，不会静默丢图。')}</small>
        </label>
        {files.map((file, index) => (
          <label key={`${file.name}-${index}`}>
            {file.name}
            <input name={`alt-${index}`} {...field(`alt-${index}`)} placeholder={t('Image description', '图片描述')} />
          </label>
        ))}
        <p className="capture-note">{t('Text and images are kept for seven days from first capture. Updates do not extend expiry. Original identifiers remain only for deduplication.', '正文和图片自首次录入起保留七天，续更和补采不延长到期时间。原帖标识仅用于长期去重。')}</p>
        <button className="capture-button" type="submit" disabled={sources.every(source => !source.enabled)}>{pending ? t('Compressing and saving…', '正在压缩并保存…') : t('Save original content', '保存原文')}</button>
      </fieldset>
      {state.error && <p role="alert" className="capture-warning">{state.error}</p>}
      {state.success && (
        <p role="status">
          {state.success}
          {' '}
          <a href={state.id ? `/collection#card-${state.id}` : '/collection'}>
            {t('View information', '查看信息')}
            {' '}
            →
          </a>
        </p>
      )}
    </form>
  )
}
