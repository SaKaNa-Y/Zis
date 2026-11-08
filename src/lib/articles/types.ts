import { canonicalizeLink } from '@/lib/ingestion/canonicalize'

export interface ArticleCitation {
  url: string
  title: string
  publisher: string
  excerpt: string | null
  afterText?: string
}

export interface ArticleContent {
  title: string
  standfirst: string
  imageUrl: string | null
  sections: {
    heading: string
    paragraphs: { text: string, citations: ArticleCitation[] }[]
  }[]
}

export type ArticleSummary = Omit<ArticleContent, 'sections'> & {
  id: string
  publishedAt: Date
  sourceCount: number
}
export type Article = ArticleSummary & ArticleContent

export interface PublicationRun {
  id: string
  retryOf: string | null
  startedAt: Date
  finishedAt: Date | null
  status: 'running' | 'published' | 'empty' | 'failed'
  stages: { name: string, at: string }[]
  reason: string | null
  articles: { id: string, title: string }[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an Article object')
  return { ...value }
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error('Expected a list')
  return value
}

function text(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '') || value.includes('\0'))
    throw new Error(`Invalid ${field}`)
  return value
}

function parseCitation(value: unknown, paragraph: string): ArticleCitation {
  const source = record(value)
  const url = canonicalizeLink(text(source.url, 'citation URL'))
  if (!url)
    throw new Error('Expected a public HTTP(S) citation URL')
  const afterText = source.afterText === undefined ? undefined : text(source.afterText, 'citation phrase')
  if (afterText !== undefined) {
    const position = paragraph.indexOf(afterText)
    if (position < 0 || paragraph.includes(afterText, position + 1))
      throw new Error('The citation phrase must appear exactly once in its paragraph')
  }
  return {
    ...(afterText === undefined ? {} : { afterText }),
    url,
    title: text(source.title, 'citation title'),
    publisher: text(source.publisher, 'publisher'),
    excerpt: source.excerpt == null ? null : text(source.excerpt, 'excerpt'),
  }
}

export function parseArticleContent(value: unknown): ArticleContent {
  const article = record(value)
  const imageUrl = article.imageUrl == null ? null : text(article.imageUrl, 'image URL')
  if (imageUrl && (!imageUrl.startsWith('https://') || !canonicalizeLink(imageUrl)))
    throw new Error('Expected an HTTPS image URL')
  const sections = list(article.sections).map((input) => {
    const section = record(input)
    const paragraphs = list(section.paragraphs).map((input) => {
      const paragraph = record(input)
      const body = text(paragraph.text, 'paragraph')
      return { text: body, citations: list(paragraph.citations).map(citation => parseCitation(citation, body)) }
    })
    if (!paragraphs.length)
      throw new Error('Expected a paragraph')
    return { heading: text(section.heading, 'heading', true), paragraphs }
  })
  if (!sections.length)
    throw new Error('Expected Article sections')
  return { title: text(article.title, 'title'), standfirst: text(article.standfirst, 'standfirst'), imageUrl, sections }
}

export function parseOutputs(value: unknown) {
  const keys = new Set<string>()
  return list(value).map((input) => {
    const output = record(input)
    const key = text(output.key, 'stable Article key')
    if (keys.has(key))
      throw new Error('Duplicate Article key in publication')
    keys.add(key)
    return { key, content: parseArticleContent(output.content) }
  })
}
