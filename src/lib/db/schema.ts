import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  halfvec,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const sourceTransport = pgEnum('source_transport', [
  'rss',
  'atom',
  'hn_firebase',
  'hn_algolia',
  'github_graphql',
  'bluesky_feed',
])

export const sourceFetchOutcome = pgEnum('source_fetch_outcome', [
  'ok',
  'not_modified',
  'http_error',
  'timeout',
  'robots_denied',
  'parse_error',
  'too_large',
])

export const citationKind = pgEnum('citation_kind', [
  'self',
  'outbound',
])

export const signalTextBasis = pgEnum('signal_text_basis', [
  'own',
  'citing',
  'slug',
])

/** The local reader identity that owns an Interest Profile. */
export const users = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
})

/** One owning voice, independently of how many hosts or Sources it uses. */
export const publishers = pgTable('publisher', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
})

/**
 * The schema-level `host -> publisher_id` uniqueness guard.
 *
 * Host ownership is a relation rather than an array column because a Publisher
 * may own several hosts while a host must have exactly one owner. Making `host`
 * the key enforces the latter without duplicating Publisher identities.
 */
export const publisherHosts = pgTable('publisher_host', {
  host: text('host').primaryKey(),
  publisherId: uuid('publisher_id').notNull().references(() => publishers.id, { onDelete: 'cascade' }),
})

