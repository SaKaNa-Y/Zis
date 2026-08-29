import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verify } from '@node-rs/argon2'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from './schema'

const root = fileURLToPath(new URL('../../..', import.meta.url))

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map(column => column.name)
}

describe('the ingestion schema', () => {
  it('persists Publisher ownership with one owner per host', () => {
    expect(getTableConfig(schema.publishers).name).toBe('publisher')
    const hosts = getTableConfig(schema.publisherHosts)
    expect(hosts.name).toBe('publisher_host')
    expect(hosts.primaryKeys.some(key => key.columns.map(column => column.name).includes('host'))
      || hosts.columns.some(column => column.name === 'host' && column.primary)).toBe(true)
  })

  it('keeps cadence and validators out of Source', () => {
    expect(getTableConfig(schema.sources).name).toBe('source')
    expect(columnNames(schema.sources)).toEqual([
      'id',
      'publisher_id',
      'transport',
      'endpoint_url',
      'is_aggregator',
      'disabled_at',
      'disabled_reason',
      'consecutive_failures',
      'retry_after_at',
      'last_polled_at',
      'newest_item_at',
      'created_at',
    ])
  })

  it('stores validators without response bodies', () => {
    expect(getTableConfig(schema.httpCache).name).toBe('http_cache')
    expect(columnNames(schema.httpCache)).toEqual([
      'url',
      'etag',
      'last_modified',
      'last_status',
      'fetched_at',
    ])
  })

  it('stores every fetch outcome and the persisted robots verdict', () => {
    expect(getTableConfig(schema.sourceFetchLogs).name).toBe('source_fetch_log')
    expect(getTableConfig(schema.robotsCache).name).toBe('robots_cache')
  })

  it('keys Items naturally per Source and keeps both raw and normalized dates', () => {
    const items = getTableConfig(schema.items)
    expect(items.name).toBe('item')
    expect(columnNames(schema.items)).toContain('raw_feed_date')
    expect(columnNames(schema.items)).toContain('published_at')
    expect(columnNames(schema.items)).toContain('issue_hydrated_at')
    expect(items.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'source_id,external_id',
    )).toBe(true)
    expect(items.checks.map(check => check.name)).toContain('item_summary_length_check')
  })

  it('stores canonical Links and Citation provenance idempotently', () => {
    const links = getTableConfig(schema.links)
    expect(links.name).toBe('link')
    expect(columnNames(schema.links)).toEqual([
      'id',
      'url',
      'first_seen_at',
      'created_at',
    ])
    expect(links.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'url',
    )).toBe(true)

    expect(schema.citationKind.enumValues).toEqual(['self', 'outbound'])
    const citations = getTableConfig(schema.citations)
    expect(citations.name).toBe('citation')
    expect(columnNames(schema.citations)).toEqual([
      'id',
      'item_id',
      'source_id',
      'link_id',
      'kind',
      'raw_url',
      'anchor_text',
      'first_seen_at',
      'created_at',
    ])
    expect(citations.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'item_id,kind,raw_url',
    )).toBe(true)
  })

  it('creates one durable Signal for every Link and retains merge tombstones', () => {
    const signals = getTableConfig(schema.signals)
    expect(signals.name).toBe('signal')
    expect(columnNames(schema.signals)).toEqual([
      'id',
      'target_link_id',
      'merged_into_id',
      'strength',
      'origin_publisher_id',
      'text_basis',
      'embedding_text',
      'embedding',
      'embedding_model',
      'embedding_dimensions',
      'embedding_version',
      'embedded_at',
      'created_at',
    ])
    expect(signals.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'target_link_id',
    )).toBe(true)
  })

  it('stores one 384-dimensional embedding for each explicit Interest statement', () => {
    expect(getTableConfig(schema.users).name).toBe('user')
    expect(columnNames(schema.users)).toEqual([
      'id',
      'passphrase_hash',
      'session_version',
      'failed_attempts',
      'locked_until',
      'timezone',
      'cut_hour',
      'created_at',
    ])
    expect(getTableConfig(schema.users).checks.map(check => check.name)).toEqual(expect.arrayContaining([
      'user_timezone_nonempty_check',
      'user_cut_hour_range_check',
      'user_passphrase_hash_argon2id_check',
      'user_session_version_nonnegative_check',
      'user_failed_attempts_nonnegative_check',
    ]))

    const interests = getTableConfig(schema.interests)
    expect(interests.name).toBe('interest')
    expect(columnNames(schema.interests)).toEqual([
      'id',
      'user_id',
      'statement',
      'embedding',
      'embedding_input_hash',
      'embedding_model',
      'embedding_dimensions',
      'embedding_version',
      'embedded_at',
      'created_at',
      'updated_at',
    ])
    expect(interests.columns.find(column => column.name === 'embedding')?.getSQLType())
      .toBe('halfvec(384)')
    expect(interests.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'id,user_id',
    )).toBe(true)
  })

  it('persists per-reader Signal matches and constrains the winning Interest to that reader', () => {
    const matches = getTableConfig(schema.readerSignalMatches)
    expect(matches.name).toBe('reader_signal_match')
    expect(columnNames(schema.readerSignalMatches)).toEqual([
      'user_id',
      'signal_id',
      'matched_interest_id',
      'relevance',
      'gap',
      'matched_at',
    ])
    expect(matches.primaryKeys.some(key =>
      key.columns.map(column => column.name).join(',') === 'user_id,signal_id',
    )).toBe(true)
    expect(matches.columns.find(column => column.name === 'relevance')?.getSQLType())
      .toBe('double precision')
    expect(matches.columns.find(column => column.name === 'gap')?.getSQLType())
      .toBe('double precision')
    expect(matches.foreignKeys.some((key) => {
      const reference = key.reference()
      return reference.columns.map(column => column.name).join(',') === 'matched_interest_id,user_id'
        && reference.foreignColumns.map(column => column.name).join(',') === 'id,user_id'
    })).toBe(true)
  })

  it('uses an explicit Text Basis and half-precision vectors for Signal embeddings', () => {
    expect(schema.signalTextBasis.enumValues).toEqual(['own', 'citing', 'slug'])
    const signals = getTableConfig(schema.signals)
    expect(signals.columns.find(column => column.name === 'embedding')?.getSQLType())
      .toBe('halfvec(384)')
    expect(signals.checks.map(check => check.name)).toContain('signal_embedding_text_length_check')
  })

  it('persists an unsealed Brief with reader-safe entries and Read State', () => {
    expect(schema.briefAdmission.enumValues).toEqual(['interest', 'convergence'])

    const briefs = getTableConfig(schema.briefs)
    expect(briefs.name).toBe('brief')
    expect(columnNames(schema.briefs)).toEqual([
      'id',
      'user_id',
      'local_date',
      'cut_at',
      'created_at',
    ])
    expect(briefs.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'user_id,local_date',
    )).toBe(true)
    expect(briefs.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'id,user_id',
    )).toBe(true)

    const entries = getTableConfig(schema.briefEntries)
    expect(entries.name).toBe('brief_entry')
    expect(columnNames(schema.briefEntries)).toEqual([
      'brief_id',
      'user_id',
      'signal_id',
      'position',
      'admitted_by',
      'why_text',
      'created_at',
    ])
    expect(entries.primaryKeys.some(key =>
      key.columns.map(column => column.name).join(',') === 'brief_id,signal_id',
    )).toBe(true)
    expect(entries.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'user_id,signal_id',
    )).toBe(true)
    expect(entries.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'brief_id,position',
    )).toBe(true)
    expect(entries.foreignKeys.some((key) => {
      const reference = key.reference()
      return reference.columns.map(column => column.name).join(',') === 'brief_id,user_id'
        && reference.foreignColumns.map(column => column.name).join(',') === 'id,user_id'
    })).toBe(true)
    expect(entries.checks.map(check => check.name)).toEqual(expect.arrayContaining([
      'brief_entry_position_positive_check',
      'brief_entry_why_text_nonempty_check',
    ]))
    expect(columnNames(schema.briefEntries)).not.toContain('sealed_at')

    const readStates = getTableConfig(schema.readStates)
    expect(readStates.name).toBe('read_state')
    expect(columnNames(schema.readStates)).toEqual([
      'user_id',
      'signal_id',
      'read_at',
    ])
    expect(readStates.primaryKeys.some(key =>
      key.columns.map(column => column.name).join(',') === 'user_id,signal_id',
    )).toBe(true)
  })

  it('has a committed migration and does not migrate from a build or workflow', async () => {
    const migration = join(root, 'drizzle', '0000_rss_ingestion.sql')
    const linkCitationMigration = join(root, 'drizzle', '0001_link_citation_graph.sql')
    const signalStrengthMigration = join(root, 'drizzle', '0002_signal_strength.sql')
    const issueHydrationMigration = join(root, 'drizzle', '0003_issue_hydration_state.sql')
    const signalInterestMigration = join(root, 'drizzle', '0004_signal_interest_embedding.sql')
    const briefAdmissionMigration = join(root, 'drizzle', '0005_brief_admission.sql')
    const authMigration = join(root, 'drizzle', '0006_auth.sql')
    const migrationJournal = join(root, 'drizzle', 'meta', '_journal.json')
    const initialSnapshot = join(root, 'drizzle', 'meta', '0000_snapshot.json')
    const linkCitationSnapshot = join(root, 'drizzle', 'meta', '0001_snapshot.json')
    const signalStrengthSnapshot = join(root, 'drizzle', 'meta', '0002_snapshot.json')
    const issueHydrationSnapshot = join(root, 'drizzle', 'meta', '0003_snapshot.json')
    const signalInterestSnapshot = join(root, 'drizzle', 'meta', '0004_snapshot.json')
    const briefAdmissionSnapshot = join(root, 'drizzle', 'meta', '0005_snapshot.json')
    const authSnapshot = join(root, 'drizzle', 'meta', '0006_snapshot.json')
    expect(existsSync(migration)).toBe(true)
    expect(existsSync(linkCitationMigration)).toBe(true)
    expect(existsSync(signalStrengthMigration)).toBe(true)
    expect(existsSync(issueHydrationMigration)).toBe(true)
    expect(existsSync(signalInterestMigration)).toBe(true)
    expect(existsSync(briefAdmissionMigration)).toBe(true)
    expect(existsSync(authMigration)).toBe(true)
    expect(existsSync(initialSnapshot)).toBe(true)
    expect(existsSync(linkCitationSnapshot)).toBe(true)
    expect(existsSync(signalStrengthSnapshot)).toBe(true)
    expect(existsSync(issueHydrationSnapshot)).toBe(true)
    expect(existsSync(signalInterestSnapshot)).toBe(true)
    expect(existsSync(briefAdmissionSnapshot)).toBe(true)
    expect(existsSync(authSnapshot)).toBe(true)
    const sql = readFileSync(migration, 'utf8')
    const linkCitationSql = readFileSync(linkCitationMigration, 'utf8')
    const signalStrengthSql = readFileSync(signalStrengthMigration, 'utf8')
    const issueHydrationSql = readFileSync(issueHydrationMigration, 'utf8')
    const signalInterestSql = readFileSync(signalInterestMigration, 'utf8')
    const briefAdmissionSql = readFileSync(briefAdmissionMigration, 'utf8')
    const authSql = readFileSync(authMigration, 'utf8')
    expect(sql).toContain('CREATE TABLE "publisher"')
    expect(sql).toContain('CREATE TABLE "source"')
    expect(sql).toContain('CREATE TABLE "item"')
    expect(linkCitationSql).toContain('CREATE TABLE "link"')
    expect(linkCitationSql).toContain('CREATE TABLE "citation"')
    expect(linkCitationSql).toContain('DELETE FROM "http_cache"')
    expect(signalStrengthSql).toContain('CREATE TABLE "signal"')
    expect(signalStrengthSql).toContain('signal_merged_into_id_signal_id_fk')
    expect(signalStrengthSql).toContain('INSERT INTO "signal"')
    expect(signalStrengthSql).toContain('SELECT "id", "id"')
    expect(issueHydrationSql).toContain('ADD COLUMN "issue_hydrated_at"')
    expect(signalInterestSql).toContain('CREATE EXTENSION IF NOT EXISTS vector')
    expect(signalInterestSql.indexOf('CREATE EXTENSION IF NOT EXISTS vector'))
      .toBeLessThan(signalInterestSql.indexOf('halfvec(384)'))
    expect(signalInterestSql).toContain('CREATE TABLE "user"')
    expect(signalInterestSql).toContain('CREATE TABLE "interest"')
    expect(signalInterestSql).toContain('CREATE TABLE "reader_signal_match"')
    expect(signalInterestSql).toContain('reader_signal_match_interest_owner_fk')
    expect(signalInterestSql).toContain('reader_signal_match_relevance_range_check')
    expect(signalInterestSql).toContain('reader_signal_match_gap_range_check')
    expect(signalInterestSql).toContain('signal_embedding_text_length_check')
    expect(briefAdmissionSql).toContain('CREATE TYPE "public"."brief_admission"')
    expect(briefAdmissionSql).toContain('CREATE TABLE "brief"')
    expect(briefAdmissionSql).toContain('CREATE TABLE "brief_entry"')
    expect(briefAdmissionSql).toContain('CREATE TABLE "read_state"')
    expect(briefAdmissionSql).toContain('brief_user_id_local_date_unique')
    expect(briefAdmissionSql).toContain('brief_entry_user_id_signal_id_unique')
    expect(briefAdmissionSql).toContain('brief_entry_brief_id_position_unique')
    expect(briefAdmissionSql).toContain('brief_entry_brief_owner_fk')
    expect(briefAdmissionSql).not.toContain('sealed_at')
    expect(authSql).toContain('ADD COLUMN "passphrase_hash"')
    expect(authSql).toContain('ADD COLUMN "session_version"')
    expect(authSql).toContain('ADD COLUMN "failed_attempts"')
    expect(authSql).toContain('ADD COLUMN "locked_until"')
    expect(authSql).toContain('RAISE EXCEPTION')
    expect(authSql).toMatch(/\$argon2id\$v=19\$m=65536,t=3,p=1\$/)
    expect(authSql).not.toContain('REPLACE_WITH')
    const seededHash = /seed_hash text := '([^']+)'/.exec(authSql)?.[1]
    expect(seededHash).toBeDefined()
    if (seededHash === undefined)
      throw new Error('Auth migration has no seeded credential')
    await expect(verify(seededHash, 'known-wrong-test-passphrase')).resolves.toBe(false)
    const itemBoundAdded = signalInterestSql.indexOf('ADD CONSTRAINT "item_summary_length_check"')
    const itemSummariesBounded = signalInterestSql.indexOf('SET "summary" = left("summary", 1200)')
    const itemBoundValidated = signalInterestSql.indexOf('VALIDATE CONSTRAINT "item_summary_length_check"')
    expect(itemBoundAdded).toBeGreaterThanOrEqual(0)
    expect(itemSummariesBounded).toBeGreaterThan(itemBoundAdded)
    expect(itemBoundValidated).toBeGreaterThan(itemSummariesBounded)
    const journal = JSON.parse(readFileSync(migrationJournal, 'utf8')) as {
      entries: Array<{ tag: string }>
    }
    expect(journal.entries.map(entry => entry.tag)).toEqual([
      '0000_rss_ingestion',
      '0001_link_citation_graph',
      '0002_signal_strength',
      '0003_issue_hydration_state',
      '0004_signal_interest_embedding',
      '0005_brief_admission',
      '0006_auth',
    ])

    const packageJson = readFileSync(join(root, 'package.json'), 'utf8')
    expect(packageJson).not.toMatch(/"build"\s*:\s*"[^"]*(?:drizzle-kit|db:migrate)/)
  })
})
