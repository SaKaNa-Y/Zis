import type { DatabaseStatement } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

interface ProfileSnapshot { id: string, userId: string, statement: string }

/** Both the editor and final ingestion commit take this transaction-scoped lock. */
export function guardInterestProfiles(snapshot: ProfileSnapshot[], userIds: string[]): DatabaseStatement[] {
  const dialect = new PgDialect()
  const expected = snapshot.map(row => [row.id, row.userId, row.statement]).sort((a, b) => a[0]!.localeCompare(b[0]!))
  return [
    dialect.sqlToQuery(sql`SELECT pg_advisory_xact_lock(936193)`),
    // A mismatch must abort the entire transaction, including Briefs/checkpoints.
    // The failing cast reports a useful retry reason without a schema function.
    dialect.sqlToQuery(sql`SELECT (CASE WHEN (
      SELECT coalesce(jsonb_agg(jsonb_build_array(id::text, user_id::text, statement) ORDER BY id), '[]'::jsonb)
      FROM interest WHERE user_id IN (SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(userIds)}::jsonb))
    ) = ${JSON.stringify(expected)}::jsonb THEN '1'
      ELSE 'Interest Profile changed during computation; reload and retry' END)::integer`),
  ]
}