export const sources = pgTable('source', {
  id: uuid('id').primaryKey().defaultRandom(),
  publisherId: uuid('publisher_id').notNull().references(() => publishers.id),
  transport: sourceTransport('transport').notNull(),
  endpointUrl: text('endpoint_url').notNull().unique(),
  isAggregator: boolean('is_aggregator').notNull().default(false),
  disabledAt: timestampTz('disabled_at'),
  disabledReason: text('disabled_reason'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  retryAfterAt: timestampTz('retry_after_at'),
  lastPolledAt: timestampTz('last_polled_at'),
  newestItemAt: timestampTz('newest_item_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
})

export const items = pgTable('item', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  url: text('url'),
  title: text('title').notNull(),
  summary: text('summary'),
  rawFeedDate: text('raw_feed_date'),
  publishedAt: timestampTz('published_at').notNull(),
  fetchedAt: timestampTz('fetched_at').notNull(),
  issueHydratedAt: timestampTz('issue_hydrated_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  unique('item_source_external_id_unique').on(table.sourceId, table.externalId),
  index('item_published_at_idx').on(table.publishedAt),
])

/** A canonical web address, whether or not Zis ingested an Item from it. */
export const links = pgTable('link', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  firstSeenAt: timestampTz('first_seen_at').notNull(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  unique('link_url_unique').on(table.url),
])

/** One eager Link identity, retained as a tombstone after an alias merge. */
export const signals = pgTable('signal', {
  id: uuid('id').primaryKey(),
  targetLinkId: uuid('target_link_id').notNull().references(() => links.id),
  mergedIntoId: uuid('merged_into_id').references((): AnyPgColumn => signals.id),
  strength: integer('strength').notNull().default(0),
  originPublisherId: uuid('origin_publisher_id').references(() => publishers.id),
  textBasis: signalTextBasis('text_basis'),
  /** The exact bounded text passed to the embedding model. */
  embeddingText: text('embedding_text'),
  embedding: halfvec('embedding', { dimensions: 384 }),
  embeddingModel: text('embedding_model'),
  embeddingDimensions: integer('embedding_dimensions'),
  embeddingVersion: text('embedding_version'),
  embeddedAt: timestampTz('embedded_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  unique('signal_target_link_id_unique').on(table.targetLinkId),
  index('signal_merged_into_id_idx').on(table.mergedIntoId),
  check(
    'signal_embedding_complete_check',
    sql`(${table.embedding} IS NULL
      AND ${table.textBasis} IS NULL
      AND ${table.embeddingText} IS NULL
      AND ${table.embeddingModel} IS NULL
      AND ${table.embeddingDimensions} IS NULL
      AND ${table.embeddingVersion} IS NULL
      AND ${table.embeddedAt} IS NULL)
      OR (${table.embedding} IS NOT NULL
        AND ${table.textBasis} IS NOT NULL
        AND ${table.embeddingText} IS NOT NULL
        AND ${table.embeddingModel} IS NOT NULL
        AND ${table.embeddingDimensions} = 384
        AND ${table.embeddingVersion} IS NOT NULL
        AND ${table.embeddedAt} IS NOT NULL)`,
  ),
  check(
    'signal_embedding_text_length_check',
    sql`${table.embeddingText} IS NULL OR length(${table.embeddingText}) BETWEEN 1 AND 1200`,
  ),
])

/** Item-to-Link provenance. The raw address survives canonicalization. */
export const citations = pgTable('citation', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  sourceId: uuid('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').notNull().references(() => links.id),
  kind: citationKind('kind').notNull(),
  rawUrl: text('raw_url').notNull(),
  anchorText: text('anchor_text'),
  firstSeenAt: timestampTz('first_seen_at').notNull(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  unique('citation_item_kind_raw_url_unique').on(table.itemId, table.kind, table.rawUrl),
  index('citation_link_id_idx').on(table.linkId),
  index('citation_source_id_idx').on(table.sourceId),
])

/** One positive Interest statement and its independently-computed embedding. */
export const interests = pgTable('interest', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  embedding: halfvec('embedding', { dimensions: 384 }),
  embeddingInputHash: text('embedding_input_hash'),
  embeddingModel: text('embedding_model'),
  embeddingDimensions: integer('embedding_dimensions'),
  embeddingVersion: text('embedding_version'),
  embeddedAt: timestampTz('embedded_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  unique('interest_id_user_id_unique').on(table.id, table.userId),
  index('interest_user_id_idx').on(table.userId),
  check('interest_statement_nonempty_check', sql`length(btrim(${table.statement})) > 0`),
  check(
    'interest_embedding_complete_check',
    sql`(${table.embedding} IS NULL
      AND ${table.embeddingInputHash} IS NULL
      AND ${table.embeddingModel} IS NULL
      AND ${table.embeddingDimensions} IS NULL
      AND ${table.embeddingVersion} IS NULL
      AND ${table.embeddedAt} IS NULL)
      OR (${table.embedding} IS NOT NULL
        AND ${table.embeddingInputHash} IS NOT NULL
        AND ${table.embeddingModel} IS NOT NULL
        AND ${table.embeddingDimensions} = 384
        AND ${table.embeddingVersion} IS NOT NULL
        AND ${table.embeddedAt} IS NOT NULL)`,
  ),
])

/** The latest MAX-cosine Interest match for one reader and one Signal. */
export const readerSignalMatches = pgTable('reader_signal_match', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  signalId: uuid('signal_id').notNull().references(() => signals.id, { onDelete: 'cascade' }),
  matchedInterestId: uuid('matched_interest_id'),
  relevance: doublePrecision('relevance'),
  gap: doublePrecision('gap'),
  matchedAt: timestampTz('matched_at').notNull(),
}, table => [
  primaryKey({
    name: 'reader_signal_match_user_id_signal_id_pk',
    columns: [table.userId, table.signalId],
  }),
  foreignKey({
    name: 'reader_signal_match_interest_owner_fk',
    columns: [table.matchedInterestId, table.userId],
    foreignColumns: [interests.id, interests.userId],
  }).onDelete('cascade'),
  index('reader_signal_match_signal_id_idx').on(table.signalId),
  check(
    'reader_signal_match_winner_check',
    sql`(${table.matchedInterestId} IS NULL AND ${table.relevance} IS NULL AND ${table.gap} IS NULL)
      OR (${table.matchedInterestId} IS NOT NULL AND ${table.relevance} IS NOT NULL)`,
  ),
  check(
    'reader_signal_match_relevance_range_check',
    sql`${table.relevance} IS NULL OR ${table.relevance} BETWEEN -1 AND 1`,
  ),
  check(
    'reader_signal_match_gap_range_check',
    sql`${table.gap} IS NULL OR ${table.gap} BETWEEN 0 AND 2`,
  ),
])

export const sourceFetchLogs = pgTable('source_fetch_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  startedAt: timestampTz('started_at').notNull(),
  durationMs: integer('duration_ms').notNull(),
  outcome: sourceFetchOutcome('outcome').notNull(),
  httpStatus: integer('http_status'),
  itemsSeen: integer('items_seen').notNull().default(0),
  itemsNew: integer('items_new').notNull().default(0),
  bytes: integer('bytes').notNull().default(0),
  errorMessage: text('error_message'),
}, table => [
  index('source_fetch_log_source_started_idx').on(table.sourceId, table.startedAt.desc()),
])

/** Validators only. A body column here would violate ADR-0005. */
export const httpCache = pgTable('http_cache', {
  url: text('url').primaryKey(),
  etag: text('etag'),
  lastModified: text('last_modified'),
  lastStatus: integer('last_status'),
  fetchedAt: timestampTz('fetched_at').notNull(),
})

export const robotsCache = pgTable('robots_cache', {
  host: text('host').primaryKey(),
  verdict: text('verdict').notNull(),
  directives: jsonb('directives').notNull(),
  status: integer('status').notNull(),
  contentType: text('content_type'),
  wafAction: text('waf_action'),
  authoritative: boolean('authoritative').notNull(),
  fetchedAt: timestampTz('fetched_at').notNull(),
  expiresAt: timestampTz('expires_at').notNull(),
}, table => [
  index('robots_cache_expires_at_idx').on(table.expiresAt),
])
