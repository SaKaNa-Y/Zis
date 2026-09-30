import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { afterEach, describe, expect, it } from 'vitest'
import register from '../../../docs/source-register.json'

const recovery = readFileSync(new URL('../../../scripts/operations/2026-09-30-recover-remaining-sources.sql', import.meta.url), 'utf8')
const oldEndpoint = 'https://importai.substack.com/feed'
const newEndpoint = 'https://jack-clark.net/feed/'
const oldGuid = 'https://importai.substack.com/p/import-ai-474-platonic-mindspace'
const newGuid = 'https://jack-clark.net/2026/09/28/import-ai-474-platonic-mindspace-tpus-in-space-zhipu-starts-an-outer-rsi-loop/'
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

async function briefDigests(pg: PGlite): Promise<unknown> {
  return (await pg.query(`SELECT
    (SELECT md5(string_agg(to_jsonb(b)::text, '' ORDER BY id)) FROM brief b) AS briefs,
    (SELECT md5(string_agg(to_jsonb(e)::text, '' ORDER BY to_jsonb(e)::text)) FROM brief_entry e) AS entries`)).rows
}

async function insertItem(pg: PGlite, endpoint: string, externalId: string): Promise<void> {
  await pg.query(`INSERT INTO item(source_id,external_id,url,title,summary,text,published_at,fetched_at)
    SELECT id,$2,$2,'Retained issue','Retained summary','Retained body',
      '2026-09-01T00:00:00Z','2026-09-01T00:00:00Z' FROM source WHERE endpoint_url=$1`, [endpoint, externalId])
}

