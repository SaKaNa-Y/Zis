# RSS Ingestion Seam Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @tdd to implement this plan task-by-task.

**Goal:** Build issue #69's single ingestion seam so RSS/Atom Sources pass through robots-gated `safeFetch` into idempotently persisted Items, with the required operational state, schema, and manual Actions entry point.

**Architecture:** `runIngestion` is the only behavioral test seam: Sources and a canned `safeFetch` response set enter, and a persisted graph leaves. Fetching, XML parsing, normalization, failure state, host-aware concurrency, and commits remain internal; production uses the same orchestration with a Drizzle/Neon persistence adapter and the real `safeFetch`. Publisher host ownership is normalized into a `publisher_host` relation whose primary key enforces one Publisher per host while retaining one `publisher` row per owning voice.

**Tech Stack:** TypeScript 5.9, Vitest 4, Drizzle ORM/PostgreSQL, Neon HTTP transactions, `saxes`, GitHub Actions.

---

### Task 1: Define the ingestion schema and migration

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0000_rss_ingestion.sql`
- Create: `drizzle/meta/0000_snapshot.json`
- Create: `drizzle/meta/_journal.json`
- Test: `src/lib/db/schema.test.ts`

1. Write a failing schema test that inspects Drizzle table metadata and generated SQL for `publisher`, unique `publisher_host.host`, `source`, `source_fetch_log`, `http_cache`, `robots_cache`, and `item`; assert that `source` has neither cadence nor HTTP-validator columns and that `http_cache` has no body column.
2. Run `pnpm vitest run src/lib/db/schema.test.ts` and confirm it fails against the empty schema.
3. Define the PostgreSQL enums, tables, foreign keys, unique constraints, and indexes. Store the raw feed date separately from clamped `published_at`; make `(source_id, external_id)` unique.
4. Run `DATABASE_URL=... pnpm db:generate` with a non-production placeholder URL to generate the migration, then add the initial Simon Willison Publisher/host/RSS Source seed from `docs/source-register.json`.
5. Run the schema test and `pnpm typecheck` until green.

### Task 2: Parse hostile RSS/Atom safely

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/ingestion/feed.ts`
- Test: `src/lib/ingestion/pipeline.test.ts`

1. Add a seam-level failing test where one RSS Source receives an allowed robots response and a valid feed and produces a normalized persisted Item.
2. Add failing seam cases for Atom, a feed over the byte cap, a DTD/XXE payload, and a billion-laughs payload.
3. Run only the named test after each case and confirm red.
4. Add `saxes`; reject the byte count and any DTD before constructing the parser, rely on its non-validating/no-DTD-entity model, and collect RSS/Atom fields as plain text.
5. Normalize the external key as GUID/Atom id, then canonical Item URL, then SHA-256 of title plus link. Preserve the raw date and clamp `published_at` to `fetched_at`; never filter or trust source ordering.
6. Run the focused test file and `pnpm typecheck` until green.

### Task 3: Persist success, edits, validators, and 304s

**Files:**
- Create: `src/lib/ingestion/pipeline.ts`
- Test: `src/lib/ingestion/pipeline.test.ts`

1. Add a failing vertical slice proving an initial feed persists one Item and an edited rerun updates title/summary in place without changing its id.
2. Add a failing slice proving missing GUID falls back to canonical URL and then `hash(title + link)`.
3. Add a failing slice proving validators are sent to the byte-identical Source URL and a 304 logs `not_modified`, resets failures, skips parsing, and leaves `newest_item_at` untouched.
4. Implement an in-memory transactional graph behind the one seam, conditional headers from the validator-only cache, upserts on the natural key, and one fetch-log row for every outcome.
5. Run the focused test after every red/green cycle.

### Task 4: Persist failure, origin deferral, dormancy, and concurrency behavior

**Files:**
- Modify: `src/lib/ingestion/pipeline.ts`
- Test: `src/lib/ingestion/pipeline.test.ts`

1. Add failing seam cases for robots denial, HTTP/timeout/too-large/parse failures, exponential backoff, and automatic disablement on failure 10.
2. Add failing cases for numeric/date `Retry-After` and seconds-valued `x-poll-interval`, choosing the later applicable deferral.
3. Add a failing case proving a Source whose newest Item is older than six months is returned as requiring review but stays enabled, including after a 304.
4. Add a failing canned-transport case that refuses overlapping requests to one host and refuses more than six simultaneous hosts.
5. Implement the failure ladder, origin deferral parsing, dormant review projection, per-host queues, and a six-worker global cap.
6. Run the focused suite and `pnpm typecheck` until green.

### Task 5: Connect the seam to Neon and Actions

**Files:**
- Create: `src/lib/ingestion/postgres.ts`
- Modify: `scripts/pipeline/run.ts`
- Create: `.github/workflows/ingest.yml`
- Modify: `tests/repo-invariants.test.ts`
- Test: `src/lib/ingestion/postgres.test.ts`

1. Add failing tests for the Drizzle adapter's per-Source batch boundary and the workflow's `workflow_dispatch`-only trigger.
2. Implement a Postgres robots store and persistence adapter. Each Source result uses one Neon HTTP batch transaction for Source state, validators, Items, and its fetch log; a failed Source cannot roll back another Source.
3. Replace the pipeline placeholder with the due-Source query and the real shared `safeFetch`/robots gate/orchestration. Keep `--dry-run` side-effect-free.
4. Add the Actions workflow with only `workflow_dispatch`, one concurrency group, production `DATABASE_URL`, install, and `pnpm tsx scripts/pipeline/run.ts`; never run migrations there.
5. Run focused tests, `pnpm typecheck`, and `pnpm lint` until green.

### Task 6: Verify, review, and commit

**Files:**
- Review all files changed since `5fd0ff1`

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm check:no-px`, `pnpm check:env`, and `pnpm test`.
2. Generate the migration once more and verify there is no schema drift.
3. Use @code-review with fixed point `5fd0ff1`, running Standards and issue-#69 Spec reviews in parallel.
4. Fix every substantive finding and repeat the full verification suite.
5. Commit the complete implementation on the current branch with a message referencing #69.
