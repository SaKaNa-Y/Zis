import type { Database } from '@/lib/db'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readIngestionHealthSnapshot } from './health-snapshot'

const WAKE = new Date('2026-09-30T00:00:00Z')
const SOURCE = '00000000-0000-4000-8000-000000000001'
const OTHER_SOURCE = '00000000-0000-4000-8000-000000000002'
const SHANGHAI = '00000000-0000-4000-8000-000000000003'
const LOS_ANGELES = '00000000-0000-4000-8000-000000000004'
const TOKYO = '00000000-0000-4000-8000-000000000005'

let pg: PGlite
let database: Pick<Database, 'select'>

beforeAll(async () => {
  pg = await PGlite.create()
  database = drizzle(pg) as unknown as Pick<Database, 'select'>
  // Deliberately omit secrets, Interest data, Brief Entries and error_message.
  // A projection that expands to those fields will fail these real SQL reads.
  await pg.exec(`
    CREATE TABLE source (
      id uuid PRIMARY KEY, publisher_id uuid NOT NULL, transport text NOT NULL,
      endpoint_url text NOT NULL, is_aggregator boolean NOT NULL DEFAULT false,
      disabled_at timestamptz, disabled_reason text, consecutive_failures integer NOT NULL DEFAULT 0,
      retry_after_at timestamptz, last_polled_at timestamptz, newest_item_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE source_fetch_log (
      id bigserial PRIMARY KEY, source_id uuid NOT NULL, started_at timestamptz NOT NULL,
      duration_ms integer NOT NULL DEFAULT 1, outcome text NOT NULL, http_status integer,
      items_seen integer NOT NULL DEFAULT 0, items_new integer NOT NULL DEFAULT 0,
      bytes integer NOT NULL DEFAULT 0
    );
    CREATE TABLE "user" (id uuid PRIMARY KEY, timezone text NOT NULL, cut_hour smallint NOT NULL);
    CREATE TABLE brief (user_id uuid NOT NULL, local_date date NOT NULL);
  `)
})

beforeEach(async () => {
  await pg.exec('TRUNCATE source, source_fetch_log, "user", brief')
})

afterAll(async () => {
  await pg.close()
})

describe('production ingestion health snapshot', () => {
  it('reads disabled Sources and persisted current-wake outcomes without error text', async () => {
    await pg.query(`INSERT INTO source(id,publisher_id,transport,endpoint_url,disabled_at,disabled_reason,consecutive_failures)
      VALUES ($1,$1,'rss','https://disabled.example/feed',$3,'operator review',10),
             ($2,$2,'rss','https://active.example/feed',NULL,NULL,0)`, [SOURCE, OTHER_SOURCE, WAKE.toISOString()])
    await pg.query(`INSERT INTO source_fetch_log(source_id,started_at,outcome,http_status)
      VALUES ($1,$2,'parse_error',200), ($1,$3,'ok',200), ($1,$4,'not_modified',304)`, [OTHER_SOURCE, new Date(WAKE.getTime() - 1).toISOString(), WAKE.toISOString(), new Date(WAKE.getTime() + 1).toISOString()])
    const snapshot = await readIngestionHealthSnapshot(database, WAKE)
    expect(snapshot.sources).toHaveLength(2)
    expect(snapshot.sources.find(source => source.id === SOURCE)).toMatchObject({ disabledAt: WAKE, consecutiveFailures: 10 })
    expect(snapshot.fetchLogs.map(log => log.outcome)).toEqual(['ok', 'not_modified'])
    expect(snapshot.fetchLogs.every(log => log.errorMessage === null)).toBe(true)
    expect(snapshot.briefStatus).toBe('unverified')
  })

  it('checks every due reader on their own local date and accepts an empty persisted Brief', async () => {
    await pg.query(`INSERT INTO "user"(id,timezone,cut_hour)
      VALUES ($1,'Asia/Shanghai',6), ($2,'America/Los_Angeles',6), ($3,'Asia/Tokyo',10)`, [SHANGHAI, LOS_ANGELES, TOKYO])
    await pg.query('INSERT INTO brief(user_id,local_date) VALUES ($1,$2)', [SHANGHAI, '2026-09-30'])
    expect((await readIngestionHealthSnapshot(database, WAKE)).briefStatus).toBe('missing')
    // At this wake Los Angeles is still September 29; Tokyo has not reached its cut.
    await pg.query('INSERT INTO brief(user_id,local_date) VALUES ($1,$2)', [LOS_ANGELES, '2026-09-29'])
    expect((await readIngestionHealthSnapshot(database, WAKE)).briefStatus).toBe('confirmed')
  })

  it('distinguishes no readers from readers before their cut and treats the cut hour as due', async () => {
    expect((await readIngestionHealthSnapshot(database, WAKE)).briefStatus).toBe('unverified')
    await pg.query('INSERT INTO "user"(id,timezone,cut_hour) VALUES ($1,$2,6)', [SHANGHAI, 'UTC'])
    expect((await readIngestionHealthSnapshot(database, WAKE)).briefStatus).toBe('not_due')
    expect((await readIngestionHealthSnapshot(database, new Date('2026-09-30T06:00:00Z'))).briefStatus).toBe('missing')
    await pg.exec('UPDATE "user" SET cut_hour=0')
    expect((await readIngestionHealthSnapshot(database, WAKE)).briefStatus).toBe('missing')
  })

  it('does not interpolate reader timezones into SQL or expose their value in configuration errors', async () => {
    const invalidTimezone = 'UTC\'); DROP TABLE source; --'
    await pg.query('INSERT INTO "user"(id,timezone,cut_hour) VALUES ($1,$2,0)', [SHANGHAI, invalidTimezone])
    await expect(readIngestionHealthSnapshot(database, WAKE)).rejects.toThrow('Invalid reader clock for ingestion health snapshot')
    expect((await pg.query('SELECT count(*) FROM source')).rows).toHaveLength(1)
  })

  it('propagates a database read failure so the caller can preserve its original ingestion failure', async () => {
    const failure = new Error('test-only database unavailable')
    const unavailable = {
      select: () => {
        throw failure
      },
    } as unknown as Pick<Database, 'select'>
    await expect(readIngestionHealthSnapshot(unavailable, WAKE)).rejects.toBe(failure)
  })
})
