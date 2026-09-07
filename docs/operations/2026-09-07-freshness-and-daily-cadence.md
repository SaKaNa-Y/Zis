# Freshness correction and daily activation — 2026-09-07

Follow-up to the [first production proof](2026-09-05-first-production-brief.md)
for [#91](https://github.com/SaKaNa-Y/Zis/issues/91), and the owner's report that
September 6 appeared missing and September 5 contained outdated material.

## Findings and correction

The production archive contains a September 6 Brief with zero entries. The
pipeline did run manually that day; it did not repeat September 5's entries.
There was no automatic trigger: Ingest exposed only `workflow_dispatch`.

The September 5 Brief's 79 entries were not proof of content freshness. A
September 7 read-only query over their current Citation/Item graph found **76**
whose first publication evidence was outside the seven-day cutoff at that cut,
and **71** whose latest citing publication was also older than seven days.
All first-discovery timestamps were September 5, although the earliest published
evidence was July 31, 2012. This is a current-corpus assessment against the saved
cut time, not a historical database snapshot.

Examples from the persisted graph:

| Target | Earliest citing publication | Latest citing publication |
| --- | --- | --- |
| `https://pnpm.io/` | 2022-07-23 | 2026-08-06 |
| `https://rollupjs.org/` | 2020-11-05 | 2026-03-12 |
| `https://v3.vuejs.org/` | 2020-07-01 | 2021-01-11 |
| `https://vuejs.org/` | 2020-07-17 | 2026-01-07 |

These examples have feed dates. The failure was using cold-fetch discovery time
for ranking, not missing dates. Commit `7b14fb7` uses
`min(citation.first_seen_at, item.published_at)` as each Citation's ranking time.
AGE takes the first evidence and convergence decay takes the latest evidence,
including merged members. Discovery provenance, Strength, Admission thresholds,
and permanent history remain intact. Missing/invalid feed dates still fall back
to fetch time; no publication date is guessed from a URL.

A real `runIngestion()` regression admitted a 2022 publication on the August 2026
fixture before the fix and excluded it afterward. Inclusive seven-day boundary,
convergence order, and unchanged discovery timestamps also pass. All **392 tests
in 34 files**, typecheck, lint, no-px, environment inventory, and production build
passed on Node 22.23.2; Standards and Spec reviews reported no actionable findings.

The September 5 Brief remains a record of what was shown, including the now-known
error. Neither it nor the empty September 6 Brief was deleted or recut. The fix
controls subsequent cuts; it does not retroactively make the first 79 valid.

## Owner-approved temporary daily cadence

The owner selected **06:17 Asia/Shanghai daily**, preserving manual retries and
leaving incremental hourly ingestion to #92. The sole configured cron is
`17 22 * * *` (22:17 UTC on the prior day), in the existing sequential Ingest job,
with `cancel-in-progress: false`. The production reader was verified to use
`Asia/Shanghai` and cut hour 6, so this wake occurs after that local cut hour.
The daily cut stays inside that run. GitHub scheduling is not an exact-time
delivery guarantee.

The repository was reconfirmed public; Actions exposes `DATABASE_URL` and
`GH_PUBLIC_PAT` by name only. Ingest receives only `DATABASE_URL`, and runs only
on manual/scheduled events; fork pull-request CI has no application secrets.
No paid service or extra pipeline job is introduced.

The five main read tables total **102,674,267 bytes of row JSON**: Signal
83,250,383; Citation 7,243,766; Item 4,949,361; Link 3,115,099; reader matches
4,115,658. This is not exact billed transfer. At that fixed size the principal
payload is about 75 GB for 730 hourly reads, or 3.18 GB for 31 daily reads, before
other tables, result encoding, compression, retries, UI use, and corpus growth.
The Free [network allowance is 5 GB/month](https://neon.com/docs/introduction/network-transfer);
exhaustion suspends compute. The daily choice has limited planning headroom and
requires observed usage, while hourly full-graph reads are not budget-qualified.

At the September 7 pre-run dashboard check, Zis showed **0.87/100 CU-hours**,
**0.1/0.5 GB storage**, and **0.13/5 GB network transfer**, with production fixed
at 0.25 CU. The dashboard says metrics may lag by an hour; these totals are not a
per-run measurement. At the September 6 measured 175-second runtime plus a
five-minute tail, 31 daily wakes cost about 1.02 CU-hours, excluding UI use.
The daily tradeoff is missing some content from short-lived feed windows.

## Production follow-up

[Run 34084462602](https://github.com/SaKaNa-Y/Zis/actions/runs/34084462602) manually
verified the deployed publication-time correction against `7b14fb7` and completed
successfully at `2026-09-07T04:50:43Z`. It restored the pinned model cache and
processed 67 Sources / 67 outcomes / 5,392 Items. The measured Neon wake through
prune was **110,334 ms**, below the 120,000 ms target. This one result does not
establish a future upper bound or invalidate the previously recorded overages.
[CI run 34084435997](https://github.com/SaKaNa-Y/Zis/actions/runs/34084435997) passed.

A read-only query confirmed the saved dates and entries: September 5 has 79
(65 Interest / 14 convergence), September 6 has zero, and September 7 has zero.
The authenticated production browser displays Monday, September 7 and the real
empty Brief. Anonymous root and `/earlier/2026-09-07` requests both returned 401.

The daily workflow's configuration tests failed before the schedule was added
and passed afterward. The full suite still passes 392 tests in 34 files, and
there remains exactly one scheduled workflow and one sequential ingestion job.
The schedule and documentation passed Standards and Spec review. The daily
trigger is published on `main` on September 7; its next nominal scheduled start
is September 8 at 06:17 China time. #91 is closed with the verified manual proof,
explicit public-repository exception, and freshness correction recorded.

#92 remains open for the first genuine scheduled run, first-24-hour usage,
incremental reads, and a measured case for restoring hourly frequency. A manual
run must not be described as a scheduled-run proof. Historical publication and
snapshot/migration-order qualifications remain in the original proof record.
