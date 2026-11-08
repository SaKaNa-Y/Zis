'use server'

import type { ArticleContent } from '@/lib/articles/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { publishDraft, saveDraft } from '@/lib/articles/service'
import { parseArticleContent } from '@/lib/articles/types'
import { verifyAuthor } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'

function submittedContent(form: FormData): ArticleContent {
  const value = form.get('content')
  if (typeof value !== 'string')
    throw new Error('Missing article content')
  return parseArticleContent(JSON.parse(value))
}

export async function saveChanges(id: string, _previous: string | null, form: FormData): Promise<string | null> {
  await verifyAuthor()
  const { t } = await readLocale()
  let draft: ArticleContent
  try {
    draft = submittedContent(form)
  }
  catch {
    return t('Check the text fields and source URLs before saving.', '请检查文本字段和来源网址后再保存。')
  }
  await saveDraft(id, draft)
  const path = `/articles/${encodeURIComponent(id)}`
  revalidatePath(path)
  redirect(`${path}?edit=1&saved=1`)
}

export async function releaseChanges(id: string, _previous: string | null, form: FormData): Promise<string | null> {
  await verifyAuthor()
  const { t } = await readLocale()
  try {
    await publishDraft(id, submittedContent(form))
  }
  catch {
    return t('Could not publish this version. Reload the saved draft and try again.', '未能发布此版本。请重新加载已保存的草稿后再试。')
  }
  const path = `/articles/${encodeURIComponent(id)}`
  revalidatePath(path)
  revalidatePath('/articles')
  revalidatePath('/')
  redirect(path)
}
