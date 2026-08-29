# Link and Citation Graph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @tdd to implement this plan task-by-task.

**Goal:** Build issue #70 so RSS/Atom Items create canonical L1-L3 Links and provenance-preserving Citations after citation-worthiness filtering.

**Architecture:** Keep issue #69's `runIngestion` entry point as the only behavioral seam: Sources, Publisher host ownership, and canned Transport responses enter, and the persisted graph leaves. Feed parsing captures raw outbound addresses before publisher HTML is discarded; an internal pure canonicalization module maps accepted raw addresses to one Link, while Citation keeps the raw address, Item, Source, kind, and first-seen time. The production adapter loads the shared host registry and existing Links, then commits each Source's Items, Links, and Citations in the same per-Source transaction.

**Tech Stack:** TypeScript 5.9, Vitest 4, Drizzle ORM/PostgreSQL, Neon HTTP transactions, `saxes`.

---

### Task 1: Define the Link and Citation persistence model

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/schema.test.ts`
- Create: `drizzle/0001_link_citation_graph.sql`
- Create: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0000_snapshot.json`
- Create: `drizzle/meta/0001_snapshot.json`

1. Add a failing schema test for a unique `link.url`, a `citation_kind` enum with `self` and `outbound`, Citation foreign keys to Item, Source, and Link, provenance columns, and an idempotency constraint on `(item_id, kind, raw_url)`.
2. Run `pnpm test -- src/lib/db/schema.test.ts` and confirm the new assertion fails.
3. Define `links` and `citations` in Drizzle, including indexes for Link and Source lookups.
4. Generate the migration with `pnpm db:generate -- --name link_citation_graph` under a non-production placeholder `DATABASE_URL`, including the journal and snapshot required by `drizzle-kit migrate`.
5. Clear disposable HTTP validators in the migration so the first post-migration poll re-observes real raw addresses; never fabricate historical Citation provenance from canonical `Item.url` values.
6. Run the focused schema test and `pnpm typecheck` until green.

### Task 2: Port canonicalization L1-L3 through the pipeline seam

**Files:**
- Create: `src/lib/ingestion/canonicalize.ts`
- Create: `src/lib/ingestion/link-citation.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

1. Add a failing seam-level table test containing all 28 executable cases from `prototype/clustering-spike:.scratch/zis/prototype/PROTOTYPE-clustering/cases.mjs`.
2. Add failing acceptance rows not explicit in the prototype table: trailing-dot host, userinfo, `www2.`/`m.`/`mobile.`, `index.htm`/`index.php`, preservation of a non-default port, the kept `q`/`p`/`offset`/`cursor`/`tab`/`lang`/`version` parameters, and AMP prefix aliases.
3. Add the two path-shape regressions: distinct YouTube playlists remain distinct, while one video embedded in different playlists remains one Link.
4. Run `pnpm test -- src/lib/ingestion/link-citation.test.ts` and confirm the cases are red because the graph has no Links or Citations.
5. Implement a pure synchronous L1-L3 canonicalizer. Use a denylist for ordinary query parameters, path-shape allowlists for parameter-identified resources, stable parameter sorting, and literal-host SSRF rejection using the existing IP classifier. Keep non-default ports.
6. Implement shape aliases for YouTube, AMP, GitHub, and the canonical Bilibili forms described by `docs/clustering-model.md`.
7. Feed each accepted Item self-address through the canonicalizer, upsert one in-memory Link per canonical URL, and create one self Citation per raw address.
8. Re-run the focused test after each tracer bullet. Prove idempotency by re-running the same feed against its returned graph and by feeding canonical outputs through the seam again.
9. Run `pnpm typecheck` once the complete L1-L3 table is green.

### Task 3: Extract outbound addresses and apply citation-worthiness

**Files:**
- Modify: `src/lib/ingestion/pipeline.ts`
- Modify: `src/lib/ingestion/link-citation.test.ts`

1. Add a failing seam test whose feed body contains one ordinary external link, one reference-only URL, one same-Publisher URL, one arXiv URL, and one GitHub release-tag URL.
2. Add a failing multi-Source case proving the intra-Publisher decision is per Citation: an owner's outbound link is dropped while another Publisher's Citation to the same target survives.
3. Add a failing case proving three Publishers referencing documentation cannot create a Link visible to future Strength counting.
4. Add a failing provenance case proving an outbound address creates a Link even when no Item was ingested from it, and that Citation exposes `itemId`, `sourceId`, `rawUrl`, `kind`, and the original `firstSeenAt` after a rerun.
5. Capture hrefs from RSS/Atom bodies during SAX parsing, before converting publisher HTML to plain text. Resolve relative outbound addresses against the Item's self URL.
6. Apply the canonical reference-only rules only to outbound Citations. Deliberately keep arXiv and `github.com/*/*/releases/tag/*`.
7. Resolve canonical hosts by exact lowercase match through the same asserted `publisher_host` registry used by the self-citation guard; never infer ownership from a parent domain. Drop only same-Publisher outbound Citations.
8. Upsert accepted outbound Links and Citations. Never create a Link for a rejected Citation, never remove self provenance, and never overwrite first-seen time on rerun.
9. Run `pnpm test -- src/lib/ingestion/link-citation.test.ts src/lib/ingestion/pipeline.test.ts` and `pnpm typecheck` until green.

### Task 4: Persist the graph through the Neon adapter

**Files:**
- Modify: `src/lib/ingestion/postgres.ts`
- Modify: `src/lib/ingestion/postgres.test.ts`

1. Add a failing adapter test proving host ownership and existing canonical Links are loaded into the same persisted graph used by `runIngestion`.
2. Add a failing statement-order/idempotency test proving a successful Source transaction writes Item, Link, then Citation without duplicating a Link already shared by another Source.
3. Extend the initial graph query with Publisher hosts, existing Links, and existing Citations for due Sources.
4. Extend each successful per-Source transaction to insert accepted Links before Citations, using the graph's stable UUIDs and conflict-safe natural keys.
5. Keep failed Source transactions free of new Item/Link/Citation rows and preserve the existing per-Source commit boundary.
6. Run `pnpm test -- src/lib/ingestion/postgres.test.ts src/lib/ingestion/link-citation.test.ts` and `pnpm typecheck` until green.

### Task 5: Verify, review, and commit

**Files:**
- Review all files changed since `8b4f262`

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm check:no-px`, `pnpm check:env`, and `pnpm test`.
2. Run `pnpm db:generate -- --name schema_drift_check` and verify that Drizzle reports no schema changes; remove no generated file unless it is an empty generator artifact created by this check.
3. Use @code-review with fixed point `8b4f262`, running Standards and issue-#70 Spec reviews in parallel.
4. Fix every substantive finding and repeat the full verification suite.
5. Commit the complete implementation on the current branch with the English message `build: add canonical Link and Citation graph (#70)`.
