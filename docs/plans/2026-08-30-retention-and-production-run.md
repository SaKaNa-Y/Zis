# Retention Tiering and Production Run Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the day-one retention tier, run pruning as the final pipeline stage, and produce auditable evidence for the first manual production Brief without adding scheduling or sealing.

**Architecture:** Keep `runIngestion()` as the only behavioral seam. Feed normalization persists bounded plain Item text separately from the permanent summary; the seam clears expired text, fetch logs, and robots verdicts after cut/order, while the Neon adapter performs the corresponding SQL mutation in one final prune transaction. The existing `workflow_dispatch` runner remains the single production entry point and records elapsed time plus the resulting Brief facts.

**Tech Stack:** TypeScript 5.9, Vitest 4, Drizzle ORM/PostgreSQL, Neon serverless, GitHub Actions, Next.js 16.

---

### Task 1: Persist bounded full Item text

**Files:**
- Modify: `src/lib/db/schema.test.ts`
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/ingestion/pipeline.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`
- Modify: `src/lib/ingestion/postgres.ts`
- Create: `drizzle/0008_retention_and_production_corpus.sql`
- Create: `drizzle/meta/0008_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Step 1: Write the failing schema test**

Assert that `item.text` exists, is nullable, is bounded to 1,200 characters, and is introduced by migration `0008_retention_and_production_corpus` without a sealing column. Assert that the same production migration idempotently registers all 67 RSS/Atom Sources in `docs/source-register.json`, their Publisher ownership hosts, and the seven settled Aggregator flags; no private Interest is seeded.

**Step 2: Run the schema test to verify red**

Run: `pnpm test -- src/lib/db/schema.test.ts`

Expected: FAIL because `item.text` and migration `0008` do not exist.

**Step 3: Write the failing ingestion tracer bullet**

Through `runIngestion()`, ingest an Item whose summary and content differ. Assert that the permanent summary uses the feed summary, `text` uses the extracted body, both are plain text and bounded, and the Signal's `own` embedding input prefers `title + text`.

**Step 4: Run the seam test to verify red**

Run: `pnpm test -- src/lib/ingestion/pipeline.test.ts`

Expected: FAIL because persisted Items have no `text` property.

**Step 5: Implement the minimum field flow**

Add nullable `text` to `PersistedItem` and the Drizzle schema. Extract summary and body independently from RSS/Atom fields, strip publisher markup, cap both storage fields at 1,200 characters, persist `text` in Source transactions, and use `text ?? summary` for an `own` Text Basis.

**Step 6: Generate and review the migration**

Run with a non-production placeholder URL: `pnpm db:generate -- --name retention_and_production_corpus`

Expected: migration `0008` adds the nullable text column and its length check, best-effort backfills recent legacy text from the only retained plain-text source, and idempotently registers the settled RSS/Atom corpus. No private Interest, scheduler, or sealing state appears.

**Step 7: Run focused checks**

Run: `pnpm test -- src/lib/db/schema.test.ts src/lib/ingestion/pipeline.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

### Task 2: Make prune the final stage through the single seam

**Files:**
- Modify: `src/lib/ingestion/pipeline.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

**Step 1: Write the failing retention tracer bullet**

Seed `runIngestion()` with Items, `source_fetch_log` rows, and `robots_cache` rows on both sides of their boundaries. Assert that after the full seam returns:

- Item text older than 30 days is null while title, URL, summary, and Signal embedding remain;
- recent Item text remains;
- fetch logs older than 30 days are absent while recent logs remain;
- expired robots verdicts are absent while unexpired verdicts remain;
- Brief cut/order has already completed and no sealing state exists.

**Step 2: Run the named seam test to verify red**

Run: `pnpm test -- src/lib/ingestion/pipeline.test.ts -t "prunes expiring state after cut and order"`

Expected: FAIL because the graph is not pruned.

**Step 3: Implement the minimum final-stage mutation**

Add one private `pruneRetainedState(graph, at)` call after `cutDueBriefs()`. Use a fixed 30-day duration based on stable `createdAt` for Item text (a repeated 200 must not extend retention) and `startedAt` for fetch logs; use each robots record's `expiresAt` for verdict expiry. Do not export a prune seam.

**Step 4: Run focused seam tests and typecheck**

