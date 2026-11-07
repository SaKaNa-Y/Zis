import type { Translate } from './shared'
import type { CaptureCard } from '@/lib/capture/model'
import Link from 'next/link'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CaptureTime } from './shared'

export function InformationCard({ card, t }: { card: CaptureCard, t: Translate }) {
  return (
    <article className="information-card" id={`card-${card.id}`}>
      <header>
        <p className="capture-meta">
          <span>{card.sourceName}</span>
          <span>{card.author}</span>
        </p>
        <h2><a href={card.originalUrl} target="_blank" rel="noreferrer">{card.title}</a></h2>
        <p className="capture-meta">
          {t('Published', '原文发布')}
          {' '}
          <CaptureTime value={card.publishedAt} />
        </p>
        {card.updatedAt !== card.capturedAt && (
          <p className="capture-note">
            {t('Updated', '已更新')}
            {' '}
            <CaptureTime value={card.updatedAt} />
            {' '}
            ·
            {' '}
            {t('Original position retained', '保持原发布时间排序')}
          </p>
        )}
        {card.incompleteReason && (
          <p className="capture-warning">
            <strong>{t('Incomplete capture', '采集不完整')}</strong>
            {' '}
            ·
            {' '}
            {card.incompleteReason}
          </p>
        )}
        {card.continuationOf && (
          <p className="capture-note">
            <a href={card.continuationOf} target="_blank" rel="noreferrer">
              {t('Continuation of an expired thread', '接续已过期推文串')}
              {' '}
              ↗
            </a>
            {' '}
            ·
            {' '}
            {t('Earlier content is no longer retained.', '旧正文已不再保留。')}
          </p>
        )}
      </header>
      <div className="capture-posts">
        {card.posts.map((post, index) => (
          <section className="capture-post" key={post.url}>
            {card.posts.length > 1 && (
              <p className="capture-meta">
                <a href={post.url} target="_blank" rel="noreferrer">
                  {index + 1}
                  {' '}
                  ↗
                </a>
                <CaptureTime value={post.publishedAt} />
              </p>
            )}
            <div className="capture-prose">
              {card.sourceKind === 'x'
                ? <p className="capture-plain-text">{post.body}</p>
                : (
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>, img: ({ src, alt }) => typeof src === 'string' && src.startsWith('/capture/images/')
                        ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt ?? ''} loading="lazy" /></a>
                        : (
                            <span className="capture-note">
                              {t('Source image', '原文图片')}
                              :
                              {' '}
                              {alt || t('see original', '请查看原文')}
                            </span>
                          ) }}
                    >
                      {post.body.replace(/!\[([^\]]*)\]\(attachment:(\d+)\)/g, (original, alt: string, number: string) => {
                        const image = card.images[Number(number) - 1]
                        return image ? `![${alt}](/capture/images/${image.id})` : original
                      })}
                    </Markdown>
                  )}
            </div>
          </section>
        ))}
      </div>
      {card.images.length > 0 && (
        <div className="capture-images">
          {card.images.map(image => (
            <figure key={image.id}>
              <a href={`/capture/images/${image.id}`} target="_blank" rel="noreferrer"><img src={`/capture/images/${image.id}`} alt={image.alt} loading="lazy" /></a>
              {image.alt && <figcaption>{image.alt}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <footer className="capture-meta">
        <Link href={`/capture?card=${card.id}`}>{t('Update / complete', '续更／补全')}</Link>
        <a href={card.originalUrl} target="_blank" rel="noreferrer">
          {t('Original source', '查看原文')}
          {' '}
          ↗
        </a>
        <span>
          {t('Expires', '到期删除')}
          {' '}
          <CaptureTime value={card.expiresAt} />
        </span>
      </footer>
    </article>
  )
}
