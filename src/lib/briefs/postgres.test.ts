import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { createBriefSignalMutations } from './postgres'

vi.mock('server-only', () => ({}))

const READER_ID = '00000000-0000-4000-8000-000000000076'
const SIGNAL_ID = '00000000-0000-4000-8000-000000000760'

function sqlText(statement: SQL): { params: unknown[], sql: string } {
  return new PgDialect().sqlToQuery(statement)
}

describe('today reader mutation SQL', () => {
  it('authorizes against the reader Brief history and stays idempotent across later merges', async () => {
    const statements: SQL[] = []
    const execute = vi.fn(async (statement: SQL) => {
      statements.push(statement)
      return { rows: [{ authorized: true }] }
    })
    const mutations = createBriefSignalMutations(execute)

    await mutations.save(READER_ID, SIGNAL_ID)
    await mutations.markRead(READER_ID, SIGNAL_ID)

    expect(statements).toHaveLength(2)
    const save = sqlText(statements[0]!)
    const markRead = sqlText(statements[1]!)
    for (const query of [save, markRead]) {
      expect(query.sql).toContain('WITH RECURSIVE owned_signal_walk AS')
      expect(query.sql).toContain('brief_entry."user_id" = $1::uuid')
      expect(query.sql).toContain('array_append(owned_signal_walk."path"')
      expect(query.sql).toContain('NOT next_signal."id" = ANY(owned_signal_walk."path")')
      expect(query.sql).toContain('authorized_member_walk AS')
      expect(query.sql).toContain('authorized_member."member_id" = $2::uuid')
      expect(query.sql).not.toContain('"depth"')
      expect(query.params).toContain(READER_ID)
      expect(query.params).toContain(SIGNAL_ID)
    }
    expect(save.sql).toContain('INSERT INTO "bookmark"')
    expect(save.sql).toContain('FROM "bookmark" AS existing_state')
    expect(markRead.sql).toContain('INSERT INTO "read_state"')
    expect(markRead.sql).toContain('FROM "read_state" AS existing_state')
  })

  it('rejects a Signal that cannot be resolved through this reader Brief history', async () => {
    const mutations = createBriefSignalMutations(async () => ({
      rows: [{ authorized: false }],
    }))

    await expect(mutations.save(READER_ID, SIGNAL_ID))
      .rejects
      .toThrow('not authorized for this reader')
  })
})
