import type { IngestionHealthInput } from './health-report'
import type { IngestionSource, SourceFetchLog } from './pipeline'
import type { Database } from '@/lib/db'
import { and, eq, gte, or } from 'drizzle-orm'
import { briefs, sourceFetchLogs, sources, users } from '@/lib/db/schema'

export interface IngestionHealthSnapshot {
  sources: IngestionSource[]
  fetchLogs: SourceFetchLog[]
  briefStatus: NonNullable<IngestionHealthInput['briefStatus']>
}

interface ReaderClock {
  id: string
  timezone: string
  cutHour: number
}

function dueBrief(reader: ReaderClock, at: Date): { userId: string, localDate: string } | null {
  if (!Number.isInteger(reader.cutHour) || reader.cutHour < 0 || reader.cutHour > 23 || !reader.timezone.trim())
    throw new Error('Invalid reader clock for ingestion health snapshot')
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: reader.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at)
  }
  catch {
    // Neither the reader identity nor their configuration belongs in logs.
    throw new Error('Invalid reader clock for ingestion health snapshot')
  }
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find(part => part.type === type)?.value
    if (value === undefined)
      throw new Error('Incomplete reader clock for ingestion health snapshot')
    return value
  }
  if (Number(part('hour')) < reader.cutHour)
    return null
  return { userId: reader.id, localDate: `${part('year')}-${part('month')}-${part('day')}` }
}

/** Read only operational state, using the same start-time cut reference as ingestion. */
export async function readIngestionHealthSnapshot(database: Pick<Database, 'select'>, wakeAt: Date): Promise<IngestionHealthSnapshot> {
  const [sourceRows, logRows, readerRows] = await Promise.all([
    // Disabled Sources are deliberately included even when no fetch was attempted.
    database.select().from(sources),
    database.select({
      id: sourceFetchLogs.id,
      sourceId: sourceFetchLogs.sourceId,
      startedAt: sourceFetchLogs.startedAt,
      durationMs: sourceFetchLogs.durationMs,
      outcome: sourceFetchLogs.outcome,
      httpStatus: sourceFetchLogs.httpStatus,
      itemsSeen: sourceFetchLogs.itemsSeen,
      itemsNew: sourceFetchLogs.itemsNew,
      bytes: sourceFetchLogs.bytes,
    }).from(sourceFetchLogs).where(gte(sourceFetchLogs.startedAt, wakeAt)),
    database.select({ id: users.id, timezone: users.timezone, cutHour: users.cutHour }).from(users),
  ])
  const snapshot: IngestionHealthSnapshot = {
    sources: sourceRows,
    // Fetch error text can contain remote responses or request details; do not read it.
    fetchLogs: logRows.map(row => ({ ...row, errorMessage: null })),
    briefStatus: 'unverified',
  }
  if (readerRows.length === 0)
    return snapshot

  const due = readerRows.map(reader => dueBrief(reader, wakeAt)).filter(reader => reader !== null)
  if (due.length === 0)
    return { ...snapshot, briefStatus: 'not_due' }

  // Only exact reader/date keys are needed; no Brief Entries or historical graph.
  const persisted = await database.select({ userId: briefs.userId, localDate: briefs.localDate })
    .from(briefs)
    .where(or(...due.map(reader => and(eq(briefs.userId, reader.userId), eq(briefs.localDate, reader.localDate)))))
  const keys = new Set(persisted.map(brief => `${brief.userId}/${brief.localDate}`))
  return {
    ...snapshot,
    briefStatus: due.every(reader => keys.has(`${reader.userId}/${reader.localDate}`)) ? 'confirmed' : 'missing',
  }
}