describe('remaining Source recovery maintenance', () => {
  it('recovers only reviewed automatic feed failures and forces a real HN policy recheck', async () => {
    const pg = await fixture()
    const feeds = ['https://vercel.com/atom', 'https://danluu.com/atom.xml', 'https://antfu.me/feed.xml', 'https://magazine.sebastianraschka.com/feed']
    const hn = ['https://hacker-news.firebaseio.com/v0/topstories.json', 'https://hacker-news.firebaseio.com/v0/newstories.json']
    await pg.exec(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z', disabled_reason='manual review', consecutive_failures=10, retry_after_at='2026-10-01T00:00:00Z'`)
    await pg.query(`UPDATE source SET disabled_reason='automatically disabled after 10 consecutive failures' WHERE endpoint_url=ANY($1::text[])`, [feeds])
    await pg.query(`UPDATE source SET disabled_reason='automatically disabled after 10 consecutive robots denials' WHERE endpoint_url=ANY($1::text[])`, [hn])
    await pg.exec(`INSERT INTO robots_cache(host,verdict,directives,status,content_type,authoritative,fetched_at,expires_at)
      VALUES ('hacker-news.firebaseio.com','ambiguous','{}',200,'application/octet-stream, text/plain',false,'2026-09-30T03:30:15Z','2026-10-01T03:30:15Z'),
      ('unrelated.example','ambiguous','{}',200,'application/octet-stream, text/plain',false,'2026-09-30T03:30:15Z','2026-10-01T03:30:15Z');`)
    const before = await state(pg)
    await pg.exec(recovery)
    const after = await state(pg)
    for (const row of before.source!) {
      const expected = feeds.includes(String(row.endpoint_url))
        ? { ...row, disabled_at: null, disabled_reason: null, consecutive_failures: 0, retry_after_at: null }
        : hn.includes(String(row.endpoint_url))
          ? { ...row, retry_after_at: null }
          : { ...row, endpoint_url: row.endpoint_url === oldEndpoint ? newEndpoint : row.endpoint_url }
      expect(after.source!.find(candidate => candidate.id === row.id)).toEqual(expected)
    }
    const cached = after.robots_cache!.find(row => row.host === 'hacker-news.firebaseio.com')!
    expect(cached).toMatchObject({ verdict: 'ambiguous', authoritative: false })
    expect(new Date(String(cached.expires_at)).toISOString()).toBe('2026-09-30T00:00:00.000Z')
    expect(after.robots_cache!.find(row => row.host === 'unrelated.example')).toEqual(before.robots_cache!.find(row => row.host === 'unrelated.example'))
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(after)
  })

  it('moves Import AI in place and preserves Item and Citation identities plus all sealed Brief rows', async () => {
    const pg = await fixture()
    await pg.query(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z',
      disabled_reason='automatically disabled after 10 consecutive robots denials',
      consecutive_failures=10, retry_after_at='2026-10-01T00:00:00Z',
      last_polled_at='2026-09-25T00:00:00Z', newest_item_at='2026-09-07T00:00:00Z'
      WHERE endpoint_url=$1`, [oldEndpoint])
    await insertItem(pg, oldEndpoint, oldGuid)
    await insertItem(pg, oldEndpoint, 'https://importai.substack.com/p/import-ai-464-retained-history')
    await insertItem(pg, 'https://github.blog/feed/', oldGuid)
    await pg.exec(`INSERT INTO link(id,url,first_seen_at)
      VALUES ('00000000-0000-4000-8000-000000000001','https://research.example/retained','2026-09-01T00:00:00Z');
      INSERT INTO signal(id,target_link_id)
      VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
      INSERT INTO citation(item_id,source_id,link_id,kind,raw_url,first_seen_at)
      SELECT id,source_id,'00000000-0000-4000-8000-000000000001','outbound','https://research.example/retained','2026-09-01T00:00:00Z' FROM item;
      INSERT INTO brief(user_id,local_date,cut_at) SELECT id,'2026-09-17','2026-09-17T00:00:00Z' FROM "user";
      INSERT INTO brief_entry(brief_id,user_id,signal_id,position,admitted_by,why_text)
      SELECT id,user_id,'00000000-0000-4000-8000-000000000001',1,'convergence','Frozen explanation' FROM brief;
      INSERT INTO http_cache(url,etag,fetched_at)
      VALUES ('https://importai.substack.com/feed','retained-etag','2026-09-25T00:00:00Z');
      INSERT INTO robots_cache(host,verdict,directives,status,content_type,authoritative,fetched_at,expires_at)
      VALUES ('importai.substack.com','ambiguous','{}',403,'text/html',false,'2026-09-25T00:00:00Z','2026-10-25T00:00:00Z');`)
    const before = await state(pg)
    const beforeDigests = await briefDigests(pg)
    const source = before.source!.find(row => row.endpoint_url === oldEndpoint)!
    expect(before.item).toHaveLength(3)
    expect(before.citation).toHaveLength(3)
    expect(before.brief).toHaveLength(1)
    expect(before.brief_entry).toHaveLength(1)
    await pg.exec(recovery)
    const after = await state(pg)
    for (const row of before.source!) {
      expect(after.source!.find(candidate => candidate.id === row.id)).toEqual(row.id === source.id
        ? { ...row, endpoint_url: newEndpoint, disabled_at: null, disabled_reason: null, consecutive_failures: 0, retry_after_at: null }
        : row)
    }
    expect(after.item).toEqual(before.item)
    expect(after.item).toHaveLength(before.item!.length)
    for (const table of Object.keys(before).filter(table => table !== 'source' && table !== 'item'))
      expect(after[table]).toEqual(before[table])
    expect(await briefDigests(pg)).toEqual(beforeDigests)
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(after)
    expect(await briefDigests(pg)).toEqual(beforeDigests)
  })

  it('preserves a manual disable and leaves all Item identities untouched', async () => {
    const pg = await fixture()
    await pg.query(`UPDATE source SET disabled_at='2026-09-25T00:00:00Z', disabled_reason='manual review',
      consecutive_failures=12, retry_after_at='2026-10-01T00:00:00Z' WHERE endpoint_url=$1`, [oldEndpoint])
    for (const guid of [oldGuid, newGuid])
      await insertItem(pg, oldEndpoint, guid)
    const before = await state(pg)
    await pg.exec(recovery)
    const after = await state(pg)
    expect(after.item).toEqual(before.item)
    for (const row of before.source!) {
      expect(after.source!.find(candidate => candidate.id === row.id)).toEqual({
        ...row,
        endpoint_url: row.endpoint_url === oldEndpoint ? newEndpoint : row.endpoint_url,
      })
    }
    await pg.exec(recovery)
    expect(await state(pg)).toEqual(after)
  })

  it('uses the reviewed author-owned endpoint in the register and a fresh database', async () => {
    const pg = await fixture()
    const before = await state(pg)
    const source = before.source!.find(row => row.endpoint_url === oldEndpoint)!
    await pg.exec(recovery)
    const actual = (await state(pg)).source!.find(row => row.id === source.id)!
    expect(actual).toEqual({ ...source, endpoint_url: newEndpoint })
    expect(register.publishers.find(publisher => publisher.id === 'importai')?.sources).toEqual([
      { transport: 'rss', url: newEndpoint },
    ])
  })
})
