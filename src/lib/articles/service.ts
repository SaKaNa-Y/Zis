import type { SQL } from 'drizzle-orm'
import type { Article, ArticleContent, ArticleSummary, PublicationRun } from './types'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { parseArticleContent, parseOutputs, parseWritingDraft } from './types'

interface ArticleDatabase {
  execute: <T extends Record<string, unknown>>(query: SQL) => PromiseLike<{ rows: T[] }>
}

const summaryFields = sql`a.id, a.content->>'title' AS title, a.content->>'standfirst' AS standfirst,
  a.content->>'imageUrl' AS "imageUrl", a.published_at AS "publishedAt",
  (SELECT count(*)::integer FROM article_reference r WHERE r.article_id = a.id) AS "sourceCount"`

export function articleStore(database: ArticleDatabase) {
  return {
    async startRun(attemptKey: string, retryOf: string | null = null) {
      if (!attemptKey.trim())
        throw new Error('Expected a stable attempt key')
      const { rows } = await database.execute<{ id: string }>(sql`
        INSERT INTO publication_run (attempt_key, retry_of) VALUES (${attemptKey}, ${retryOf})
        ON CONFLICT (attempt_key) DO UPDATE SET attempt_key = excluded.attempt_key RETURNING id`)
      return rows[0]!.id
    },
    async reportStage(runId: string, name: string) {
      if (!name.trim() || name.length > 200)
        throw new Error('Expected a stage name of up to 200 characters')
      const { rows } = await database.execute(sql`
        UPDATE publication_run SET stages = CASE WHEN stages->-1->>'name' = ${name}
          THEN stages ELSE stages || jsonb_build_object('name', ${name}::text, 'at', now()) END
        WHERE id = ${runId} AND status = 'running' RETURNING id`)
      if (!rows.length)
        throw new Error('Publication attempt is closed or unavailable')
    },
    async failRun(runId: string, reason: string) {
      if (!reason.trim() || reason.length > 2000)
        throw new Error('Expected a failure reason of up to 2000 characters')
      const { rows } = await database.execute(sql`
        UPDATE publication_run SET status = 'failed', finished_at = coalesce(finished_at, now()), reason = ${reason}
        WHERE id = ${runId} AND (status = 'running' OR (status = 'failed' AND reason = ${reason})) RETURNING id`)
      if (!rows.length)
        throw new Error('Publication attempt is closed or unavailable')
    },
    async prunePublicationRuns() {
      const { rows } = await database.execute<{ count: number }>(sql`
        WITH expired AS (DELETE FROM publication_run WHERE started_at <= now() - interval '7 days' RETURNING id)
        SELECT count(*)::integer AS count FROM expired`)
      return rows[0]!.count
    },
    async listPublicationRuns(): Promise<PublicationRun[]> {
      const { rows } = await database.execute<PublicationRun & Record<string, unknown>>(sql`
        SELECT r.id, r.retry_of AS "retryOf", r.started_at AS "startedAt", r.finished_at AS "finishedAt",
          r.status, r.stages, r.reason, coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', pr.article_id, 'title', pr.title) ORDER BY pr.title, pr.article_id)
            FROM publication_result pr WHERE pr.run_id = r.id
          ), '[]') AS articles FROM publication_run r
        WHERE r.started_at > now() - interval '7 days' ORDER BY r.started_at DESC, r.id`)
      return rows.map(row => ({ ...row, startedAt: new Date(row.startedAt), finishedAt: row.finishedAt ? new Date(row.finishedAt) : null }))
    },
    async completeRun(runId: string, input: unknown, emptyReason = 'No Articles selected for publication') {
      const outputs = parseOutputs(input)
      await database.execute(sql`SELECT complete_publication(${runId}, ${JSON.stringify(outputs)}::jsonb, ${emptyReason})`)
    },
    async listWritingDrafts() {
      const { rows } = await database.execute<{ id: string, title: string }>(sql`
        SELECT id, content->>'title' AS title FROM writing_draft WHERE article_id IS NULL ORDER BY updated_at DESC, id`)
      return rows
    },
    async getWritingDraft(id: string) {
      const { rows } = await database.execute<{ content: unknown, revision: number, articleId: string | null }>(sql`
        SELECT content, revision, article_id AS "articleId" FROM writing_draft WHERE id::text = ${id}`)
      const row = rows[0]
      return row ? { ...row, content: row.content === null ? null : parseWritingDraft(row.content) } : null
    },
    async saveWritingDraft(id: string, revision: number, input: ArticleContent) {
      const content = JSON.stringify(parseWritingDraft(input))
      const query = revision === 0
        ? sql`INSERT INTO writing_draft (id, revision, content) VALUES (${id}, 1, ${content}::jsonb)
              ON CONFLICT DO NOTHING RETURNING revision`
        : sql`UPDATE writing_draft SET content = ${content}::jsonb, revision = revision + 1, updated_at = now()
              WHERE id = ${id} AND revision = ${revision} AND article_id IS NULL RETURNING revision`
      const { rows } = await database.execute<{ revision: number }>(query)
      if (!rows.length)
        throw new Error('Draft changed')
      return rows[0]!.revision
    },
    async publishWritingDraft(id: string, revision: number) {
      const draft = await this.getWritingDraft(id)
      if (!draft || draft.revision !== revision)
        throw new Error('Draft changed')
      if (draft.articleId)
        return draft.articleId
      const content = JSON.stringify(parseArticleContent(draft.content))
      const { rows } = await database.execute<{ id: string }>(sql`
        SELECT publish_writing_draft(${id}, ${revision}, ${content}::jsonb) AS id`)
      return rows[0]!.id
    },
    async getDraft(id: string): Promise<ArticleContent | null> {
      const { rows } = await database.execute<{ draft: unknown }>(sql`
        SELECT draft FROM article WHERE id::text = ${id}`)
      return rows[0]?.draft ? parseArticleContent(rows[0].draft) : null
    },
    async saveDraft(id: string, input: ArticleContent) {
      const draft = JSON.stringify(parseArticleContent(input))
      const { rows } = await database.execute(sql`
        UPDATE article SET draft = ${draft}::jsonb WHERE id::text = ${id} RETURNING id`)
      if (!rows.length)
        throw new Error('Article not found')
    },
    async publishDraft(id: string, expectedContent: ArticleContent) {
      const expected = JSON.stringify(parseArticleContent(expectedContent))
      const { rows } = await database.execute(sql`
        UPDATE article SET content = draft, draft = NULL
        WHERE id::text = ${id} AND draft = ${expected}::jsonb RETURNING id`)
      if (!rows.length)
        throw new Error('The saved draft changed. Reload the Article before publishing.')
    },
    async listArticles(): Promise<ArticleSummary[]> {
      const { rows } = await database.execute<ArticleSummary>(sql`
        SELECT ${summaryFields} FROM article a ORDER BY a.published_at DESC, a.id`)
      return rows.map(row => ({ ...row, publishedAt: new Date(row.publishedAt) }))
    },
    async getArticle(id: string): Promise<Article | null> {
      const { rows } = await database.execute<ArticleSummary & { content: unknown }>(sql`
        SELECT ${summaryFields}, a.content FROM article a WHERE a.id::text = ${id}`)
      const row = rows[0]
      return row ? { ...parseArticleContent(row.content), id: row.id, publishedAt: new Date(row.publishedAt), sourceCount: row.sourceCount } : null
    },
  }
}
export const listArticles = () => articleStore(db()).listArticles()
export const getArticle = (id: string) => articleStore(db()).getArticle(id)
export const getDraft = (id: string) => articleStore(db()).getDraft(id)
export const saveDraft = (id: string, content: ArticleContent) => articleStore(db()).saveDraft(id, content)
export const publishDraft = (id: string, content: ArticleContent) => articleStore(db()).publishDraft(id, content)
export const listPublicationRuns = () => articleStore(db()).listPublicationRuns()
export const startRun = (attemptKey: string, retryOf?: string | null) => articleStore(db()).startRun(attemptKey, retryOf)
export const reportStage = (runId: string, name: string) => articleStore(db()).reportStage(runId, name)
export const failRun = (runId: string, reason: string) => articleStore(db()).failRun(runId, reason)
export const completeRun = (runId: string, outputs: unknown, emptyReason?: string) => articleStore(db()).completeRun(runId, outputs, emptyReason)
export const prunePublicationRuns = () => articleStore(db()).prunePublicationRuns()

export const writingStore = () => articleStore(db())
