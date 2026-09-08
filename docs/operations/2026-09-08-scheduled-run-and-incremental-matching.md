# First scheduled run and incremental matching — 2026-09-08

Operational follow-up to [#92](https://github.com/SaKaNa-Y/Zis/issues/92).
The production schedule remains **06:17 Asia/Shanghai daily**, the single
`17 22 * * *` UTC cron, with manual dispatch retained. A schedule starts ingestion;
the Brief becomes available after the run commits. It is not exact-time delivery.

## Verified production evidence

[Run 34173273205](https://github.com/SaKaNa-Y/Zis/actions/runs/34173273205)
has event **schedule**, conclusion **success**, and head
`4ea0ca3a7fdaa297932ee9dee9c715b92a5b5edf`. GitHub created/started the run at
`2026-09-08T00:25:37Z` (**08:25:37 China time**), 2h 8m 37s after the nominal
06:17 schedule, and completed it at `00:29:33Z` (**08:29:33**). This is genuine
scheduled-run evidence, unlike the earlier manual runs.

The pinned model cache hit and restored successfully. Neon wake through completed
prune took **199,227 ms**, exceeding the 120,000 ms budget by 79,227 ms. The full
workflow elapsed 236 seconds, which includes setup and cleanup and is not the
same measurement. The pipeline reported 67 Sources, 67 outcomes, and 5,417
persisted Items, with two Dormant Source warnings.

The retained Source fetch logs for this run show:

| Outcome | Sources | Items seen | New Items |
| --- | ---: | ---: | ---: |
| ok | 35 | 4,305 | 25 |
| not_modified | 25 | 0 | 0 |
| robots_denied | 2 | 0 | 0 |
| parse_error | 2 | 0 | 0 |
| too_large | 3 | 0 | 0 |

A successful workflow does not mean every Source succeeded. The seven unsuccessful
Sources could reduce coverage; the number of missed eligible Signals is unknown.
No crawling restrictions or response-size bounds were changed in this work.

An authenticated browser at <https://zis-xi.vercel.app/> and a read-only database
query both show the **September 8 Brief: 4 entries, 3 Interest / 1 convergence**.
The stored `cut_at` is `2026-09-08T00:26:10.420Z`, the logical wake/cut reference,
not the later commit-completion time. The production reader remains
`Asia/Shanghai`, cut hour 6. Today is not a live feed and a later same-day run
does not append to or recut its saved Brief.

The current graph, evaluated against that saved cut reference, has 15,807 live
Signals, 177 at Strength >=2, and 15 of those within the seven-day AGE window.
Three of the 15 were shown previously; none of the remaining 12 were already read
before the cut. Four pass the existing Interest/convergence Admission tests.
This explains the observed output against the retained graph; it is not a
historical snapshot or proof that uncollected content could not have qualified.
Brief density does not justify changing Admission thresholds (ADR-0016).

## Incremental vector transfer and final writes

The implementation accompanying this record leaves existing Signal vectors in
Neon and initially reads explicit stored-vector handles plus graph metadata.
Only vectors required by a missing or invalidated reader match are fetched, in
batches of at most 1,000. New and improved Text Basis vectors still come from the
pinned local embedding provider. No corpus or reader data is placed in an Actions
cache or public artifact; the existing model cache remains model files only.

Migration `0009_incremental_signal_matching.sql` adds `reader_match_profile`, one
reader-owned Profile fingerprint per user. The fingerprint covers the ordered
Interest identities and statements, the pinned model identity, and matching
algorithm version. Additions, edits, and removal of even a non-winning Interest
invalidate that reader's matches. A missing checkpoint performs a full initial
match rather than trusting old results. Checkpoints, changed matches, changed
embeddings, and new Briefs commit in the same final transaction.

Matches are reused only after their timestamp is later than the Signal and every
Interest embedding timestamp. A newly generated fp32 vector is rounded by
Postgres's `halfvec` storage; the following wake therefore rematches once using
the stored precision before reuse. This preserves the existing round-trip
behavior instead of indefinitely caching a pre-rounding cosine at a boundary.
Changing the matching algorithm must also change the fingerprint version.

Final persistence compares against the loaded state and writes changed records
only. A metadata-only Signal update preserves its stored vector. Permanent Links,
Citations, reader isolation, retained text, Admission, and historical Briefs
remain in place; the 30-day retention sweep still runs in the database.

This is **incremental vector transfer**, not a fully incremental graph reader.
Items, Citations, Links, Signal metadata, and reader history still load each wake.
Further reduction of those reads remains part of #92. A scoped reader needs to
retain complete alias/provenance dependencies; dropping old rows from the
in-memory graph without that closure would change Strength or repeat a Signal.

## Measured scope and monthly budget

A September 8 read-only query measured the following row-JSON projection sizes
inside production, returning only aggregates to the operator:

| Relation | Rows | Existing JSON bytes | With deferred vectors |
| --- | ---: | ---: | ---: |
| Signal | 15,832 | 84,735,533 | 10,232,601 |
| Item | 5,417 | 5,140,713 | 5,140,713 |
| Citation | 18,159 | 7,653,909 | 7,653,909 |
| Link | 15,832 | 3,271,363 | 3,271,363 |
| Reader match | 15,807 | 4,357,363 | 4,357,363 |
| Total | | **105,158,881** | **30,655,949** |

The projected principal payload falls **70.8%** in an unchanged wake. These are
row-JSON sizes, **not measured HTTP bytes or billed egress**. The pipeline now logs
decoded graph/vector JSON bytes, vector rows fetched, and reused/recomputed match
counts, with the same qualification; no values or SQL parameters are logged.
The initial checkpoint fill and Profile changes can require all stored vectors.

At fixed September 8 size, 31 daily principal reads are about **0.95 GB/month**;
730 hourly reads are **22.38 GB/month**, before invalidations, other queries, UI
traffic, retries, and growth. Hourly remains unqualified against the
[5 GB Free allowance](https://neon.com/docs/introduction/network-transfer).
At the observed 199.227-second pipeline duration and 300-second idle tail, 31
wakes at 0.25 CU cost about **1.07 CU-hours/month**, excluding UI use.

For daily planning, reserve an additional 0.95 GB for 2x principal-corpus growth,
1 GB for UI use, and 1 GB for invalidation reads, other queries, and retries:
about **3.90 GB/month** in total, leaving roughly 1.10 GB against 5 GB. These are
explicit planning allocations, not observed traffic or a guarantee. Storage
growth and compute caused by UI wakes must also be observed. A single quiet UI
session is not a monthly demand measurement.

At approximately 13:30 China time, the project dashboard displayed **0.33/5 GB
network**, **0.1/0.5 GB storage**, **0.05 GB history**, and a fixed 0.25 CU
production compute. Its compute-usage display was 0/100 CU-hours, inconsistent
with the previously recorded 0.87; that display is not treated as verified zero
usage. Metrics may lag an hour and are not refreshed for inactive projects.
The change from September 7's 0.13 GB includes its manual run, today's scheduled
run, and UI/operator use; it is not today's per-run egress.

The first scheduled run was less than 24 hours old during this audit. The full
24-hour observation and a production measurement of the new reader are pending.
Do not claim the budget, runtime target, or entire #92 is complete on these data.

## Rollout gate and remaining verification

Local verification used Node 22.23.2: all **402 tests in 35 files** passed,
TypeScript and ESLint passed, and the no-pixel-unit and environment-reference
checks passed. Drizzle's migration consistency check passed with a dummy local
URL; it did not connect to or migrate production. `next build --webpack`
completed successfully. The default Turbopack build could not bind its local
helper port in this execution environment (`EPERM`), including on retry; that
build path remains unverified here.

Independent review of the implementation against baseline `4ea0ca3` reported
zero Standards findings and no implementation defects. The Spec review recorded
two completion gaps: full-corpus metadata reads remain, and actual deployed
usage/runtime, the full 24-hour observation, and monthly budget qualification
are still pending. These are open #92 acceptance requirements.

The changes are prepared locally; production still runs `4ea0ca3`. The verified
Neon production branch is `br-wild-scene-b3gzsh9b` in project `Zis`
(`summer-hat-29072279`). Its sole manual-snapshot slot is occupied by
**production at 2026-09-02 13:59:35 UTC (manual)**. No snapshot was deleted,
database migration applied, or optimized pipeline deployed during preparation.

`drizzle.config.ts` and `docs/repo-and-ci.md` require an operator-controlled
migration after a manual snapshot. Replacing the existing snapshot removes that
old restore point and needs explicit approval; alternatively the owner can
choose a different approved backup/migration procedure.

- [x] Observe and record the first genuine scheduled run, cache result, timing,
  and warnings.
- [x] Verify the saved local date and authenticated rendering.
- [ ] Approve the backup step, apply migration 0009 through the normal migration
  runner to the intended databases, and deploy the reviewed code.
- [ ] Observe an initial checkpoint fill and an unchanged follow-up run. Confirm
  vector-read and write reductions, pipeline time, unchanged saved Briefs, and
  refreshed Neon usage. Neither manual run substitutes for scheduled evidence.
- [ ] Complete first-24-hour compute/storage/network/Actions verification with
  delayed metrics accounted for.
- [ ] Make remaining graph reads incremental and qualify actual monthly usage,
  including UI traffic and growth, before seeking hourly approval.

## Separate page findings

Authenticated production navigation to `/interests`, `/saved`, and `/settings`
was confirmed to return 404. The owner requested tracker recording and then
explicitly selected continuing #92 rather than switching implementation:
[Interests #93](https://github.com/SaKaNa-Y/Zis/issues/93),
[Saved #94](https://github.com/SaKaNa-Y/Zis/issues/94), and
[Settings #95](https://github.com/SaKaNa-Y/Zis/issues/95).
The Interests issue is prioritized because it blocks self-service Profile edits.
Those routes are not repaired by the ingestion optimization.
