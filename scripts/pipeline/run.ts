/**
 * The pipeline the Actions runner executes, under `tsx`, with the app's own
 * `tsconfig`.
 *
 * It imports the shared modules from `src/lib/` **directly** through the `@/`
 * alias. A copy of `safeFetch` in a standalone script would be a second egress
 * that the lint rule never sees, and `security-model.md` §1's claim that
 * `safeFetch` is the only way out would quietly be false
 * (docs/repo-and-ci.md §6). `--dry-run` resolves the seam and exits, which is
 * what the repo-invariant test exercises.
 */

import type { IngestionHealthInput } from '@/lib/ingestion/health-report'
import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { db } from '@/lib/db'
import {
  createTransformersEmbeddingProvider,
  prepareTransformersModelCache,
} from '@/lib/embeddings/transformers'
import * as env from '@/lib/env'
import { buildIngestionHealthReport } from '@/lib/ingestion/health-report'
import { readIngestionHealthSnapshot } from '@/lib/ingestion/health-snapshot'
import { runNeonIngestion } from '@/lib/ingestion/postgres'
import { safeFetch } from '@/lib/safe-fetch'

const NEON_WAKE_BUDGET_MS = 120_000
const PIPELINE_STAGE_ORDER = [
  'stage 0 assertion',
  'select due',
  'fetch',
  'normalize',
  'hydrate',
  'canonicalize',
  'citation-worthiness',
  'alias merge',
  'strength',
  'embed',
  'match',
  'admission',
  'cut',
  'order',
  'prune',
] as const

