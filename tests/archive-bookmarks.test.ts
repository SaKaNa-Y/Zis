import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('preserves the original account and each bookmark when its legacy graph expires', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(`
      CREATE TABLE "user" (id uuid PRIMARY KEY);
      CREATE TABLE link (id uuid PRIMARY KEY, url text);
      CREATE TABLE signal (id uuid PRIMARY KEY, target_link_id uuid, merged_into_id uuid, embedding_text text);
      CREATE TABLE source (id uuid PRIMARY KEY, is_aggregator boolean);
      CREATE TABLE item (id uuid PRIMARY KEY, title text, text text, summary text, source_id uuid);
      CREATE TABLE citation (id uuid PRIMARY KEY, kind text, item_id uuid, link_id uuid, anchor_text text);
      CREATE TABLE bookmark (user_id uuid, signal_id uuid, saved_at timestamptz);
      INSERT INTO "user" VALUES (gen_random_uuid());
      INSERT INTO link VALUES (gen_random_uuid(), 'https://example.org/original');
      INSERT INTO signal SELECT gen_random_uuid(), id, NULL, NULL FROM link;
      INSERT INTO item VALUES (gen_random_uuid(), 'Original', NULL, 'Summary only', NULL);
      INSERT INTO citation SELECT gen_random_uuid(), 'self', item.id, link.id, NULL FROM item, link;
      INSERT INTO bookmark SELECT "user".id, signal.id, '2026-01-01' FROM "user", signal;
    `)
    await pg.exec(readFileSync(new URL('../drizzle/0014_publication_access.sql', import.meta.url), 'utf8'))
    await pg.exec('DROP TABLE bookmark, signal, citation, item')
    expect((await pg.query('SELECT role FROM "user"')).rows).toEqual([{ role: 'author' }])
    expect((await pg.query('SELECT title, body, summary, url FROM archived_bookmark JOIN link ON link.id = link_id')).rows)
      .toEqual([{ title: 'Original', body: null, summary: 'Summary only', url: 'https://example.org/original' }])
  }
  finally {
    await pg.close()
  }
})
