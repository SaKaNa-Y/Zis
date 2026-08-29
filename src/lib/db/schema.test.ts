import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
    expect(items.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'source_id,external_id',
    )).toBe(true)
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
      'first_seen_at',
      'created_at',
    ])
    expect(citations.uniqueConstraints.some(constraint =>
      constraint.columns.map(column => column.name).join(',') === 'item_id,kind,raw_url',
    )).toBe(true)
  })

  it('has a committed migration and does not migrate from a build or workflow', () => {
    const migration = join(root, 'drizzle', '0000_rss_ingestion.sql')
    const linkCitationMigration = join(root, 'drizzle', '0001_link_citation_graph.sql')
    const migrationJournal = join(root, 'drizzle', 'meta', '_journal.json')
    const initialSnapshot = join(root, 'drizzle', 'meta', '0000_snapshot.json')
    const linkCitationSnapshot = join(root, 'drizzle', 'meta', '0001_snapshot.json')
    expect(existsSync(migration)).toBe(true)
    expect(existsSync(linkCitationMigration)).toBe(true)
    expect(existsSync(initialSnapshot)).toBe(true)
    expect(existsSync(linkCitationSnapshot)).toBe(true)
    const sql = readFileSync(migration, 'utf8')
    const linkCitationSql = readFileSync(linkCitationMigration, 'utf8')
    expect(sql).toContain('CREATE TABLE "publisher"')
    expect(sql).toContain('CREATE TABLE "source"')
    expect(sql).toContain('CREATE TABLE "item"')
    expect(linkCitationSql).toContain('CREATE TABLE "link"')
    expect(linkCitationSql).toContain('CREATE TABLE "citation"')
    expect(linkCitationSql).toContain('DELETE FROM "http_cache"')
    const journal = JSON.parse(readFileSync(migrationJournal, 'utf8')) as {
      entries: Array<{ tag: string }>
    }
    expect(journal.entries.map(entry => entry.tag)).toEqual([
      '0000_rss_ingestion',
      '0001_link_citation_graph',
    ])

    const packageJson = readFileSync(join(root, 'package.json'), 'utf8')
    expect(packageJson).not.toMatch(/"build"\s*:\s*"[^"]*(?:drizzle-kit|db:migrate)/)
  })
})