async function main(argv: string[]): Promise<void> {
  if (argv.includes('--dry-run')) {
    process.stdout.write('zis pipeline: shared modules resolve; RSS ingestion is ready\n')
    return
  }

  let wakeAt = new Date()
  let neonWakeStartedAt: number | undefined
  let database: ReturnType<typeof db> | undefined
  let status: 'completed' | 'failed' = 'failed'
  let metrics: IngestionHealthInput['metrics']
  let databaseRetries = 0
  const stageTimings = new Map<string, number>()
  let phase = 'DATABASE_URL configuration'
  process.stdout.write(
    `zis pipeline stage order: ${PIPELINE_STAGE_ORDER.join(' -> ')}\n`,
  )
  try {
    // Fail before the first query, so missing credentials never partially run.
    env.databaseUrl()
    phase = 'GITHUB_PAT configuration'
    const githubToken = env.githubPat()
    // A cold model download must finish before Neon wakes (ADR-0008).
    phase = 'embedding model preparation'
    await prepareTransformersModelCache(safeFetch)
    phase = 'database ingestion'
    database = db()
    const provider = createTransformersEmbeddingProvider({ fetcher: safeFetch })
    const embeddingProvider = {
      ...provider,
      embed: async (texts: readonly string[]) => {
        const started = performance.now()
        const result = await provider.embed(texts)
        const elapsed = Math.round(performance.now() - started)
        stageTimings.set('model_embedding (within graph_compute)', (stageTimings.get('model_embedding (within graph_compute)') ?? 0) + elapsed)
        process.stdout.write(`zis pipeline model embedding: ${texts.length} inputs; ${elapsed} ms\n`)
        return result
      },
    }
    wakeAt = new Date()
    neonWakeStartedAt = Date.now()
    const graph = await runNeonIngestion(
      wakeAt,
      database,
      safeFetch,
      embeddingProvider,
      (readMetrics) => {
        metrics = {
          decodedReadBytes: readMetrics.initialGraphJsonBytes + readMetrics.scopedGraphJsonBytes + readMetrics.signalVectorJsonBytes,
          compiledWriteBytes: readMetrics.compiledWriteBytes,
          committedStatements: readMetrics.committedStatements,
          affectedRows: readMetrics.affectedRows,
        }
        // Counts only: never log reader statements, vectors, or query parameters.
        // Decoded graph JSON is a planning measure, not Neon's billed egress.
        process.stdout.write(`zis pipeline decoded read payload: ${metrics.decodedReadBytes} JSON bytes; stored Signal vectors read: ${readMetrics.signalVectorsRead}; matches recomputed: ${readMetrics.matchesRecomputed}; reused in loaded scope: ${readMetrics.matchesReused} (not billed network transfer)\n`)
        if (readMetrics.affectedRows !== undefined) {
          process.stdout.write(`zis pipeline committed SQL statements: ${readMetrics.committedStatements}; affected rows: ${readMetrics.affectedRows}; compiled write JSON: ${readMetrics.compiledWriteBytes} bytes; WebSocket commits: ${readMetrics.websocketCommits}\n`)
        }
      },
      githubToken,
      {
        onStageTiming: ({ stage, durationMs }) => {
          const elapsed = Math.round(durationMs)
          stageTimings.set(stage, (stageTimings.get(stage) ?? 0) + elapsed)
          process.stdout.write(`zis pipeline stage ${stage}: ${elapsed} ms\n`)
        },
        onDatabaseRetry: (event) => {
          databaseRetries++
          process.stdout.write(`::warning title=Retrying ingestion database transaction::${event.operation} transaction encountered ${event.reason}; retry attempt ${event.attempt}/3 after ${event.delayMs} ms.\n`)
        },
      },
    )
    const neonWakeElapsedMs = Date.now() - neonWakeStartedAt
    process.stdout.write(
      `zis pipeline Neon wake through prune: ${neonWakeElapsedMs} ms (budget ${NEON_WAKE_BUDGET_MS} ms)\n`,
    )
    process.stdout.write(
      `zis pipeline: ${graph.sources.length} Source(s), ${graph.fetchLogs.length} outcome(s), ${graph.corpusCounts?.items ?? graph.items.length} persisted Item(s)\n`,
    )
    process.stdout.write('zis API windows: complete returned HN lists; newest 100 Bluesky feed rows and GitHub releases per Source; no historical backfill\n')
    for (const log of graph.fetchLogs.filter(log => log.startedAt >= wakeAt && log.outcome !== 'ok' && log.outcome !== 'not_modified')) {
      process.stdout.write(`zis Source ${log.sourceId}: ${log.outcome} (HTTP ${log.httpStatus ?? 'none'})\n`)
    }
    for (const sourceId of graph.dormantSourceIds) {
      process.stdout.write(
        `::warning title=Dormant Source::Source ${sourceId} has published no new Item in six months; review it manually.\n`,
      )
    }
    status = 'completed'
  }
  catch {
    // Driver errors may contain SQL parameters or reader data. The report and
    // retry annotations provide the operational outcome without exposing them.
    process.stderr.write(`zis pipeline: failed during ${phase}; inspect the health summary and retry annotations.\n`)
    process.exitCode = 1
  }

  let snapshot: Pick<IngestionHealthInput, 'sources' | 'fetchLogs' | 'briefStatus'> = {
    sources: null,
    fetchLogs: [],
    briefStatus: 'unverified',
  }
  if (database !== undefined) {
    try {
      snapshot = await readIngestionHealthSnapshot(database, wakeAt)
    }
    catch {
      // A failed diagnostic query must not hide the ingestion failure or claim
      // a healthy empty inventory. The report marks persistence as unverified.
    }
  }
  const report = buildIngestionHealthReport({
    wake: { startedAt: wakeAt, finishedAt: new Date(), status, elapsedMs: neonWakeStartedAt === undefined ? 0 : Date.now() - neonWakeStartedAt },
    ...snapshot,
    metrics,
    budgetMs: NEON_WAKE_BUDGET_MS,
  })
  if (report.annotations.length > 0)
    process.stdout.write(`${report.annotations.join('\n')}\n`)
  process.stdout.write(`zis pipeline database transaction retries: ${databaseRetries}\n`)
  const timingSummary = stageTimings.size === 0
    ? ''
    : [
        '\n### Stage timings\n',
        '| Stage | Duration (ms) |',
        '| --- | ---: |',
        ...[...stageTimings].map(([stage, durationMs]) => `| ${stage} | ${durationMs} |`),
        '',
      ].join('\n')
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    await appendFile(summaryPath, `${report.summaryMarkdown}\nDatabase transaction retries: ${databaseRetries}.\n${timingSummary}`)
  }
  else {
    process.stdout.write(`${report.summaryMarkdown}${timingSummary}`)
  }
  if (report.hasErrors)
    process.exitCode = 1
}

void main(process.argv.slice(2)).catch(() => {
  process.stderr.write('::error title=Ingestion reporting failed::The ingestion health report could not be completed. Inspect the preceding sanitized pipeline output.\n')
  process.exitCode = 1
})
