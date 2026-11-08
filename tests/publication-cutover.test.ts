import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { expect, it } from 'vitest'

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { idx: number, tag: string }[] }
const cutover = readFileSync('drizzle/0016_retire_brief.sql', 'utf8')

it('stops cutover when a bookmark is missing and resumes without losing its Link', async () => {
  const pg = new PGlite({ extensions: { vector } })
  try {
    for (const entry of journal.entries.filter(entry => entry.idx < 16)) {
      await pg.exec(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8'))
    }
    await pg.exec(`
      WITH target AS (INSERT INTO link(url,first_seen_at) VALUES ('https://example.org/post',now()) RETURNING id),
      saved_signal AS (INSERT INTO signal(id,target_link_id) SELECT id,id FROM target RETURNING id)
      INSERT INTO bookmark(user_id,signal_id) SELECT u.id,s.id FROM "user" u CROSS JOIN saved_signal s;
    `)
    await expect(pg.transaction(tx => tx.exec(cutover))).rejects.toThrow('Bookmark archive differs')
    await pg.exec(`
      INSERT INTO archived_bookmark(user_id,legacy_signal_id,link_id,title,body,summary,saved_at)
      SELECT * FROM legacy_bookmark_snapshot;
      CREATE VIEW other_consumer AS SELECT id FROM brief;
    `)
    await expect(pg.transaction(tx => tx.exec(cutover))).rejects.toThrow(/depend/)
    await pg.exec('DROP VIEW other_consumer')
    await pg.exec('UPDATE archived_bookmark SET title=\'Stale title\'')
    await expect(pg.transaction(tx => tx.exec(cutover))).rejects.toThrow('Bookmark archive differs')
    await pg.exec('UPDATE archived_bookmark SET title=(SELECT title FROM legacy_bookmark_snapshot)')
    await pg.exec('DELETE FROM bookmark')
    await expect(pg.transaction(tx => tx.exec(cutover))).rejects.toThrow('Bookmark archive differs')
    await pg.exec('INSERT INTO bookmark(user_id, signal_id, saved_at) SELECT user_id, legacy_signal_id, saved_at FROM archived_bookmark')
    await pg.transaction(tx => tx.exec(cutover))
    expect((await pg.query('SELECT title,summary,url FROM archived_bookmark JOIN link ON link.id=link_id')).rows)
      .toEqual([{ title: 'https://example.org/post', summary: null, url: 'https://example.org/post' }])
    expect((await pg.query('SELECT to_regclass(\'public.brief\') AS brief, to_regclass(\'public.reading_translation\') AS translations')).rows)
      .toEqual([{ brief: null, translations: null }])
  }
  finally {
    await pg.close()
  }
})
