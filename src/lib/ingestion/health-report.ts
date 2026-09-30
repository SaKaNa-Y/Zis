import type { FetchOutcome, IngestionSource, SourceFetchLog } from './pipeline'
import { ROBOTS_AUTO_DISABLED_REASON } from './pipeline'

export interface IngestionHealthInput {
  wake: {
    startedAt: Date
    finishedAt: Date
    status: 'completed' | 'failed'
    elapsedMs: number
    attempts?: number
  }
  /** The full Source inventory, including disabled Sources; null if unavailable. */
  sources: readonly IngestionSource[] | null
  fetchLogs: readonly SourceFetchLog[]
  /** Confirmation concerns persistence, not the number of Brief Entries. */
  briefStatus?: 'confirmed' | 'missing' | 'not_due' | 'unverified'
  metrics?: {
    decodedReadBytes?: number
    compiledWriteBytes?: number
    committedStatements?: number
    affectedRows?: number
  }
  budgetMs?: number
}

export interface IngestionHealthReport {
  summaryMarkdown: string
  /** Ready-to-print GitHub Actions commands, without trailing line breaks. */
  annotations: string[]
  hasErrors: boolean
}

function annotation(level: 'warning' | 'error', title: string, message: string): string {
  // Escape data before emitting workflow commands; never interpolate raw errors.
  const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
  return `::${level} title=${title}::${escaped}`
}

function markdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
}

function timestamp(value: Date): string {
  return Number.isFinite(value.getTime()) ? value.toISOString() : 'unknown'
}

function count(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? String(value) : 'unknown'
}

function hostname(source: IngestionSource): string {
  try {
    // Credentials, paths and query strings have no place in an Actions report.
    return new URL(source.endpointUrl).hostname || 'unavailable'
  }
  catch {
    return 'unavailable'
  }
}

function failed(outcome: FetchOutcome): boolean {
  return outcome !== 'ok' && outcome !== 'not_modified'
}

function sourceStatus(source: IngestionSource, log: SourceFetchLog | undefined): { text: string, warning: boolean } {
  if (source.disabledAt !== null) {
    const robots = source.disabledReason === ROBOTS_AUTO_DISABLED_REASON || log?.outcome === 'robots_denied'
    return {
      text: robots ? 'disabled; awaiting robots recovery' : 'disabled; manual review required',
      warning: true,
    }
  }
  if (log && failed(log.outcome)) {
    return { text: `fetch failed: ${log.outcome} (HTTP ${count(log.httpStatus ?? undefined)})`, warning: true }
  }
  if (source.consecutiveFailures > 0) {
    return { text: `retry pending; ${count(source.consecutiveFailures)} consecutive failures`, warning: true }
  }
  return { text: log?.outcome ?? 'not polled this wake', warning: false }
}

/** Pure, counts-only reporting: no query parameters, reader data or error text. */
export function buildIngestionHealthReport(input: IngestionHealthInput): IngestionHealthReport {
  const annotations: string[] = []
  const lines = [
    '## Ingestion health',
    '',
    `Wake: **${input.wake.status}**. Started ${timestamp(input.wake.startedAt)}; finished ${timestamp(input.wake.finishedAt)}.`,
    `Elapsed: ${count(input.wake.elapsedMs)} ms; budget: ${count(input.budgetMs ?? 120_000)} ms; attempts: ${count(input.wake.attempts ?? 1)}.`,
  ]
  let hasErrors = false
  if (input.wake.status === 'failed') {
    hasErrors = true
    annotations.push(annotation('error', 'Ingestion incomplete', 'Ingestion terminated before completion. Some Source transactions may have committed; a successful daily Brief is not established by this run.'))
  }
  if (input.wake.elapsedMs > (input.budgetMs ?? 120_000)) {
    annotations.push(annotation('warning', 'Neon wake budget exceeded', `Wake lasted ${count(input.wake.elapsedMs)} ms; budget is ${count(input.budgetMs ?? 120_000)} ms.`))
  }

  const briefStatus = input.briefStatus ?? 'unverified'
  lines.push(`Daily Brief: **${briefStatus}**. An empty persisted Brief is valid.`)
  if (briefStatus === 'missing') {
    hasErrors = true
    annotations.push(annotation('error', 'Daily Brief missing', 'The expected daily Brief is missing. Workflow completion does not establish successful daily delivery.'))
  }
  else if (briefStatus === 'unverified') {
    annotations.push(annotation('warning', 'Daily Brief unverified', 'Daily Brief persistence could not be confirmed. Do not infer delivery from the workflow status.'))
  }

  const latest = new Map<string, SourceFetchLog>()
  for (const log of input.fetchLogs) {
    if (log.startedAt < input.wake.startedAt || log.startedAt > input.wake.finishedAt)
      continue
    const previous = latest.get(log.sourceId)
    if (!previous || log.startedAt > previous.startedAt || (log.startedAt.getTime() === previous.startedAt.getTime() && log.id > previous.id))
      latest.set(log.sourceId, log)
  }

  lines.push('', '### Source inventory', '')
  if (input.sources === null) {
    lines.push('Source inventory unavailable. Source health is unknown.')
    annotations.push(annotation('warning', 'Source inventory unavailable', 'The full Source inventory could not be read, so Source health is unknown.'))
  }
  else {
    const rows = input.sources.map((source) => {
      const log = latest.get(source.id)
      return { source, log, host: hostname(source), status: sourceStatus(source, log) }
    })
    const disabled = rows.filter(row => row.source.disabledAt !== null).length
    const warnings = rows.filter(row => row.status.warning).length
    const confirmed = rows.filter(row => !row.status.warning && row.log && !failed(row.log.outcome)).length
    lines.push(`${rows.length} configured Sources; ${disabled} disabled; ${warnings} require attention; ${confirmed} confirmed successful this wake; ${rows.filter(row => !row.log).length} without a current outcome.`)
    if (input.wake.status === 'failed')
      lines.push('This interrupted wake may have only partial Source outcomes.')
    if (rows.length === 0) {
      annotations.push(annotation('warning', 'No configured Sources', 'The Source inventory is empty; no supply is configured.'))
    }
    else {
      lines.push('', '| Source | Transport | Host | State | Current outcome |', '| --- | --- | --- | --- | --- |')
      for (const row of rows) {
        lines.push(`| ${markdown(row.source.id)} | ${markdown(row.source.transport)} | ${markdown(row.host)} | ${markdown(row.status.text)} | ${row.log?.outcome ?? 'none'} |`)
        if (row.status.warning) {
          annotations.push(annotation('warning', 'Source needs attention', `Source ${row.source.id} (${row.source.transport}, ${row.host}): ${row.status.text}.`))
        }
      }
    }
  }

  if (input.metrics) {
    lines.push(
      '',
      '### Run measurements',
      '',
      `Decoded read JSON: ${count(input.metrics.decodedReadBytes)} bytes; compiled write JSON: ${count(input.metrics.compiledWriteBytes)} bytes. These are not billed network transfer.`,
      `Committed SQL statements: ${count(input.metrics.committedStatements)}; affected rows: ${count(input.metrics.affectedRows)}.`,
    )
  }
  return { summaryMarkdown: `${lines.join('\n')}\n`, annotations, hasErrors }
}
