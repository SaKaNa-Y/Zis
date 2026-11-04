import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export function briefStatement(userId: string, localDate: SQL) {
  return sql`
    WITH RECURSIVE
    reader AS (
      SELECT
        reader_user."id",
        ${localDate} AS "local_date"
      FROM "user" AS reader_user
      WHERE reader_user."id" = ${userId}::uuid
    ),
    selected_brief AS (
      SELECT selected.*
      FROM "brief" AS selected
      INNER JOIN reader ON reader."id" = selected."user_id"
        AND reader."local_date" = selected."local_date"
    ),
    previous_brief AS (
      SELECT previous."local_date"
      FROM "brief" AS previous
      INNER JOIN reader ON reader."id" = previous."user_id"
      WHERE previous."local_date" < reader."local_date"
      ORDER BY previous."local_date" DESC
      LIMIT 1
    ),
    brief_signal_walk AS (
      SELECT
        seed_entry."signal_id" AS "original_id",
        signal_row."id" AS "current_id",
        signal_row."merged_into_id",
        ARRAY[signal_row."id"]::uuid[] AS "path"
      FROM "brief_entry" AS seed_entry
      INNER JOIN selected_brief
        ON selected_brief."id" = seed_entry."brief_id"
      INNER JOIN reader ON reader."id" = seed_entry."user_id"
      INNER JOIN "signal" AS signal_row
        ON signal_row."id" = seed_entry."signal_id"

      UNION ALL

      SELECT
        brief_signal_walk."original_id",
        next_signal."id" AS "current_id",
        next_signal."merged_into_id",
        array_append(brief_signal_walk."path", next_signal."id")
      FROM brief_signal_walk
      INNER JOIN "signal" AS next_signal
        ON next_signal."id" = brief_signal_walk."merged_into_id"
      WHERE brief_signal_walk."merged_into_id" IS NOT NULL
        AND NOT next_signal."id" = ANY(brief_signal_walk."path")
    ),
    brief_signal_root AS (
      SELECT
        brief_signal_walk."original_id",
        brief_signal_walk."current_id" AS "root_id"
      FROM brief_signal_walk
      WHERE brief_signal_walk."merged_into_id" IS NULL
    ),
    root_member_walk AS (
      SELECT DISTINCT
        brief_signal_root."root_id",
        brief_signal_root."root_id" AS "member_id",
        ARRAY[brief_signal_root."root_id"]::uuid[] AS "path"
      FROM brief_signal_root

      UNION ALL

      SELECT
        root_member_walk."root_id",
        alias_signal."id" AS "member_id",
        array_append(root_member_walk."path", alias_signal."id")
      FROM root_member_walk
      INNER JOIN "signal" AS alias_signal
        ON alias_signal."merged_into_id" = root_member_walk."member_id"
      WHERE NOT alias_signal."id" = ANY(root_member_walk."path")
    ),
    root_member AS (
      SELECT DISTINCT "root_id", "member_id"
      FROM root_member_walk
    )
    SELECT
      reader."local_date"::text AS "local_date",
      selected_brief."id"::text AS "brief_id",
      previous_brief."local_date"::text AS "previous_brief_date",
      brief_entry."signal_id"::text AS "entry_signal_id",
      resolved_entry."root_id"::text AS "signal_id",
      brief_entry."position",
      brief_entry."admitted_by"::text,
      brief_entry."why_text",
      target_link."url" AS "origin_url",
      COALESCE(
        own_item."title",
        cited_anchor."anchor_text",
        citing_item."title",
        root_signal."embedding_text",
        target_link."url"
      ) AS "title",
      own_item."summary" AS "summary",
      CASE WHEN root_signal."id" IS NULL THEN NULL ELSE EXISTS (
        SELECT 1
        FROM "bookmark" AS bookmark_row
        INNER JOIN root_member AS bookmarked_member
          ON bookmarked_member."member_id" = bookmark_row."signal_id"
          AND bookmarked_member."root_id" = root_signal."id"
        WHERE bookmark_row."user_id" = reader."id"
      ) END AS "is_bookmarked",
      CASE WHEN root_signal."id" IS NULL THEN NULL ELSE EXISTS (
        SELECT 1
        FROM "read_state" AS read_row
        INNER JOIN root_member AS read_member
          ON read_member."member_id" = read_row."signal_id"
          AND read_member."root_id" = root_signal."id"
        WHERE read_row."user_id" = reader."id"
      ) END AS "is_read"
    FROM reader
    LEFT JOIN selected_brief ON TRUE
    LEFT JOIN previous_brief ON TRUE
    LEFT JOIN "brief_entry" AS brief_entry
      ON brief_entry."brief_id" = selected_brief."id"
      AND brief_entry."user_id" = reader."id"
    LEFT JOIN brief_signal_root AS resolved_entry
      ON resolved_entry."original_id" = brief_entry."signal_id"
    LEFT JOIN "signal" AS root_signal
      ON root_signal."id" = resolved_entry."root_id"
    LEFT JOIN "link" AS target_link
      ON target_link."id" = root_signal."target_link_id"
    LEFT JOIN LATERAL (
      SELECT own."title", own."summary"
      FROM root_member AS own_member
      INNER JOIN "signal" AS own_signal
        ON own_signal."id" = own_member."member_id"
      INNER JOIN "citation" AS own_citation
        ON own_citation."link_id" = own_signal."target_link_id"
      INNER JOIN "item" AS own ON own."id" = own_citation."item_id"
      WHERE own_citation."kind" = 'self'
        AND own_member."root_id" = root_signal."id"
      ORDER BY length(COALESCE(own."summary", '')) DESC, own."id"
      LIMIT 1
    ) AS own_item ON TRUE
    LEFT JOIN LATERAL (
      SELECT outbound."anchor_text"
      FROM root_member AS cited_member
      INNER JOIN "signal" AS cited_signal
        ON cited_signal."id" = cited_member."member_id"
      INNER JOIN "citation" AS outbound
        ON outbound."link_id" = cited_signal."target_link_id"
      WHERE outbound."kind" = 'outbound'
        AND outbound."anchor_text" IS NOT NULL
        AND cited_member."root_id" = root_signal."id"
      ORDER BY length(outbound."anchor_text") DESC, outbound."id"
      LIMIT 1
    ) AS cited_anchor ON TRUE
    LEFT JOIN LATERAL (
      SELECT citing."title"
      FROM root_member AS cited_member
      INNER JOIN "signal" AS cited_signal
        ON cited_signal."id" = cited_member."member_id"
      INNER JOIN "citation" AS outbound
        ON outbound."link_id" = cited_signal."target_link_id"
      INNER JOIN "item" AS citing ON citing."id" = outbound."item_id"
      INNER JOIN "source" AS citing_source ON citing_source."id" = citing."source_id"
      WHERE outbound."kind" = 'outbound'
        AND cited_member."root_id" = root_signal."id"
        AND citing_source."is_aggregator" = false
      ORDER BY length(citing."title") DESC, citing."id"
      LIMIT 1
    ) AS citing_item ON TRUE
    ORDER BY brief_entry."position" NULLS LAST
  `
}
