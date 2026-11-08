import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { articleStore } from './service'

const pg = new PGlite({ extensions: { vector } })
const dialect = new PgDialect()
const store = articleStore({
  execute(query) {
    const { sql, params } = dialect.sqlToQuery(query)
    return pg.query(sql, params)
  },
})
const citation = { url: 'https://blog.example/post', title: 'Primary evidence', publisher: 'Lab', excerpt: 'First passage.' }
const content = {
  title: 'Experiment',
  standfirst: 'An observed result.',
  imageUrl: null,
  sections: [{ heading: 'Observations', paragraphs: [
    { text: 'One fact.', citations: [citation] },
    { text: 'Another.', citations: [{ ...citation, excerpt: 'Another passage.' }] },
    { text: 'A third.', citations: [{ ...citation, excerpt: null }] },
  ] }],
}

beforeAll(async () => {
  const folder = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, folder), 'utf8'))
})
afterAll(() => pg.close())

it('publishes the full Article with three occurrence excerpts and one canonical source', async () => {
  const run = await store.startRun('test-attempt')
  await store.completeRun(run, [{ key: 'permanent-editorial-key', content }])
  const [summary] = await store.listArticles()
  expect(summary).toMatchObject({ title: 'Experiment', sourceCount: 1 })
  expect(await store.getArticle(summary!.id)).toMatchObject(content)
})

it('saves private edits and rejects publication of a draft superseded in a second tab', async () => {
  const run = await store.startRun('draft fixture')
  await store.completeRun(run, [{ key: 'editable-piece', content }])
  const articleId = (await store.listPublicationRuns()).find(row => row.id === run)!.articles[0]!.id
  const article = await store.getArticle(articleId)
  const id = article!.id
  const first = { ...content, title: 'Private revision' }
  const second = { ...content, title: 'Corrected title' }
  await store.saveDraft(id, first)
  expect(await store.getDraft(id)).toEqual(first)
  expect((await store.getArticle(id))?.title).toBe('Experiment')
  await store.saveDraft(id, second)
  await expect(store.publishDraft(id, first)).rejects.toThrow()
  expect((await store.listArticles()).find(row => row.id === id)?.title).toBe('Experiment')
  await store.publishDraft(id, second)
  expect(await store.getDraft(id)).toBeNull()
  expect(await store.getArticle(id)).toMatchObject({ title: 'Corrected title', publishedAt: article!.publishedAt })
})

it('records failed and empty attempts, their stages and retry outcomes, and replays a multi-Article commit', async () => {
  const failed = await store.startRun('window-attempt-1')
  expect(await store.startRun('window-attempt-1')).toBe(failed)
  await store.reportStage(failed, 'Reading Sources')
  expect(await store.listPublicationRuns()).toContainEqual(expect.objectContaining({
    id: failed,
    status: 'running',
    stages: [{ name: 'Reading Sources', at: expect.any(String) }],
  }))
  await store.failRun(failed, 'Source unavailable')
  const retry = await store.startRun('window-attempt-2', failed)
  const outputs = ['First', 'Second'].map(title => ({ key: title, content: { ...content, title } }))
  await store.completeRun(retry, outputs)
  await store.completeRun(retry, outputs)
  await expect(store.failRun(retry, 'Acknowledgement lost')).rejects.toThrow()
  const duplicate = await store.startRun('duplicate delivery')
  await store.completeRun(duplicate, outputs)
  const empty = await store.startRun('another day')
  await store.completeRun(empty, [], 'No new originals')
  const runs = await store.listPublicationRuns()
  expect(runs.find(r => r.id === failed)).toMatchObject({ status: 'failed', reason: 'Source unavailable' })
  expect(runs.find(r => r.id === retry)).toMatchObject({ status: 'published', retryOf: failed, articles: [
    { id: expect.any(String), title: 'First' },
    { id: expect.any(String), title: 'Second' },
  ] })
  expect(runs.find(r => r.id === empty)).toMatchObject({ status: 'empty', reason: 'No new originals', articles: [] })
  expect((await store.listArticles()).filter(r => ['First', 'Second'].includes(r.title))).toHaveLength(2)
})

it('expires seven-day publication attempts and their results while preserving Articles, Links, and deduplication keys', async () => {
  const output = { key: 'retained-article', content: { ...content, title: 'Permanent' } }
  const run = await store.startRun('expired-window')
  await store.completeRun(run, [output])
  const id = (await store.listArticles()).find(row => row.title === 'Permanent')!.id
  await pg.query('UPDATE publication_run SET started_at = now() - interval \'7 days\', finished_at = now() - interval \'7 days\' WHERE id = $1', [run])
  expect((await store.listPublicationRuns()).some(row => row.id === run)).toBe(false)
  expect(await store.prunePublicationRuns()).toBe(1)
  expect((await pg.query('SELECT * FROM publication_result WHERE run_id = $1', [run])).rows).toEqual([])
  const replay = await store.startRun('later-replay')
  await store.completeRun(replay, [output])
  expect((await store.listPublicationRuns()).find(row => row.id === replay)?.articles).toEqual([{ id, title: 'Permanent' }])
  expect(await store.getArticle(id)).toMatchObject({ sections: content.sections, sourceCount: 1 })
  expect((await pg.query('SELECT l.url FROM link l JOIN article_reference r ON r.link_id=l.id WHERE article_id=$1', [id])).rows).toEqual([{ url: citation.url }])
})

it('rolls back all outputs when a stable Article key is accidentally reused for different editorial content', async () => {
  const run = await store.startRun('collision setup')
  const output = { key: 'z-collision', content }
  await store.completeRun(run, [output])
  const collision = await store.startRun('collision')
  const changed = { ...content, title: 'Different editorial work' }
  await expect(store.completeRun(collision, [
    { key: 'a-should-roll-back', content: { ...content, title: 'Rollback me' } },
    { key: output.key, content: changed },
  ])).rejects.toThrow()
  await expect(store.completeRun(run, [])).rejects.toThrow()
  expect((await store.listArticles()).some(row => row.title === 'Rollback me')).toBe(false)
  expect((await store.listPublicationRuns()).find(row => row.id === collision)).toMatchObject({ status: 'running', articles: [] })
})