Run: `pnpm test -- src/lib/ingestion/pipeline.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

### Task 3: Persist production pruning atomically

**Files:**
- Modify: `src/lib/ingestion/postgres.test.ts`
- Modify: `src/lib/ingestion/postgres.ts`

**Step 1: Write the failing Neon adapter test**

Invoke `runNeonIngestion()` through its existing public entry point and assert its last database transaction contains exactly the retention mutations: null old `item.text`, delete old `source_fetch_log`, and delete expired `robots_cache`. Assert the transaction happens after final Signal/Match/Brief persistence.

**Step 2: Run the adapter test to verify red**

Run: `pnpm test -- src/lib/ingestion/postgres.test.ts -t "persists prune as the last daily stage"`

Expected: FAIL because no prune transaction is emitted.

**Step 3: Implement the final Neon transaction**

Compile the three Drizzle statements against the wake timestamp and commit them only after `commitFinalGraph()`. Keep Source transaction boundaries unchanged and do not load historical fetch logs into memory.

**Step 4: Run focused checks**

Run: `pnpm test -- src/lib/ingestion/postgres.test.ts src/lib/ingestion/pipeline.test.ts src/lib/db/schema.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

### Task 4: Make the manual production run self-auditing

**Files:**
- Modify: `scripts/pipeline/run.ts`
- Modify: `tests/repo-invariants.test.ts`
- Modify: `.github/workflows/ingest.yml`

**Step 1: Write failing repository-shape assertions**

Assert that the workflow still has only `workflow_dispatch`, still invokes the one runner, and the runner reports total elapsed milliseconds against the 120,000 ms budget. Keep the repository-wide no-`schedule` and no-migration assertions.

**Step 2: Run the invariant test to verify red**

Run: `pnpm test -- tests/repo-invariants.test.ts`

Expected: FAIL because the runner does not yet report the run budget.

**Step 3: Add production observability**

Measure from immediately before the first Neon query through completed prune, print the stage order and total duration, and emit an Actions warning when duration exceeds 120,000 ms. Keep model-cache preparation before the timed Neon wake.

**Step 4: Run focused checks**

Run: `pnpm test -- tests/repo-invariants.test.ts`

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: PASS.

### Task 5: Verify, review, and commit the implementation

**Files:**
- Review all files changed since `aac6ab5`

**Step 1: Run the complete local gate once**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm check:no-px`

Run: `pnpm check:env`

Run: `pnpm test`

Run: `pnpm build`

Expected: every command passes.

**Step 2: Check migration drift**

Run `pnpm db:generate` with a non-production placeholder `DATABASE_URL` and verify that no additional migration is produced.

**Step 3: Run the required two-axis review**

Review `git diff aac6ab5...HEAD` (or the equivalent committed issue diff) in parallel for repository standards and issue #78 compliance. Fix every substantive finding and repeat proportionate checks; repeat the full gate if production code changes.

**Step 4: Commit**

Commit the verified English implementation on the current branch with: `feat: add retention tiering and production pipeline proof (#78)`.

### Task 6: Exercise the production chain and record the first Brief

**Files:**
- Create after the successful run: `docs/operations/2026-08-30-first-production-brief.md`

**Step 1: Confirm external prerequisites without exposing values**

Confirm a linked Vercel production project, production-scoped `DATABASE_URL` and `SESSION_SECRET`, a GitHub Actions `DATABASE_URL`, the reader row and Interest Profile, and a production Neon snapshot capability. Keep the repository private. The versioned migration owns the public Source register; the private Interest Profile remains an operator-provided prerequisite.

**Step 2: Prove Stage 0 fails the run**

After snapshotting production, deliberately break one host-ownership relation, dispatch `ingest.yml`, record the failed Actions run URL and assertion message, then restore the exact relation before any successful ingest.

**Step 3: Apply migration `0008` manually**

Run the production migration only after the manual Neon snapshot. Never add migration execution to Vercel or Actions.

**Step 4: Dispatch the restored full chain**

Run `ingest.yml` once with `workflow_dispatch`. Record its run URL, conclusion, elapsed pipeline time, and any over-budget warning or reason.

**Step 5: Verify the authenticated production Today surface**

Open the production Today route behind auth and verify it reads the Brief produced by that run. Record no credentials or Interest statements beyond the acceptance note's permitted observation.

**Step 6: Write the English production note**

Record the Brief entry count, interest/convergence route split, and any why-text that names an Interest the reader would not have written. Include the failed and successful run URLs, production deployment URL, commit SHA, migration tag, and elapsed time. State explicitly that the repository remained private, no `schedule` trigger exists, and nothing is sealed.

**Step 7: Re-run CI status checks**

Confirm the committed SHA's CI run is green and retain the note as slice 2's re-replay input.
