# The Neon wake, not the query, is the unit of compute cost

Status: accepted; cadence and transfer constraint amended 2026-09-07

Neon's free plan suspends a compute after **5 minutes of inactivity and the
timeout cannot be disabled**, so a wake costs `(time between the first and last DB
touch) + 5 minutes` regardless of how little work happened inside it. The compute
budget is governed by wake count and wake duration. **Network transfer is an
independent constraint**: the September 7 production measurement below supersedes
the original claim that compute was the only constraint on scheduling.

This is worth an ADR because the intuition it violates is a strong one. The
obvious way to economize on a database is to issue fewer and cheaper queries, and
here that buys **nothing**: one query and ten thousand queries cost the same
5-minute tail. Several plausible optimizations are actively harmful under this
rule, and each one looks like a saving right up until the arithmetic is done.

## What follows from it

- **One cron, not several.** Splitting fetch, cluster and summarize across
  separate schedules multiplies the tail by the number of schedules. The daily
  Brief cut therefore runs *inside* the ingestion wake rather than on its own
  schedule.
- **Per-Source polling cadence saves nothing and was cut.** A rarely-polled Source
  does not reduce wakes, because the wake is what asks "who is due". Implemented as
  several cron schedules it would *increase* cost. What survives is
  `retry_after_at`, which is the origin's instruction rather than our schedule.
- **Run duration is a compute variable.** This is the counterintuitive one:
  fetching is I/O against other people's servers and feels free, but the DB is
  billed for the whole span it is held open across. Globally serial fetching (~10
  min) bills a 15-minute wake — 45 CU-hours/month — where per-host-serial fetching
  with a concurrency cap (~2 min) bills 7 minutes and 21 CU-hours. Hence a stated
  ≤2-minute budget for a normal run.
- **"Read state, fetch for ten minutes, write results" is the worst possible
  pattern**, and it is the one a careful engineer reaches for. Because the idle
  timer resets on every access, opening the DB at the start and again at the end
  bills the entire fetch window in between. Closing the connection during the
  fetch does not help; only *shortening the span* does.
- **The compute must be pinned to a fixed 0.25 CU (min = max).** The free tier
  autoscales to 2 CU, which multiplies every figure above by up to 8.

## Consequences

- The repository was verified public on 2026-09-05. The former private-repository
  Actions-minute ceiling no longer applies to standard runners. This changes
  neither the Neon wake budget below nor the requirement for one sequential
  pipeline; hourly activation and transfer optimization remain work in #92.
- Hourly polling costs ~21 CU-hours/month against a 100 CU-hour cap, leaving ~79
  for UI usage. 15-minute polling would cost ~84 and leave 16.
- Any future proposal to poll more often, add a schedule, or lengthen a run is a
  **compute-budget change** and must be argued as one. A "small extra cron" is
  never small: it is 150 CU-hours/month if it fires every 15 minutes.
- The rule outlives the specific numbers. If Zis moves off the free plan the tail
  may change or vanish, but until then wake count is the budget.
- This does **not** license shortening the 30-day full-text retention window to
  save resources. Storage is not the constraint, so pruning more aggressively
  spends an irreversible asset (ADR-0005) to relieve a limit that is not binding.

## September 7 amendment: daily until transfer is incremental

The owner selected one daily run at **06:17 Asia/Shanghai** as the immediate
production cadence. It retains one sequential job, `workflow_dispatch`, and
`cancel-in-progress: false`. This temporarily supersedes the hourly cadence;
adding a second daily-cut schedule remains disallowed.

The current reader loads the whole corpus every wake. Five principal tables
serialize to **102,674,267 bytes** of row JSON, including **83,250,383 bytes** of
Signals. This is a scale estimate, **not measured billed egress**: HTTP encoding,
compression, other tables, result metadata, retries, and growth affect the actual
transfer. Repeating that principal payload 730 times is about 75 GB; 31 daily
reads are about 3.18 GB. Neon's [network-transfer documentation](https://neon.com/docs/introduction/network-transfer)
sets the Free allowance at **5 GB/month** and states that exhausting it suspends
compute. The September 7 dashboard showed 0.13/5 GB consumed; that delayed metric
does not establish a per-run rate. Daily fits the current planning estimate with
limited headroom and needs observation; hourly does not have a credible free-tier
budget yet.

At the observed September 6 duration of 175 seconds plus a 300-second idle tail,
31 wakes cost about **1.02 CU-hours** at 0.25 CU, excluding UI traffic. The original
120-second target still applies and the observed overage remains disclosed.

The tradeoff is reduced coverage of feeds whose entries disappear within a day.
Do not shorten retention, weaken Admission, export the private reader corpus to a
public cache, or enable a paid plan to hide that tradeoff. #92 must measure the
first scheduled run and the first 24 hours, then make reads incremental before
reconsidering the single hourly schedule.
