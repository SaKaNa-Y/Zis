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

function parseCitation(value: unknown, paragraph: string, draft: boolean): ArticleCitation {
  const source = record(value)
  const rawUrl = text(source.url, 'citation URL', draft)
  const url = draft ? rawUrl : canonicalizeLink(rawUrl)
  if (url === null || url === undefined)
    throw new Error('Expected a public HTTP(S) citation URL')
  const afterText = source.afterText === undefined ? undefined : text(source.afterText, 'citation phrase', draft)
  if (!draft && afterText !== undefined) {
    const position = paragraph.indexOf(afterText)
    if (position < 0 || paragraph.includes(afterText, position + 1))
      throw new Error('The citation phrase must appear exactly once in its paragraph')
  }
  return {
    ...(afterText === undefined ? {} : { afterText }),
    url,
    title: text(source.title, 'citation title', draft),
    publisher: text(source.publisher, 'publisher', draft),
    excerpt: source.excerpt == null ? null : text(source.excerpt, 'excerpt', draft),
  }
}

function parseContent(value: unknown, draft: boolean): ArticleContent {
  const article = record(value)
  const imageUrl = article.imageUrl == null ? null : text(article.imageUrl, 'image URL', draft)
  if (!draft && imageUrl && (!imageUrl.startsWith('https://') || !canonicalizeLink(imageUrl)))
    throw new Error('Expected an HTTPS image URL')
  const sections = list(article.sections).map((input) => {
    const section = record(input)
    const paragraphs = list(section.paragraphs).map((input) => {
      const paragraph = record(input)
      const body = text(paragraph.text, 'paragraph', draft)
      return { text: body, citations: list(paragraph.citations).map(citation => parseCitation(citation, body, draft)) }
    })
    if (!draft && !paragraphs.length)
      throw new Error('Expected a paragraph')
    return { heading: text(section.heading, 'heading', true), paragraphs }
  })
  if (!draft && !sections.length)
    throw new Error('Expected Article sections')
  return { title: text(article.title, 'title', draft), standfirst: text(article.standfirst, 'standfirst', true), imageUrl, sections }
}

export const parseWritingDraft = (value: unknown) => parseContent(value, true)
export const parseArticleContent = (value: unknown) => parseContent(value, false)

export function parseOutputs(value: unknown) {
  const keys = new Set<string>()
  return list(value).map((input) => {
    const output = record(input)
    const key = text(output.key, 'stable Article key')
    if (keys.has(key))
      throw new Error('Duplicate Article key in publication')
    keys.add(key)
    const content = parseArticleContent(output.content)
    text(content.standfirst, 'standfirst')
    return { key, content }
  })
}
