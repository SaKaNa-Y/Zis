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

import process from 'node:process'
import { db } from '@/lib/db'
import {
  createTransformersEmbeddingProvider,
  prepareTransformersModelCache,
} from '@/lib/embeddings/transformers'
import * as env from '@/lib/env'
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

  // Fail before the first query, so a missing secret never partially runs.
  env.databaseUrl()
  // A cold model download must finish before Neon wakes (ADR-0008).
  await prepareTransformersModelCache(safeFetch)

  const database = db()
  const embeddingProvider = createTransformersEmbeddingProvider({ fetcher: safeFetch })
  const wakeAt = new Date()
  process.stdout.write(
    `zis pipeline stage order: ${PIPELINE_STAGE_ORDER.join(' -> ')}\n`,
  )

  const neonWakeStartedAt = Date.now()
  const graph = await runNeonIngestion(
    wakeAt,
    database,
    safeFetch,
    embeddingProvider,
  )
  const neonWakeElapsedMs = Date.now() - neonWakeStartedAt

  process.stdout.write(
    `zis pipeline Neon wake through prune: ${neonWakeElapsedMs} ms (budget ${NEON_WAKE_BUDGET_MS} ms)\n`,
  )
  if (neonWakeElapsedMs > NEON_WAKE_BUDGET_MS) {
    process.stdout.write(
      `::warning title=Neon wake budget exceeded::Pipeline took ${neonWakeElapsedMs} ms from the first Neon query through completed prune; budget is ${NEON_WAKE_BUDGET_MS} ms.\n`,
    )
  }

  process.stdout.write(
    `zis pipeline: ${graph.sources.length} Source(s), ${graph.fetchLogs.length} outcome(s), ${graph.items.length} persisted Item(s)\n`,
  )
  for (const sourceId of graph.dormantSourceIds) {
    process.stdout.write(
      `::warning title=Dormant Source::Source ${sourceId} has published no new Item in six months; review it manually.\n`,
    )
  }
}

void main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
