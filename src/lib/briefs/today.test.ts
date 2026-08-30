import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { createTodayBriefReader, todayBriefStatement } from './today'

vi.mock('server-only', () => ({}))

const USER_ID = '00000000-0000-4000-8000-000000000076'

describe('today brief read model', () => {
  it('builds a bounded projection from the selected Brief instead of the whole Signal corpus', () => {
    const at = new Date('2026-08-30T08:00:00.000Z')
    const query = new PgDialect().sqlToQuery(todayBriefStatement(USER_ID, at))

    expect(query.sql).toContain('FROM "brief_entry" AS seed_entry')
    expect(query.sql).toContain('INNER JOIN selected_brief')
    expect(query.sql).toContain('root_member_walk AS')
    expect(query.sql).toContain('brief_entry."signal_id"::text AS "entry_signal_id"')
    expect(query.sql).toContain('NOT next_signal."id" = ANY(brief_signal_walk."path")')
    expect(query.sql).not.toContain('"depth"')
    expect(query.params).toEqual([at.toISOString(), USER_ID])
  })

  it('preserves a cut Brief with zero Entries as the real empty state', async () => {
    const readTodayBrief = createTodayBriefReader(async () => [{
      admitted_by: null,
      brief_id: '00000000-0000-4000-8000-000000000760',
      entry_signal_id: null,
      is_bookmarked: null,
      is_read: null,
      local_date: '2026-08-30',
      origin_url: null,
      position: null,
      previous_brief_date: '2026-08-29',
      signal_id: null,
      summary: null,
      title: null,
      why_text: null,
    }])

    await expect(readTodayBrief(USER_ID, new Date('2026-08-30T08:00:00.000Z')))
      .resolves
      .toEqual({
        entries: [],
        hasBrief: true,
        localDate: '2026-08-30',
        previousBriefDate: '2026-08-29',
      })
  })

  it('orders Entries by their frozen position while preserving text and nullable summaries', async () => {
    const readTodayBrief = createTodayBriefReader(async () => [
      {
        admitted_by: 'convergence',
        brief_id: '00000000-0000-4000-8000-000000000760',
        entry_signal_id: '00000000-0000-4000-8000-000000000762',
        is_bookmarked: false,
        is_read: true,
        local_date: '2026-08-30',
        origin_url: 'https://wire.example/story',
        position: 2,
        previous_brief_date: '2026-08-29',
        signal_id: '00000000-0000-4000-8000-000000000762',
        summary: null,
        title: 'Wire story from a Citation anchor',
        why_text: '3 Publishers converged · Alpha, Beta, Gamma · origin: wire.example · no Interest matched — surfacing on convergence alone',
      },
      {
        admitted_by: 'interest',
        brief_id: '00000000-0000-4000-8000-000000000760',
        entry_signal_id: '00000000-0000-4000-8000-000000000761',
        is_bookmarked: true,
        is_read: false,
        local_date: '2026-08-30',
        origin_url: 'https://database.example/story',
        position: 1,
        previous_brief_date: '2026-08-29',
        signal_id: '00000000-0000-4000-8000-000000000761',
        summary: 'A stored plain-text Item summary.',
        title: 'Database story',
        why_text: '2 Publishers converged · Delta, Epsilon · origin: database.example · matched: "Database internals"',
      },
    ])

    const brief = await readTodayBrief(USER_ID, new Date('2026-08-30T08:00:00.000Z'))

    expect(brief.entries.map(entry => ({
      admittedBy: entry.admittedBy,
      entryId: entry.entryId,
      isBookmarked: entry.isBookmarked,
      isRead: entry.isRead,
      position: entry.position,
      signalId: entry.signalId,
      summary: entry.summary,
      whyText: entry.whyText,
    }))).toEqual([
      {
        admittedBy: 'interest',
        entryId: '00000000-0000-4000-8000-000000000761',
        isBookmarked: true,
        isRead: false,
        position: 1,
        signalId: '00000000-0000-4000-8000-000000000761',
        summary: 'A stored plain-text Item summary.',
        whyText: '2 Publishers converged · Delta, Epsilon · origin: database.example · matched: "Database internals"',
      },
      {
        admittedBy: 'convergence',
        entryId: '00000000-0000-4000-8000-000000000762',
        isBookmarked: false,
        isRead: true,
        position: 2,
        signalId: '00000000-0000-4000-8000-000000000762',
        summary: null,
        whyText: '3 Publishers converged · Alpha, Beta, Gamma · origin: wire.example · no Interest matched — surfacing on convergence alone',
      },
    ])
  })

  it('distinguishes an uncut day from a cut empty Brief', async () => {
    const readTodayBrief = createTodayBriefReader(async () => [{
      admitted_by: null,
      brief_id: null,
      entry_signal_id: null,
      is_bookmarked: null,
      is_read: null,
      local_date: '2026-08-30',
      origin_url: null,
      position: null,
      previous_brief_date: '2026-08-29',
      signal_id: null,
      summary: null,
      title: null,
      why_text: null,
    }])

    await expect(readTodayBrief(USER_ID, new Date('2026-08-30T00:00:00.000Z')))
      .resolves
      .toMatchObject({ entries: [], hasBrief: false })
  })

  it('keeps frozen Entries distinct when later merges resolve them to one Signal root', async () => {
    const resolvedSignalId = '00000000-0000-4000-8000-000000000799'
    const row = {
      admitted_by: 'interest',
      brief_id: '00000000-0000-4000-8000-000000000760',
      is_bookmarked: false,
      is_read: false,
      local_date: '2026-08-30',
      origin_url: 'https://database.example/story',
      previous_brief_date: '2026-08-29',
      signal_id: resolvedSignalId,
      summary: 'The current root summary.',
      title: 'The current root title',
    }
    const readTodayBrief = createTodayBriefReader(async () => [
      {
        ...row,
        entry_signal_id: '00000000-0000-4000-8000-000000000761',
        position: 1,
        why_text: 'The first frozen explanation.',
      },
      {
        ...row,
        admitted_by: 'convergence',
        entry_signal_id: '00000000-0000-4000-8000-000000000762',
        position: 2,
        why_text: 'The second frozen explanation.',
      },
    ])

    const brief = await readTodayBrief(USER_ID, new Date('2026-08-30T08:00:00.000Z'))

    expect(brief.entries).toHaveLength(2)
    expect(brief.entries.map(entry => entry.entryId)).toEqual([
      '00000000-0000-4000-8000-000000000761',
      '00000000-0000-4000-8000-000000000762',
    ])
    expect(brief.entries.map(entry => entry.signalId)).toEqual([
      resolvedSignalId,
      resolvedSignalId,
    ])
  })

  it('fails explicitly when a persisted Entry cannot resolve to a Signal root', async () => {
    const readTodayBrief = createTodayBriefReader(async () => [{
      admitted_by: 'interest',
      brief_id: '00000000-0000-4000-8000-000000000760',
      entry_signal_id: '00000000-0000-4000-8000-000000000761',
      is_bookmarked: null,
      is_read: null,
      local_date: '2026-08-30',
      origin_url: null,
      position: 1,
      previous_brief_date: '2026-08-29',
      signal_id: null,
      summary: null,
      title: null,
      why_text: 'A frozen explanation whose Signal graph is corrupt.',
    }])

    await expect(readTodayBrief(USER_ID, new Date('2026-08-30T08:00:00.000Z')))
      .rejects
      .toThrow('could not resolve its Signal root')
  })
})
