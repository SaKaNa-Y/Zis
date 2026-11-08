'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { writingStore } from '@/lib/articles/service'
import { parseArticleContent, parseWritingDraft } from '@/lib/articles/types'
import { verifyAuthor } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'

export async function saveWriting(id: string, revision: number, _previous: string | null, form: FormData) {
  await verifyAuthor()
  const { t } = await readLocale()
  const preview = form.get('intent') === 'preview'
  let content
  try {
    content = parseWritingDraft(JSON.parse(String(form.get('content'))))
    if (preview)
      parseArticleContent(content)
  }
  catch {
    return t('Check the title, paragraphs and citation details. Each citation phrase must occur once in its paragraph.', '请检查标题、正文和引用信息。用于定位引用的文字须在该段中恰好出现一次。')
  }
  try {
    await writingStore().saveWritingDraft(id, revision, content)
  }
  catch {
    return t('Could not save. Copy your changes before reopening the latest draft.', '保存失败。请先复制当前改动，再打开最新草稿。')
  }
  revalidatePath('/write')
  redirect(`/write?id=${id}&${preview ? 'preview=1' : 'saved=1'}`)
}

export async function publishWriting(id: string, revision: number, _previous: string | null) {
  await verifyAuthor()
  const { t } = await readLocale()
  let articleId
  try {
    articleId = await writingStore().publishWritingDraft(id, revision)
  }
  catch {
    return t('Could not publish this version. Reopen the draft and preview it again.', '未能发布这个版本。请重新打开草稿并预览。')
  }
  for (const path of ['/write', '/', '/articles', '/history'])
    revalidatePath(path)
  redirect(`/articles/${articleId}`)
}
