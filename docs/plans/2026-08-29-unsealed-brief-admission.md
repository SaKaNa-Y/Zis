# Unsealed Brief Admission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @tdd to implement this plan task-by-task.

**Goal:** Implement issue #74 so each due reader receives one unsealed local-day Brief containing every eligible Signal, with its Admission, deterministic position, and frozen why-text persisted.

**Architecture:** Preserve `runIngestion` as the only behavioral seam and extend its persisted graph with Publishers, Read States, Briefs, and Brief Entries. After alias resolution, Strength calculation, and Interest matching, an internal cut stage evaluates the four eligibility bars, selects exactly one Admission route, orders every admitted live Signal, and snapshots the explanation. The Neon adapter loads the complete corpus and commits the cut atomically with the final Signal graph; no sealing path or stage-level public API is introduced.

**Tech Stack:** TypeScript 5.9, Vitest 4, Drizzle ORM/PostgreSQL, Neon HTTP transactions, IANA time zones through `Intl.DateTimeFormat`.

---

### Task 1: Define the persisted Brief contract

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/schema.test.ts`
- Create: `drizzle/0005_brief_admission.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0005_snapshot.json`

1. Add failing schema assertions for `User.timezone`, `User.cutHour`, the `brief_admission` enum, and the `brief`, `brief_entry`, and `read_state` tables.
2. Assert `(user_id, local_date)`, `(user_id, signal_id)`, and `(brief_id, position)` uniqueness; a composite Brief-owner foreign key; one-based positions; non-empty why-text; valid cut hours; and the complete absence of sealing columns.
3. Run `pnpm test -- src/lib/db/schema.test.ts` and confirm the new assertions fail because the tables and migration do not exist.
4. Add the minimal Drizzle model. Store `local_date` as a `YYYY-MM-DD` string, snapshot `why_text` literally, and do not add mutable Interest foreign keys, entry counts, relevance snapshots, or sealing state.
5. Generate `0005_brief_admission`, review the SQL for safe defaults and backfill of the single reader schedule, and run the focused schema test plus `pnpm typecheck` until green.

### Task 2: Cut and order a Brief through the existing seam

**Files:**
- Create: `src/lib/ingestion/brief-cut.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`
- Modify: `src/lib/ingestion/interest-matching.test.ts`

1. Write one failing tracer-bullet test that passes a complete corpus into `runIngestion` and expects one local-day Brief with interest entries first, convergence entries second, consecutive one-based positions, exact Admission values, and exact frozen why-text.
2. Run `pnpm test -- src/lib/ingestion/brief-cut.test.ts` and confirm it fails because Brief state is absent.
3. Extend `PersistedGraph` with Publisher identities, Read States, Briefs, and Brief Entries; extend `PersistedUser` with an IANA timezone and cut hour; keep all new cut helpers private.
4. Reuse one resolved-Signal provenance calculation for Strength and why-text. Exclude the target owner, deduplicate Publisher identities across Sources and Citations, display at most three deterministic Publisher names plus `+N`, and label the target hostname as origin.
5. Implement inclusive `own >= 0.70` and `citing >= 0.67` matching, treat `slug` as uncalibrated, keep GAP out of Admission, and place matched Strength-3 Signals only on the interest route.
6. Order interest entries by relevance descending and convergence entries by `0.5 ** (fresh_hours / 36) * strength` descending, with Signal ID as the final deterministic tie-break. Run the focused test and `pnpm typecheck` until green.

### Task 3: Prove every eligibility and local-day boundary

**Files:**
- Modify: `src/lib/ingestion/brief-cut.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

1. Add a failing seam case covering the conjunction: Strength below 2, age above seven days, a prior Brief Entry, and a Read State each exclude a Signal; exactly seven days remains eligible.
2. Include prior state attached to a merge tombstone and prove it suppresses the resolved live Signal. Include eligible Signals older than 24 hours and more candidates than a typical page could show to prove there is no 24-hour window or top-N.
3. Add a failing schedule case for before-cut behavior, the first wake on or after cut hour, same-local-day replay, the next local day, and zero- and one-entry Briefs.
4. Implement local clock conversion with `Intl.DateTimeFormat`, validate the stored schedule, create an empty Brief as an ordinary row, and use stable Brief identity plus the schema guards for retry safety.
5. Add a replay assertion that changing an Interest statement or Publisher name after cut does not alter the stored why-text. Run the focused test and `pnpm typecheck` until green.

### Task 4: Load and atomically persist the complete cut

**Files:**
- Modify: `src/lib/ingestion/postgres.ts`
- Modify: `src/lib/ingestion/postgres.test.ts`

1. Add a failing adapter test proving that a supplied wake timestamp, with no due Source, loads Publishers, users, matches, prior Brief state, and Read States, then persists one Brief and all its entries.
2. Make the wake timestamp authoritative for the cut without replacing fetch timing with a fixed clock.
3. Load the complete final graph whenever matching and cutting run. Persist Brief before Brief Entries in the same final Neon transaction as Signal and match outputs, relying on database uniqueness guards for idempotence.
4. Keep Source transactions unchanged and do not add a scheduler, sealing update, summary call, or UI path.
5. Run `pnpm test -- src/lib/ingestion/postgres.test.ts src/lib/ingestion/brief-cut.test.ts` and `pnpm typecheck` until green.

### Task 5: Verify, review, and commit

**Files:**
- Review all files changed since `6ff9e16`

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm check:no-px`, `pnpm check:env`, and the full `pnpm test` suite once.
2. Run a Drizzle schema-drift generation check under a non-production placeholder `DATABASE_URL` and verify that no additional migration is produced.
3. Use @code-review with fixed point `6ff9e16`, running the Standards and issue-#74 Spec reviews in parallel.
4. Fix every substantive finding and repeat the proportionate focused checks; rerun the full verification suite if production code changes.
5. Commit the complete implementation on the current branch with an English commit message referencing issue #74.
