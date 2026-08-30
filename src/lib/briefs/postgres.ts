import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import 'server-only'

interface SignalMutationRow {
  [key: string]: unknown
  authorized: boolean
}

export type SignalMutationExecutor = (
  statement: SQL,
) => Promise<{ rows: readonly SignalMutationRow[] }>

function ownedSignalWalk(userId: string, requestedSignalId: string) {
  return sql`
    WITH RECURSIVE owned_signal_walk AS (
      SELECT
        brief_entry."signal_id" AS "original_id",
        signal_row."id" AS "current_id",
        signal_row."merged_into_id",
        ARRAY[signal_row."id"]::uuid[] AS "path"
      FROM "brief_entry" AS brief_entry
      INNER JOIN "signal" AS signal_row
        ON signal_row."id" = brief_entry."signal_id"
      WHERE brief_entry."user_id" = ${userId}::uuid

      UNION ALL

      SELECT
        owned_signal_walk."original_id",
        next_signal."id" AS "current_id",
        next_signal."merged_into_id",
        array_append(owned_signal_walk."path", next_signal."id")
      FROM owned_signal_walk
      INNER JOIN "signal" AS next_signal
        ON next_signal."id" = owned_signal_walk."merged_into_id"
      WHERE owned_signal_walk."merged_into_id" IS NOT NULL
        AND NOT next_signal."id" = ANY(owned_signal_walk."path")
    ),
    owned_signal_root AS (
      SELECT DISTINCT owned_signal_walk."current_id" AS "root_id"
      FROM owned_signal_walk
      WHERE owned_signal_walk."merged_into_id" IS NULL
    ),
    authorized_member_walk AS (
      SELECT
        owned_signal_root."root_id",
        owned_signal_root."root_id" AS "member_id",
        ARRAY[owned_signal_root."root_id"]::uuid[] AS "path"
      FROM owned_signal_root

      UNION ALL

      SELECT
        authorized_member_walk."root_id",
        alias_signal."id" AS "member_id",
        array_append(authorized_member_walk."path", alias_signal."id")
      FROM authorized_member_walk
      INNER JOIN "signal" AS alias_signal
        ON alias_signal."merged_into_id" = authorized_member_walk."member_id"
      WHERE NOT alias_signal."id" = ANY(authorized_member_walk."path")
    ),
    authorized_member AS (
      SELECT DISTINCT "root_id", "member_id"
      FROM authorized_member_walk
    ),
    authorized_signal AS (
      SELECT DISTINCT authorized_member."root_id" AS "signal_id"
      FROM authorized_member
      WHERE authorized_member."member_id" = ${requestedSignalId}::uuid
    )
  `
}

function saveStatement(userId: string, requestedSignalId: string) {
  return sql`
    ${ownedSignalWalk(userId, requestedSignalId)},
    mutation AS (
      INSERT INTO "bookmark" ("user_id", "signal_id", "saved_at")
      SELECT ${userId}::uuid, authorized_signal."signal_id", CURRENT_TIMESTAMP
      FROM authorized_signal
      WHERE NOT EXISTS (
        SELECT 1
        FROM "bookmark" AS existing_state
        INNER JOIN authorized_member
          ON authorized_member."member_id" = existing_state."signal_id"
          AND authorized_member."root_id" = authorized_signal."signal_id"
        WHERE existing_state."user_id" = ${userId}::uuid
      )
      ON CONFLICT ("user_id", "signal_id") DO NOTHING
      RETURNING "signal_id"
    )
    SELECT EXISTS (SELECT 1 FROM authorized_signal) AS "authorized"
  `
}

function markReadStatement(userId: string, requestedSignalId: string) {
  return sql`
    ${ownedSignalWalk(userId, requestedSignalId)},
    mutation AS (
      INSERT INTO "read_state" ("user_id", "signal_id", "read_at")
      SELECT ${userId}::uuid, authorized_signal."signal_id", CURRENT_TIMESTAMP
      FROM authorized_signal
      WHERE NOT EXISTS (
        SELECT 1
        FROM "read_state" AS existing_state
        INNER JOIN authorized_member
          ON authorized_member."member_id" = existing_state."signal_id"
          AND authorized_member."root_id" = authorized_signal."signal_id"
        WHERE existing_state."user_id" = ${userId}::uuid
      )
      ON CONFLICT ("user_id", "signal_id") DO NOTHING
      RETURNING "signal_id"
    )
    SELECT EXISTS (SELECT 1 FROM authorized_signal) AS "authorized"
  `
}

async function mutate(
  execute: SignalMutationExecutor,
  statement: SQL,
): Promise<void> {
  const result = await execute(statement)
  if (result.rows[0]?.authorized !== true)
    throw new Error('Signal is not authorized for this reader')
}

export function createBriefSignalMutations(execute: SignalMutationExecutor) {
  return {
    markRead: (userId: string, requestedSignalId: string) =>
      mutate(execute, markReadStatement(userId, requestedSignalId)),
    save: (userId: string, requestedSignalId: string) =>
      mutate(execute, saveStatement(userId, requestedSignalId)),
  }
}

const productionMutations = createBriefSignalMutations(async (statement) => {
  const result = await db().execute<SignalMutationRow>(statement)
  return { rows: result.rows }
})

/** Save only a resolved Signal reached through this reader's own Brief history. */
export async function saveBriefSignal(userId: string, requestedSignalId: string): Promise<void> {
  await productionMutations.save(userId, requestedSignalId)
}

/** Mark read only a resolved Signal reached through this reader's own Brief history. */
export async function markBriefSignalRead(userId: string, requestedSignalId: string): Promise<void> {
  await productionMutations.markRead(userId, requestedSignalId)
}
