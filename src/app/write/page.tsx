import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { writingStore } from '@/lib/articles/service'
import { parseArticleContent } from '@/lib/articles/types'
import { verifyAuthor } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'
import { ArticleReader } from '../articles/reader'
import { DestinationNavigation } from '../destinations'
import { Composer, PublishButton } from './composer'

export default async function WritePage({ searchParams }: { searchParams: Promise<{ id?: string, preview?: string, saved?: string }> }) {
  await verifyAuthor()
  const { t } = await readLocale()
  const params = await searchParams
  const store = writingStore()
  const draft = params.id ? await store.getWritingDraft(params.id) : null
  if (params.id && !draft)
    notFound()
  if (draft?.articleId)
    redirect(`/articles/${draft.articleId}`)
  const id = params.id || randomUUID()
  const initial = draft?.content ?? { title: '', standfirst: '', imageUrl: null, sections: [{ heading: '', paragraphs: [{ text: '', citations: [] }] }] }
  let preview
  if (params.preview && draft) {
    try {
      preview = parseArticleContent(initial)
    }
    catch {
      redirect(`/write?id=${id}`)
    }
  }
  const drafts = params.id ? [] : await store.listWritingDrafts()
  return (
    <div className="publication-shell">
      <DestinationNavigation role="author" current="/write" />
      <main className="publication-detail">
        {preview && draft
          ? (
              <>
                <p>{t('Draft preview', '草稿预览')}</p>
                <Link href={`/write?id=${id}`}>{t('Continue editing', '继续编辑')}</Link>
                <ArticleReader article={preview} />
                <PublishButton id={id} revision={draft.revision} />
              </>
            )
          : (
              <>
                <h1 className="publication-title">{t('Write article', '写文章')}</h1>
                {drafts.length > 0 && (
                  <section className="writing-drafts">
                    <h2>{t('Saved drafts', '已保存的草稿')}</h2>
                    <ul>{drafts.map(d => <li key={d.id}><Link href={`/write?id=${d.id}`}>{d.title || t('Untitled draft', '无标题草稿')}</Link></li>)}</ul>
                  </section>
                )}
                <Composer key={`${id}-${draft?.revision ?? 0}`} id={id} initial={initial} revision={draft?.revision ?? 0} saved={params.saved === '1'} />
              </>
            )}
      </main>
    </div>
  )
}
