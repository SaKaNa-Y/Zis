# The Neon wake, not the query, is the unit of compute cost

Status: accepted

Neon's free plan suspends a compute after **5 minutes of inactivity and the
timeout cannot be disabled**, so a wake costs `(time between the first and last DB
touch) + 5 minutes` regardless of how little work happened inside it. Compute
(CU-hours), not storage, is what breaks first for Zis — so **the scheduling design
is governed by wake count and wake duration, and by nothing else.**

This is worth an ADR because the intuition it violates is a strong one. The
obvious way to economize on a database is to issue fewer and cheaper queries, and
here that buys **nothing**: one query and ten thousand queries cost the same
5-minute tail. Several plausible optimizations are actively harmful under this
rule, and each one looks like a saving right up until the arithmetic is done.

## What follows from it

- **One cron, not several.** Splitting fetch, cluster and summarize across
  separate schedules multiplies the tail by the number of schedules. The daily
  Brief cut therefore runs *inside* an hourly wake rather than on its own
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
