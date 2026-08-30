import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import {
  createSignalProvenanceReader,
  signalProvenanceStatement,
} from './provenance'

vi.mock('server-only', () => ({}))

const USER_ID = '00000000-0000-4000-8000-000000000770'
const ENTRY_ID = '00000000-0000-4000-8000-000000000771'

describe('signal provenance read model', () => {
  it('scopes the projection to one owned Brief Entry and gathers Citations from every Signal member', () => {
    const query = new PgDialect().sqlToQuery(signalProvenanceStatement(USER_ID, ENTRY_ID))

    expect(query.params).toEqual([USER_ID, ENTRY_ID])
    expect(query.sql).toContain('FROM "brief_entry" AS entry')
    expect(query.sql).toContain('entry."user_id" = $1::uuid')
    expect(query.sql).toContain('entry."signal_id" = $2::uuid')
    expect(query.sql).toContain('signal_walk AS')
    expect(query.sql).toContain('member_walk AS')
    expect(query.sql).toContain('alias_signal."merged_into_id" = member_walk."member_id"')
    expect(query.sql).toContain('citation_row."link_id" = cited_signal."target_link_id"')
    expect(query.sql).toContain('citing_source_row."id" = citation_row."source_id"')
    expect(query.sql).toContain('root_signal."origin_publisher_id"')
    expect(query.sql).not.toContain('reader_signal_match')
    expect(query.sql).not.toContain('"relevance"')
    expect(query.sql).not.toContain('"gap"')
  })

  it('fails instead of rendering arithmetic that disagrees with stored Strength', async () => {
    const readProvenance = createSignalProvenanceReader(async () => [{
      admitted_by: 'interest',
      citation_first_seen_at: '2026-08-30T01:00:00.000Z',
      citation_id: '00000000-0000-4000-8000-000000000772',
      entry_signal_id: ENTRY_ID,
      item_title: 'One independent account',
      item_url: null,
      origin_publisher_id: '00000000-0000-4000-8000-000000000774',
      origin_publisher_name: 'Origin Publisher',
      origin_url: 'https://origin.example/release',
      publisher_id: '00000000-0000-4000-8000-000000000773',
      publisher_name: 'Only Publisher',
      signal_id: '00000000-0000-4000-8000-000000000775',
      strength: 2,
      summary: null,
      title: 'The claim under review',
    }])

    await expect(readProvenance(USER_ID, ENTRY_ID))
      .rejects
      .toThrow('Strength 2 but 1 contributing Publishers')
  })

  it('treats a malformed route id as absent without touching the database', async () => {
    const queryRows = vi.fn()
    const readProvenance = createSignalProvenanceReader(queryRows)

    await expect(readProvenance(USER_ID, 'not-a-signal-id')).resolves.toBeNull()
    expect(queryRows).not.toHaveBeenCalled()
  })
})
