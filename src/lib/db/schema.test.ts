import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verify } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../..', import.meta.url))

describe('migration history', () => {
  it('has a committed migration and does not migrate from a build or workflow', async () => {
    const migration = join(root, 'drizzle', '0000_rss_ingestion.sql')
    const linkCitationMigration = join(root, 'drizzle', '0001_link_citation_graph.sql')
    const signalStrengthMigration = join(root, 'drizzle', '0002_signal_strength.sql')
    const issueHydrationMigration = join(root, 'drizzle', '0003_issue_hydration_state.sql')
    const signalInterestMigration = join(root, 'drizzle', '0004_signal_interest_embedding.sql')
    const briefAdmissionMigration = join(root, 'drizzle', '0005_brief_admission.sql')
    const authMigration = join(root, 'drizzle', '0006_auth.sql')
    const todayReaderActionsMigration = join(root, 'drizzle', '0007_today_reader_actions.sql')
    const retentionTieringMigration = join(root, 'drizzle', '0008_retention_and_production_corpus.sql')
    const migrationJournal = join(root, 'drizzle', 'meta', '_journal.json')
    const initialSnapshot = join(root, 'drizzle', 'meta', '0000_snapshot.json')
    const linkCitationSnapshot = join(root, 'drizzle', 'meta', '0001_snapshot.json')
    const signalStrengthSnapshot = join(root, 'drizzle', 'meta', '0002_snapshot.json')
    const issueHydrationSnapshot = join(root, 'drizzle', 'meta', '0003_snapshot.json')
    const signalInterestSnapshot = join(root, 'drizzle', 'meta', '0004_snapshot.json')
    const briefAdmissionSnapshot = join(root, 'drizzle', 'meta', '0005_snapshot.json')
    const authSnapshot = join(root, 'drizzle', 'meta', '0006_snapshot.json')
    const todayReaderActionsSnapshot = join(root, 'drizzle', 'meta', '0007_snapshot.json')
    const retentionTieringSnapshot = join(root, 'drizzle', 'meta', '0008_snapshot.json')
    expect(existsSync(migration)).toBe(true)
    expect(existsSync(linkCitationMigration)).toBe(true)
    expect(existsSync(signalStrengthMigration)).toBe(true)
    expect(existsSync(issueHydrationMigration)).toBe(true)
    expect(existsSync(signalInterestMigration)).toBe(true)
    expect(existsSync(briefAdmissionMigration)).toBe(true)
    expect(existsSync(authMigration)).toBe(true)
    expect(existsSync(todayReaderActionsMigration)).toBe(true)
    expect(existsSync(retentionTieringMigration)).toBe(true)
    expect(existsSync(initialSnapshot)).toBe(true)
    expect(existsSync(linkCitationSnapshot)).toBe(true)
    expect(existsSync(signalStrengthSnapshot)).toBe(true)
    expect(existsSync(issueHydrationSnapshot)).toBe(true)
    expect(existsSync(signalInterestSnapshot)).toBe(true)
    expect(existsSync(briefAdmissionSnapshot)).toBe(true)
    expect(existsSync(authSnapshot)).toBe(true)
    expect(existsSync(todayReaderActionsSnapshot)).toBe(true)
    expect(existsSync(retentionTieringSnapshot)).toBe(true)
    const sql = readFileSync(migration, 'utf8')
    const linkCitationSql = readFileSync(linkCitationMigration, 'utf8')
    const signalStrengthSql = readFileSync(signalStrengthMigration, 'utf8')
    const issueHydrationSql = readFileSync(issueHydrationMigration, 'utf8')
    const signalInterestSql = readFileSync(signalInterestMigration, 'utf8')
    const briefAdmissionSql = readFileSync(briefAdmissionMigration, 'utf8')
    const authSql = readFileSync(authMigration, 'utf8')
    const todayReaderActionsSql = readFileSync(todayReaderActionsMigration, 'utf8')
    const retentionTieringSql = readFileSync(retentionTieringMigration, 'utf8')
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
    expect(todayReaderActionsSql).toContain('CREATE TABLE "bookmark"')
    expect(todayReaderActionsSql).toContain('bookmark_user_id_signal_id_pk')
    expect(todayReaderActionsSql).toContain('bookmark_signal_id_idx')
    expect(retentionTieringSql).toContain('ADD COLUMN "text" text')
    expect(retentionTieringSql).toContain('ADD COLUMN "embedding_text_expires_at" timestamp with time zone')
    expect(retentionTieringSql).toContain('item_text_length_check')
    expect(retentionTieringSql).toContain('SET "text" = "summary"')
    expect(retentionTieringSql).toContain('DROP CONSTRAINT "signal_embedding_complete_check"')
    expect(retentionTieringSql).toContain('"signal"."text_basis" IN (\'citing\', \'slug\')')
    expect(retentionTieringSql).toContain('"signal"."embedding_text_expires_at" IS NULL')
    expect(retentionTieringSql).toContain('SET "embedding_text_expires_at" = COALESCE(')
    expect(retentionTieringSql).toContain('"citation"."kind" = \'self\'')
    expect(retentionTieringSql).toContain('ON CONFLICT ("slug") DO UPDATE')
    expect(retentionTieringSql).toContain('ON CONFLICT ("host") DO UPDATE')
    expect(retentionTieringSql).toContain('ON CONFLICT ("endpoint_url") DO UPDATE')
    expect(retentionTieringSql).not.toContain('sealed')
    expect(retentionTieringSql).not.toContain('INSERT INTO "interest"')
    const sourceRegister = JSON.parse(
      readFileSync(join(root, 'tests', 'fixtures', 'legacy-source-register-2026-09-30.json'), 'utf8'),
    ) as {
      publishers: Array<{
        id: string
        hosts: string[]
        sources: Array<{ transport: string, url?: string }>
      }>
    }
    const rssUrls = sourceRegister.publishers.flatMap(publisher => publisher.sources)
      .filter(source => source.transport === 'rss')
      .map(source => source.url)
      .filter((url): url is string => url !== undefined)
    expect(rssUrls).toHaveLength(67)
    // Historical seeds are immutable. Explicit reviewed endpoint updates are
    // applied after them; source-recovery.test.ts verifies the resulting corpus.
    const recoverySql = ['2026-09-30-recover-reviewed-sources.sql', '2026-09-30-recover-remaining-sources.sql']
      .map(name => readFileSync(join(root, 'scripts/operations', name), 'utf8'))
      .join('\n')
    const reviewedEndpointUpdates = [...recoverySql.matchAll(/\bSET\s+endpoint_url\s*=\s*'((?:''|[^'])+)'/g)]
      .map(match => match[1]!.replaceAll('\'\'', '\''))
    for (const url of rssUrls) {
      const seeded = retentionTieringSql.includes(`'${url.replaceAll('\'', '\'\'')}'`)
      expect(seeded || reviewedEndpointUpdates.includes(url)).toBe(true)
    }
    const rssPublishers = sourceRegister.publishers.filter(publisher =>
      publisher.sources.some(source => source.transport === 'rss'),
    )
    for (const publisher of rssPublishers) {
      for (const host of publisher.hosts) {
        expect(retentionTieringSql).toContain(
          `'${host.replaceAll('\'', '\'\'')}', '${publisher.id.replaceAll('\'', '\'\'')}'`,
        )
      }
    }
    for (const aggregatorUrl of [
      'https://tldr.tech/api/rss/tech',
      'https://javascriptweekly.com/rss',
      'https://react.statuscode.com/rss',
      'https://frontendfoc.us/rss',
      'https://nodeweekly.com/rss',
      'https://this-week-in-rust.org/rss.xml',
      'https://pycoders.com/feed',
    ]) {
      expect(retentionTieringSql).toContain(`'${aggregatorUrl}', true`)
    }
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
      '0007_today_reader_actions',
      '0008_retention_and_production_corpus',
      '0009_incremental_signal_matching',
      '0010_incremental_graph_reads',
      '0011_api_sources',
      '0012_reader_preferences_and_translations',
      '0013_information_capture',
      '0014_publication_access',
      '0015_article_publication',
      '0016_retire_brief',
      '0017_author_writing',
    ])

    const packageJson = readFileSync(join(root, 'package.json'), 'utf8')
    expect(packageJson).not.toMatch(/"build"\s*:\s*"[^"]*(?:drizzle-kit|db:migrate)/)
  })
})
