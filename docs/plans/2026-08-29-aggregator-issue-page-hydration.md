# Aggregator Issue-Page Hydration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hydrate excerpt-only Aggregator issue pages at stage 4 so their links become ordinary outbound Citations and can raise Signal Strength.

**Architecture:** Keep `runIngestion()` as the only behavioral seam. After feed parsing and normalization, fetch issue pages only for Sources whose explicit `isAggregator` flag is true, retain raw hrefs with the final response URL as their base, and pass them through the existing `recordCitation()` canonicalization and citation-worthiness path. Track each Source's touched `http_cache` keys explicitly so issue-page validators and their Citations commit atomically in the Neon adapter.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, PostgreSQL, existing `safeFetch`/robots policy.

---

### Task 1: Prove the stage-4 behavior through the ingestion seam

**Files:**
- Create: `src/lib/ingestion/aggregator-hydration.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

**Step 1: Write the failing behavioral test**

Create an excerpt-only Aggregator and an independent Publisher that both cite the same target, with the Aggregator's target appearing only in its issue HTML. Assert that:

```ts
expect(aggregatorCitations).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: 'self', rawUrl: issueUrl }),
  expect.objectContaining({ kind: 'outbound', rawUrl: trackedTargetUrl }),
]))
expect(targetSignal).toMatchObject({ strength: 2 })
```

Include a relative href, a reference-only URL, and an own-host URL in the issue page. The valid href must preserve its raw form while resolving against the final issue response URL; rejected hrefs must never become Links or Citations.

**Step 2: Run the focused test to verify red**

Run: `pnpm vitest run src/lib/ingestion/aggregator-hydration.test.ts`

Expected: FAIL because no issue-page request or hydrated Citation exists.

**Step 3: Implement the minimal stage-4 path**

In `pipeline.ts`:

- represent outbound addresses as raw href plus optional base URL;
- add an internal `hydrateIssuePages()` helper that reads only `source.isAggregator`;
- call it after `parseFeed()` and before the first `canonicalizeLink()` call;
- fetch through the policy-wrapped `SafeFetch` with `Accept: text/html`;
- extract hrefs in memory and never persist HTML;
- send every hydrated href through the existing `recordCitation()` function.

Do not export hydration as a second seam and do not add a host/id allowlist.

**Step 4: Run the focused test and typecheck**

Run: `pnpm vitest run src/lib/ingestion/aggregator-hydration.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 2: Lock the one-ever, 304, explicit-flag, robots, and no-cap rules

**Files:**
- Modify: `src/lib/ingestion/aggregator-hydration.test.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

**Step 1: Add one failing test for each remaining public behavior**

Add vertical seam tests that prove:

- `isAggregator: false` never fetches an issue page, regardless of hostname;
- a successful page without validators is not fully fetched/extracted again;
- a cached ETag is sent byte-identically and a 304 preserves validators and existing Citations without inspecting its body;
- 25 issue pages all hydrate, catching the prototype's former 24-page cap;
- a separate issue-page host is checked against `robots.txt` and denied with no exemption;
- an issue-page redirect resolves relative hrefs against the final response URL while retaining the observed raw href.

**Step 2: Run the focused file and confirm the new failures**

Run: `pnpm vitest run src/lib/ingestion/aggregator-hydration.test.ts`

Expected: FAIL only on behaviors not implemented by Task 1.

**Step 3: Complete cache-aware hydration**

Build conditional headers from the URL-keyed cache, reject a 304 without a prior successful cache record, preserve missing validators on 304, and return before HTML extraction. For a successful response, stage its validator update until all issue pages for the Source have succeeded; then merge the updates into the graph. Never add an issue-count cap.

**Step 4: Run focused and neighboring tests**

Run: `pnpm vitest run src/lib/ingestion/aggregator-hydration.test.ts src/lib/ingestion/pipeline.test.ts src/lib/ingestion/link-citation.test.ts src/lib/ingestion/signal-strength.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 3: Persist arbitrary issue-page validators atomically in Neon

**Files:**
- Modify: `src/lib/ingestion/postgres.test.ts`
- Modify: `src/lib/ingestion/postgres.ts`
- Modify: `src/lib/ingestion/pipeline.ts`

**Step 1: Write the failing adapter contract test**

Through `runNeonIngestion()`, supply an Aggregator feed and issue page with an ETag. Assert that the transaction containing the Item and hydrated Citation also upserts an `http_cache` row keyed by the issue request URL, without creating a Source for that URL. On the next run, return 304 only when the validator header is present and assert that no new Citation is extracted.

**Step 2: Run the adapter test to verify red**

Run: `pnpm vitest run src/lib/ingestion/postgres.test.ts`

Expected: FAIL because `initialGraph()` and `sourceStatements()` currently handle only Source endpoint cache rows.

**Step 3: Implement exact cache ownership**

Have `ingestSource()` return a local `Set<string>` of cache keys touched by that Source. Extend `onSourceCommitted` and `commitSource()` to pass those exact keys into `sourceStatements()`, and upsert only those rows in the same transaction as the Source's Items and Citations. Load arbitrary URL cache rows needed by the graph without deriving issue request keys from canonical Link URLs. Do not infer ownership from timestamps because Sources run concurrently.

**Step 4: Run adapter, focused behavior, and typecheck**

Run: `pnpm vitest run src/lib/ingestion/postgres.test.ts src/lib/ingestion/aggregator-hydration.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 4: Verify, review, and commit issue #72

**Files:**
- Modify as required by review findings only.

**Step 1: Run repository verification**

Run: `pnpm lint`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

Run: `pnpm test`

Expected: PASS.

Run: `pnpm build`

Expected: PASS.

**Step 2: Review against standards and issue #72**

Use the `code-review` skill from base commit `e61c2bc`, with Standards and Spec reviews in parallel. Fix every confirmed issue and rerun the smallest relevant test before the full suite.

**Step 3: Commit the completed slice**

```bash
git add docs/plans/2026-08-29-aggregator-issue-page-hydration.md src/lib/ingestion/aggregator-hydration.test.ts src/lib/ingestion/pipeline.ts src/lib/ingestion/postgres.ts src/lib/ingestion/postgres.test.ts
git commit -m "build: hydrate Aggregator issue pages (#72)"
```

Expected: one English commit containing the implementation, tests, and plan.
