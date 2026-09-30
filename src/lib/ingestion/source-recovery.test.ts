import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { afterEach, describe, expect, it } from 'vitest'
import register from '../../../docs/source-register.json'

const recovery = readFileSync(new URL('../../../scripts/operations/2026-09-30-recover-reviewed-sources.sql', import.meta.url), 'utf8')
const githubUrls = ['https://github.blog/feed/', 'https://github.blog/changelog/feed/']
const oldSophieUrl = 'https://www.sophiebits.com/atom.xml'
const newSophieUrl = 'https://sophiebits.com/atom.xml'
const databases: PGlite[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.close()))
})

async function fixture(): Promise<PGlite> {
  const pg = await PGlite.create({ extensions: { vector } })
  databases.push(pg)
  const migrations = new URL('../../../drizzle/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort())
    await pg.exec(readFileSync(new URL(name, migrations), 'utf8'))
  return pg
}

async function state(pg: PGlite): Promise<Record<string, Array<Record<string, unknown>>>> {
  const result: Record<string, Array<Record<string, unknown>>> = {}
  for (const table of ['source', 'publisher', 'publisher_host', 'item', 'link', 'signal', 'citation', 'brief', 'brief_entry', 'source_fetch_log', 'http_cache', 'robots_cache']) {
    result[table] = (await pg.query<{ row: Record<string, unknown> }>(
      `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
    )).rows.map(row => row.row)
  }
  return result
}

describe('reviewed Source recovery maintenance', () => {
  it('recovers only the three reviewed automatic failures and preserves Source identities and history on repeat', async () => {
    const pg = await fixture()
    await pg.query(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z',
      disabled_reason=CASE WHEN endpoint_url=$1
        THEN 'automatically disabled after 10 consecutive robots denials'
        ELSE 'automatically disabled after 10 consecutive failures' END,
      consecutive_failures=10, retry_after_at='2026-10-01T00:00:00Z',
      last_polled_at='2026-09-25T00:00:00Z', newest_item_at='2026-09-01T00:00:00Z'
      WHERE endpoint_url=ANY($2::text[])`, [oldSophieUrl, [...githubUrls, oldSophieUrl]])
    await pg.query(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z', disabled_reason='manual review', consecutive_failures=10
      WHERE id IN (SELECT id FROM source WHERE NOT endpoint_url=ANY($1::text[]) ORDER BY id LIMIT 8)`, [[...githubUrls, oldSophieUrl]])
    await pg.query(`INSERT INTO item(source_id,external_id,url,title,summary,text,published_at,fetched_at)
      SELECT id,'retained-item','https://sophiebits.com/history','Retained title','Retained summary','Retained body',
        '2026-09-01T00:00:00Z','2026-09-01T00:00:00Z' FROM source WHERE endpoint_url=$1`, [oldSophieUrl])
    await pg.exec(`INSERT INTO link(id,url,first_seen_at) VALUES ('00000000-0000-4000-8000-000000000001','https://sophiebits.com/history','2026-09-01T00:00:00Z');
      INSERT INTO signal(id,target_link_id) VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
      INSERT INTO brief(user_id,local_date,cut_at) SELECT id,'2026-09-17','2026-09-17T00:00:00Z' FROM "user";
      INSERT INTO brief_entry(brief_id,user_id,signal_id,position,admitted_by,why_text)
        SELECT id,user_id,'00000000-0000-4000-8000-000000000001',1,'convergence','Frozen explanation' FROM brief;
      INSERT INTO http_cache(url,etag,fetched_at) VALUES ('https://www.sophiebits.com/atom.xml','retained-etag','2026-09-25T00:00:00Z');
      INSERT INTO robots_cache(host,verdict,directives,status,content_type,authoritative,fetched_at,expires_at)
        VALUES ('www.sophiebits.com','denied','{}',200,'text/html',false,'2026-09-25T00:00:00Z','2026-10-25T00:00:00Z');`)
    const before = await state(pg)
    expect(before.brief).toHaveLength(1)
    expect(before.brief_entry).toHaveLength(1)
    expect(before.item).toHaveLength(1)
    const reviewed = before.source!.filter(row => [...githubUrls, oldSophieUrl].includes(String(row.endpoint_url)))
    expect(reviewed).toHaveLength(3)
    await pg.exec(recovery)
    const after = await state(pg)
    for (const row of before.source!) {
      const actual = after.source!.find(candidate => candidate.id === row.id)
      if (reviewed.some(candidate => candidate.id === row.id)) {
        expect(actual).toEqual({ ...row, endpoint_url: row.endpoint_url === oldSophieUrl ? newSophieUrl : row.endpoint_url, disabled_at: null, disabled_reason: null, consecutive_failures: 0, retry_after_at: null })
      }
      else {
        expect(actual).toEqual(row)
      }
    }
    expect(after.source!.filter(row => row.disabled_at !== null)).toHaveLength(8)
    for (const table of Object.keys(before).filter(table => table !== 'source'))
      expect(after[table]).toEqual(before[table])
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(after)
  })

  it('preserves manual disable decisions while changing the existing Sophie endpoint', async () => {
    const pg = await fixture()
    await pg.query(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z', disabled_reason='manual review',
      consecutive_failures=12, retry_after_at='2026-10-01T00:00:00Z' WHERE endpoint_url=ANY($1::text[])`, [[...githubUrls, oldSophieUrl]])
    const before = await state(pg)
    await pg.exec(recovery)
    const after = await state(pg)
    for (const row of before.source!) {
      expect(after.source!.find(candidate => candidate.id === row.id)).toEqual({
        ...row,
        endpoint_url: row.endpoint_url === oldSophieUrl ? newSophieUrl : row.endpoint_url,
      })
    }
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(after)
  })

  it('brings a fresh immutable seed into agreement with the current RSS register without replacing rows', async () => {
    const pg = await fixture()
    const before = await state(pg)
    await pg.exec(recovery)
    const after = await state(pg)
    // Each maintenance step has its own identity-preservation test. A fresh
    // seed reaches the current register only after applying both reviewed moves.
    await pg.exec(readFileSync(new URL('../../../scripts/operations/2026-09-30-recover-remaining-sources.sql', import.meta.url), 'utf8'))
    const current = await state(pg)
    const expectedUrls = register.publishers.flatMap(publisher =>
      publisher.sources.filter(source => source.transport === 'rss')
        .flatMap(source => 'url' in source && source.url !== undefined ? [source.url] : []),
    ).sort()
    expect(current.source!.filter(row => row.transport === 'rss').map(row => row.endpoint_url).sort()).toEqual(expectedUrls)
    for (const row of before.source!) {
      expect(after.source!.find(candidate => candidate.id === row.id)).toEqual({
        ...row,
        endpoint_url: row.endpoint_url === oldSophieUrl ? newSophieUrl : row.endpoint_url,
      })
    }
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(current)
  })
})
