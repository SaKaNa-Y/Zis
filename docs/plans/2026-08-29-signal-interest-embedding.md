# Signal and Interest Embedding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @tdd to implement this plan task-by-task.

**Goal:** Implement issue #73 so every live Signal records the best available Text Basis, embeds only when that rung improves, and stores each reader's exact MAX-cosine Interest match and GAP.

**Architecture:** Preserve `runIngestion` as the single behavioral seam. After alias merging and Strength calculation, derive one explicit `own`, `citing`, or `slug` input for each live Signal, call a provider-agnostic embedding contract only for new or rung-improved Signals, embed each Interest statement independently, and recompute deterministic reader-specific matches. Persist model semantics beside 384-dimensional `halfvec` values, while keeping runtime identity inside adapters. Extend Citation provenance with anchor text because the accepted `citing` rung cannot be reconstructed from URLs alone.

**Tech Stack:** TypeScript 5.9, Vitest 4, Drizzle ORM/PostgreSQL with pgvector, Neon HTTP transactions, `@huggingface/transformers` 3.8.1.

---

### Task 1: Define the persisted embedding and match model

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/schema.test.ts`
- Create: `drizzle/0004_signal_interest_embedding.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0004_snapshot.json`

1. Add failing schema assertions for `vector` extension setup, `halfvec(384)` Signal and Interest embeddings, explicit Signal `text_basis`, model/dimension/version metadata, nullable Citation anchor text, a minimal User owner, one Interest statement per row, and one reader-specific match per `(user_id, signal_id)` storing relevance, argmax Interest, GAP, and match time.
2. Run `pnpm test -- src/lib/db/schema.test.ts` and confirm the assertions fail.
3. Add the Drizzle tables, enum, foreign keys, uniqueness guards, and checks required to keep embedding metadata all-null before embedding and coherent afterwards.
4. Generate the migration, ensure `CREATE EXTENSION IF NOT EXISTS vector` precedes every `halfvec` column, and keep the real Interest Profile out of repository fixtures and migrations.
5. Run the focused schema test and `pnpm typecheck` until green.

### Task 2: Build and verify the provider-agnostic local runtime

**Files:**
- Create: `src/lib/embeddings/provider.ts`
- Create: `src/lib/embeddings/transformers.ts`
- Create: `src/lib/embeddings/transformers.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

1. Add failing adapter tests for the pinned `Xenova/bge-small-en-v1.5` revision, CPU fp32 inference, CLS pooling, L2 normalization, no query prefix, stable batching, a shared lazy model load, and fail-closed 384-dimensional finite output validation.
2. Run the focused adapter test and confirm it fails before the implementation exists.
3. Define one provider-neutral batch `embed` contract whose persisted identity is the fixed model/dimension/version rather than the runtime vendor.
4. Implement the local Transformers.js adapter behind an injectable pipeline factory so unit tests never download weights. Return early for empty input, batch at 32, preserve order, and reset a failed lazy load so a later attempt can retry.
5. Pin `@huggingface/transformers` 3.8.1 and the exact model revision, use a stable ignored `.cache/transformers` directory, and run the focused test plus `pnpm typecheck` until green.

### Task 3: Preserve citing descriptions and choose Text Basis through the seam

**Files:**
- Modify: `src/lib/ingestion/pipeline.ts`
- Modify: `src/lib/ingestion/link-citation.test.ts`
- Create: `src/lib/ingestion/interest-matching.test.ts`

1. Add failing seam tests proving RSS/Atom content and hydrated issue HTML retain cleaned anchor text on the exact Citation and that the longest exact-link anchor wins.
2. Add failing seam cases for an Item-backed Signal selecting `own`, an outbound-only Signal selecting `citing`, and an otherwise undescribed Signal selecting `slug`, with the selected rung readable directly from the returned persisted graph.
3. Capture anchor text alongside hrefs before publisher HTML is discarded, preserve the longest text for duplicate Citation natural keys, and never substitute an Aggregator issue title while a better description is available.
4. Derive Text Basis across every member Signal resolved into a live alias root. Choose the ladder unconditionally as `own > citing > slug`, compose `own` as collapsed `title + ". " + extracted body` capped to 1200 characters, and store the exact capped embedding input.
5. Run the focused ingestion tests and `pnpm typecheck` until green.

### Task 4: Embed deltas and match separate Interests

**Files:**
- Modify: `src/lib/ingestion/pipeline.ts`
- Modify: `src/lib/ingestion/interest-matching.test.ts`

1. Add failing seam assertions that every Interest statement is embedded separately, Signal and Interest vectors are never concatenated, and provider output of any dimension other than 384 fails closed.
2. Add deterministic vector fixtures proving relevance is the exact maximum cosine, the stored Interest is the argmax, GAP is the first cosine minus the second, one Interest produces a null GAP, and ties resolve by stable Interest ID.
3. Add replay cases proving new Signals embed once, `slug -> citing -> own` re-embeds exactly once per improvement, same-rung text changes do not re-embed, downgrades do not occur, merged tombstones do not match, and profile changes recompute matches without re-embedding Signals.
4. Implement the post-merge embedding stage and exact matching. Store nullable match values for readers with no Interests; do not add negative Interests, `T-`, `T_gap`, admission gates, rendering, or any DeepSeek path.
5. Run the focused tests and `pnpm typecheck` until green.

### Task 5: Persist the final graph and wire the production runner

**Files:**
- Modify: `src/lib/ingestion/postgres.ts`
- Modify: `src/lib/ingestion/postgres.test.ts`
- Modify: `scripts/pipeline/run.ts`
- Modify: `.github/workflows/ingest.yml`

1. Add failing adapter coverage proving existing Signals and Interests still embed/match when no Source is due, and proving Signal embeddings, Interest embeddings, Citation anchors, and reader matches commit idempotently in the final graph transaction.
2. Load embedding state and reader Interests only when an embedding provider is supplied, preserving existing adapter tests that intentionally run without matching.
3. Extend per-Source Citation writes with anchor text and the final graph transaction with Signal embedding metadata, Interest embedding metadata, and upserted reader matches.
4. Instantiate the local provider explicitly in the production script before opening the database path, and cache the pinned model directory in the manual ingestion workflow.
5. Run `pnpm test -- src/lib/ingestion/postgres.test.ts src/lib/ingestion/interest-matching.test.ts` and `pnpm typecheck` until green.

### Task 6: Verify, review, and commit

**Files:**
- Review all files changed since `a342bf4`

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm check:no-px`, `pnpm check:env`, and the full `pnpm test` suite once.
2. Run `pnpm db:generate -- --name schema_drift_check` under a non-production placeholder `DATABASE_URL` and verify Drizzle reports no schema drift.
3. Use @code-review with fixed point `a342bf4`, running Standards and issue-#73 Spec reviews in parallel.
4. Fix every substantive finding and repeat the proportionate focused checks plus the final full verification suite if code changed.
5. Commit the complete implementation on the current branch with the English message `build: embed Signals and match Interests (#73)`.
