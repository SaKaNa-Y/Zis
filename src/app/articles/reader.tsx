'use client'

import type { Article } from '@/lib/articles/types'
import { Fragment, useId, useRef } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { PublicationDate } from './directory'

type Citation = Article['sections'][number]['paragraphs'][number]['citations'][number]

function CitationPreview({ citation, number }: { citation: Citation, number: number }) {
  const { t } = useLocale()
  const heading = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <sup>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t(`Reference ${number}: ${citation.title}`, `参考资料 ${number}：${citation.title}`)}
          onClick={() => dialog.current?.showModal()}
        >
          [
          {number}
          ]
        </button>
      </sup>
      <dialog className="citation-dialog" ref={dialog} aria-labelledby={heading}>
        <div className="citation-tools">
          <span>{t(`Reference ${number}`, `参考资料 ${number}`)}</span>
          <form method="dialog"><button>{t('Close', '关闭')}</button></form>
        </div>
        <h3 id={heading}>{citation.title}</h3>
        <p>{citation.publisher}</p>
        {citation.excerpt && <blockquote>{citation.excerpt}</blockquote>}
        <a href={citation.url} target="_blank" rel="noopener noreferrer">{t('Open original', '查看原文')}</a>
      </dialog>
    </>
  )
}

export function ArticleReader({ article }: { article: Pick<Article, 'title' | 'standfirst' | 'imageUrl' | 'sections'> & { publishedAt?: Date } }) {
  const { t } = useLocale()
  const references = new Map<string, { citation: Citation, number: number }>()
  const sections = article.sections.map((section, sectionIndex) => (
    <section key={sectionIndex} className="article-section">
      {section.heading && <h2>{section.heading}</h2>}
      {section.paragraphs.map((paragraph, paragraphIndex) => {
        const occurrences = paragraph.citations.map(citation => ({
          citation,
          end: citation.afterText ? paragraph.text.indexOf(citation.afterText) + citation.afterText.length : paragraph.text.length,
        })).sort((a, b) => a.end - b.end)
        let start = 0
        return (
          <div key={paragraphIndex} className="article-paragraph">
            {occurrences.map(({ citation, end }, index) => {
              const reference = references.get(citation.url) ?? { citation, number: references.size + 1 }
              references.set(citation.url, reference)
              const passage = paragraph.text.slice(start, end)
              start = end
              return (
                <Fragment key={index}>
                  <span>{passage}</span>
                  <CitationPreview citation={citation} number={reference.number} />
                </Fragment>
              )
            })}
            <span>{paragraph.text.slice(start)}</span>
          </div>
        )
      })}
    </section>
  ))
  return (
    <article className="publication-article">
      <header>
        <h1 className="publication-title">{article.title}</h1>
        {article.standfirst && <p className="standfirst">{article.standfirst}</p>}
        <div className="article-byline">
          {article.publishedAt && <PublicationDate date={article.publishedAt} />}
          <span>{t(`${references.size} ${references.size === 1 ? 'source' : 'sources'}`, `${references.size} 个来源`)}</span>
        </div>
        {article.imageUrl && <img src={article.imageUrl} alt="" referrerPolicy="no-referrer" />}
      </header>
      {sections}
      {references.size > 0 && (
        <section className="article-references">
          <h2>{t('References', '参考资料')}</h2>
          <ol>
            {Array.from(references.values(), ({ citation }) => (
              <li key={citation.url}>
                <a href={citation.url} target="_blank" rel="noopener noreferrer">{citation.title}</a>
                <span>{citation.publisher}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}
