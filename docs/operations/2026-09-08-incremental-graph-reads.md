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
