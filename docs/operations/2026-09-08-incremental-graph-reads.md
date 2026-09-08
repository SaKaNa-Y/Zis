# Incremental graph reads — September 8, 2026

Continues [#92](https://github.com/SaKaNa-Y/Zis/issues/92) after the
[vector reuse rollout](2026-09-08-scheduled-run-and-incremental-matching.md).
The sole production cron remains daily at **06:17 Asia/Shanghai**. Interests,
Saved, and Settings page implementations remain in #93–#95.

## Read and retry contract

Migration 0010 adds a singleton ingestion checkpoint, a nullable normalized-input
hash on Item, and an Item update-time index. It does not delete or shorten the
retention of any record. The first reader run bootstraps from the complete graph.

On subsequent runs, Source endpoints are fetched with their existing validators.
A 200 response loads the corresponding existing Items; a 304 loads only pending
Aggregator hydration. Legacy feeds without GUIDs retain a Source-local identity
lookup. The normalized-input hash includes outbound addresses, so an href-only
edit is a change even if visible text is identical. Identical input preserves
`updated_at`, retained text, and Citation first-seen times, while recording the
fetch. Citation targets are resolved by URL before insertion, including Links
whose persisted IDs predate the current deterministic ID scheme.

Reader-stage seeds include changed Items, new or unembedded Signals, recent
evidence, and missing or invalidated reader matches. A recursive query loads the
complete undirected closure of existing merge edges and release-tag alias claims.
The exactly-one-release-tag guard is evaluated over complete persisted evidence,
with no age filter on identity edges. Every Citation and citing Item for those
components is loaded, together with their reader-specific matches and history.
An additional outbound-existence projection preserves vehicle detection when an
Item also cites Links outside the working set. Sealed Briefs and their historical
entries remain unchanged; aliases retain the evidence needed to suppress repeats.

The checkpoint records the run's **start**, in the same transaction as final graph
and Brief writes. The overlap includes Source commits made during the previous
run. A failed final transaction cannot advance it, so committed Source changes
remain eligible on retry. A changed Source register, host ownership, reader
configuration, Interest Profile, or embedding-provider identity invalidates the
checkpoint and requires a full bootstrap. Clock rollback also invalidates it.

This is scoped transfer, not an assertion that every query is incremental. The
exhaustive startup ownership check still reads the narrow Item/Source URL
projection required by ADR-0020. Small configuration tables remain global. SQL
evaluates eligibility and alias closure against the retained database. A warm
`runNeonIngestion` result contains the loaded working set, with scalar
`corpusCounts` for total persisted sizes.

## Measurement contract

Logs separate decoded graph/vector JSON estimates from committed writes.
Postgres `rowCount` measures actual affected rows after successful commits;
statement counts, compiled write JSON bytes, and WebSocket commit counts explain
the write path. Already-null expired text is no longer rewritten during pruning.
Compiled or decoded JSON bytes are **not billed network transfer**. They omit
protocol overhead and some control queries, including the ownership assertion.
Actual egress must be checked against Neon usage counters, allowing for their
delay and unrelated UI/operator traffic. The existing Neon transport is retained.

## Local verification

- Full Vitest suite: **409 tests passed across 37 files**.
- New tests use the real PostgreSQL engine in PGlite with pgvector at the existing
  `runNeonIngestion` seam: unchanged 200/304, Interest edits with another reader,
  failed final transaction retry, and historical release-alias provenance and
  repeat suppression. In-memory ingestion tests cover unchanged normalized input
  and href-only changes.
- Legacy fixtures explicitly have no input hash, matching rows before migration
  0010. Their natural-key and raw-provenance tests pass.
- TypeScript, ESLint, no-px, environment-name checks, migration consistency, and
  the Webpack production build passed. The local default Turbopack limitation is
  recorded in the preceding rollout; this verification used `--webpack`.

Production migration, run measurements, delayed usage evidence, and the monthly
budget will be appended after rollout. The first scheduled run completed at
08:29:33 Asia/Shanghai on September 8; a complete first-24-hour observation cannot
be claimed earlier than September 9, plus the usage-metric delay. Keep #92 open
until its operational acceptance criteria have evidence.

## Pre-deployment checks and review

At approximately **15:29 Asia/Shanghai**, the Zis project dashboard reported
month-to-date compute **1.28/100 CU-hours**, network transfer **0.45/5 GB**, storage
**0.1/0.5 GB**, and history **0.08 GB**. Production and preview were both idle at
0.25 CU. The dashboard explicitly allows an hour of metric delay and does not
refresh inactive projects. Compared with the earlier 0.33 GB reading, the 0.12 GB
increase includes the previous vector-stage validation and operator/UI activity;
it is not an isolated measurement of the new graph reader.

Before migration 0010, all ten production migration hashes and journal timestamps
matched the checkout. Read-only counts were 5,419 Items, 15,835 Signals/Links,
18,163 Citations, four Briefs, 83 Brief Entries, and four September 8 entries.
Private temporary digests were captured for the sealed Brief records so migration
and validation runs can be compared without exporting their contents.

Independent Standards review found no documented violation. Its two duplication
findings were fixed by sharing the existing HTTP cache-key function and Signal-age
constant; the reviewer confirmed both resolved. Spec review found no code defects
or scope creep, retaining the three pending operational requirements: production
measurement, first-24-hour usage, and monthly budget qualification. After those
small review changes, 20 focused tests plus TypeScript and ESLint passed.

## Budget worksheet for operational acceptance

These are conservative planning allocations, not a claim of measured usage or
authorization to change cadence. Keep the daily schedule until real counters
qualify it. Before proposing hourly, substitute 730 runs/month for 31 and obtain
the owner's separate decision.

| Resource | Proposed monthly envelope | Evidence required |
| --- | --- | --- |
| Network, ingestion | 1 GB | At most 32.26 MB per daily run, including control queries and write responses, from delayed Neon counters |
| Network, UI and preview | 1 GB | Observe authenticated UI/preview activity; do not assume cache estimates equal transfer |
| Network, growth and maintenance | 1 GB | Allow new retained provenance, migration warmups, and retries |
| Network, unallocated margin | 2 GB | Subtract existing monthly consumption before evaluating the remaining month |
| Compute, ingestion | 2 CU-hours | At fixed 0.25 CU, 31 wakes of 120 seconds plus the 300-second idle tail estimate 0.904 CU-hours; verify actual wake duration |
| Compute, UI and preview | 10 CU-hours | Includes extra wakes; a UI request can extend an existing wake or create another |
| Compute, unallocated margin | 88 CU-hours | Shared 100-CU-hour project pool, including preview |
| Storage | Plan below 0.4 GB; retain 0.1 GB margin | Project current live storage plus measured daily growth across the month; provenance is permanent, so no finite projection proves indefinite capacity |

At the 15:29 reading, remaining monthly transfer is approximately 4.55 GB and
compute approximately 98.72 CU-hours. UI and growth allowances are explicit
assumptions; the 24-hour observation must say whether they are supported. If the
plan is exceeded, record the deficit and retain daily cadence rather than reducing
Admission, provenance, or retention. Public-repository standard Actions runners
remove the private-repository minute ceiling, but actual run/CI time still belongs
in the observation record.
