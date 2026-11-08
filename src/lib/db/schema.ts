import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const users = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role', { enum: ['author', 'reader'] }).notNull().default('reader'),
  revokedAt: timestampTz('revoked_at'),
  passphraseHash: text('passphrase_hash').notNull(),
  sessionVersion: integer('session_version').notNull().default(0),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestampTz('locked_until'),
  interfaceLanguage: text('interface_language').notNull().default('system'),
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  unique('user_role_unique').on(table.role),
  check('user_role_check', sql`${table.role} IN ('author', 'reader')`),
  check(
    'user_passphrase_hash_argon2id_check',
    sql`${table.passphraseHash} LIKE '$argon2id$v=19$m=65536,t=3,p=1$%'`,
  ),
  check('user_session_version_nonnegative_check', sql`${table.sessionVersion} >= 0`),
  check('user_failed_attempts_nonnegative_check', sql`${table.failedAttempts} >= 0`),
  check('user_interface_language_check', sql`${table.interfaceLanguage} IN ('system', 'en', 'zh')`),
  check('user_timezone_nonempty_check', sql`length(btrim(${table.timezone})) > 0`),
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

export const archivedBookmarks = pgTable('archived_bookmark', {
  userId: uuid('user_id').notNull(),
  legacySignalId: uuid('legacy_signal_id').notNull(),
  linkId: uuid('link_id').notNull().references(() => links.id),
  title: text('title').notNull(),
  body: text('body'),
  summary: text('summary'),
  savedAt: timestampTz('saved_at').notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.legacySignalId] }),
])

/** Original captures are independent of legacy Items and their text limits. */
export const captureSources = pgTable('capture_source', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull().unique(),
  kind: text('kind').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  trackingSince: timestampTz('tracking_since').notNull().defaultNow(),
}, table => [check('capture_source_kind_check', sql`${table.kind} IN ('x','blog')`)])
export const captureCards = pgTable('capture_card', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => captureSources.id),
  title: text('title').notNull(),
  author: text('author').notNull(),
  originalUrl: text('original_url').notNull(),
  threadKey: text('thread_key').notNull(),
  threadUrl: text('thread_url').notNull(),
  publishedAt: timestampTz('published_at').notNull(),
  capturedAt: timestampTz('captured_at').notNull().defaultNow(),
  expiresAt: timestampTz('expires_at').notNull().default(sql`now() + interval '7 days'`),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
  incompleteReason: text('incomplete_reason'),
  continuationOf: text('continuation_of'),
}, table => [index('capture_card_expiry_idx').on(table.expiresAt), index('capture_card_publication_idx').on(table.publishedAt.desc()), uniqueIndex('capture_card_thread_idx').on(table.threadKey)])
export const capturePosts = pgTable('capture_post', {
  originalKey: text('original_key').primaryKey(),
  cardId: uuid('card_id').notNull().references(() => captureCards.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  publishedAt: timestampTz('published_at').notNull(),
  body: text('body').notNull(),
})
/** The only capture content surviving expiry: identity and original deadline. */
export const captureReceipts = pgTable('capture_receipt', {
  originalKey: text('original_key').primaryKey(),
  expiresAt: timestampTz('expires_at').notNull(),
})
const captureBytes = customType<{ data: Uint8Array }>({ dataType: () => 'bytea' })
export const captureImages = pgTable('capture_image', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => captureCards.id, { onDelete: 'cascade' }),
  data: captureBytes('data').notNull(),
  mimeType: text('mime_type').notNull(),
  alt: text('alt').notNull(),
  digest: text('digest').notNull(),
  position: integer('position').notNull(),
}, table => [unique('capture_image_card_id_digest_key').on(table.cardId, table.digest), check('capture_image_data_check', sql`octet_length(${table.data}) <= 524288`), check('capture_image_mime_type_check', sql`${table.mimeType} IN ('image/jpeg','image/png','image/webp')`)])
export const captureRuns = pgTable('capture_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => captureSources.id),
  startedAt: timestampTz('started_at').notNull().defaultNow(),
  finishedAt: timestampTz('finished_at'),
  status: text('status').notNull(),
  addedCount: integer('added_count').notNull().default(0),
  message: text('message'),
}, table => [check('capture_run_status_check', sql`${table.status} IN ('running','success','partial','failed')`), check('capture_run_added_count_check', sql`${table.addedCount} >= 0`)])

export const articles = pgTable('article', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicationKey: text('publication_key').notNull().unique(),
  initialDigest: text('initial_digest').notNull(),
  content: jsonb('content').notNull(),
  draft: jsonb('draft'),
  publishedAt: timestampTz('published_at').notNull().defaultNow(),
}, table => [index('article_published_at_idx').on(table.publishedAt)])

export const articleReferences = pgTable('article_reference', {
  articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').notNull().references(() => links.id),
}, table => [primaryKey({ columns: [table.articleId, table.linkId] })])

export const publicationRuns = pgTable('publication_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptKey: text('attempt_key').notNull().unique(),
  retryOf: uuid('retry_of').references((): AnyPgColumn => publicationRuns.id, { onDelete: 'set null' }),
  startedAt: timestampTz('started_at').notNull().defaultNow(),
  finishedAt: timestampTz('finished_at'),
  status: text('status', { enum: ['running', 'published', 'empty', 'failed'] }).notNull().default('running'),
  stages: jsonb('stages').notNull().default([]),
  reason: text('reason'),
  outputDigest: text('output_digest'),
}, table => [
  index('publication_run_started_at_idx').on(table.startedAt),
  check('publication_run_status_check', sql`${table.status} IN ('running','published','empty','failed')`),
])

export const publicationResults = pgTable('publication_result', {
  runId: uuid('run_id').notNull().references(() => publicationRuns.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  title: text('title').notNull(),
}, table => [primaryKey({ columns: [table.runId, table.articleId] })])

export const writingDrafts = pgTable('writing_draft', {
  id: uuid('id').primaryKey(),
  revision: integer('revision').notNull(),
  content: jsonb('content'),
  articleId: uuid('article_id').references(() => articles.id),
  updatedAt: timestampTz('updated_at').defaultNow().notNull(),
})
