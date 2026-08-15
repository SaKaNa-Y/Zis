# 07 — Specify the ingestion pipeline

Type: grilling
Status: open
Blocked by: 01, 04, 06

## Question

All-polling on a 15-minute cron, no queue. Specify the pipeline concretely
enough to build, given the compute arithmetic below.

**The binding constraint.** Neon suspends compute after 5 minutes idle, so
**every cron wake bills a 5-minute minimum**. At 15-minute intervals that's
~240 active hours/month ≈ 60 CU-hours at 0.25 CU, against a 100 CU-hour free
cap — before any UI usage. **Compute budget, not storage, is what breaks
first.** Verify this arithmetic and let it drive the design.

Settle:

1. **Scheduling.** Does every Source poll every 15 minutes, or do Sources carry
   individual cadences (HN every 15 min, a low-traffic blog daily)? Per-source
   cadence cuts compute and is politer to origins — but adds a scheduler. Where
   does "which sources are due" live?
2. **One cron or several?** Fetch, cluster, and summarize could be one long run
   or separate schedules. Vercel function timeouts (Hobby is 10s default / 60s
   max — **verify**) may force a split. Note the GitHub Actions runner has no
   such limit, which is an argument for doing heavy work *in* Actions and having
   Vercel serve only the UI.
3. **Idempotency.** Re-running a fetch must not duplicate Items. Natural key per
   source type — GUID for RSS, item id for HN, URI for Bluesky. What when a feed
   has no GUID? What when an article is edited upstream?
4. **Conditional fetching.** `ETag` / `If-Modified-Since` per source, so
   unchanged feeds cost one 304. This is the single biggest efficiency win and
   the politest behaviour toward origins.
5. **Failure handling.** A source that 404s, times out, or returns garbage.
   Consecutive-failure counter, exponential backoff, auto-disable after N
   failures with a visible surface so a dead source doesn't fail silently
   forever. `source_fetch_log` table shape — this is the whole observability
   story at this scale.
6. **Retention.** Tiered: full text ~30 days, then title + canonical URL +
   summary + embedding. Where does the pruning job run, and is it a separate
   schedule? Confirm the corpus converges rather than grows.
7. **Ordering.** Fetch → normalize → canonicalize → dedupe → cluster →
   score → summarize. Does summarization run in the same pass as clustering, or
   once daily just before the brief is assembled? Summarizing only what makes
   the brief is far cheaper than summarizing everything.

Deliverable: a written pipeline spec with stage boundaries, the cron schedule(s),
the `source` and `source_fetch_log` shapes, and the CU-hour estimate that falls
out of the chosen cadence.

## Requirements surfaced by source research

From [candidate-sources-rss.md](../research/candidate-sources-rss.md):

- **Issue-page link extraction is a required pipeline stage, not an
  enhancement.** Seven of the highest-value aggregators (JavaScript Weekly, Node
  Weekly, React Status, Frontend Focus, TLDR, This Week in Rust) publish
  **excerpt-only** feeds — the link lists that make them valuable are *not in the
  feed*. Their cited URLs only come from fetching the issue page. Without this
  stage the co-citation corpus loses most of its cluster-forming power. The fetch
  is subject to Ticket 01's robots.txt rule like any other.
- **Defensive date handling.** Several verified feeds carry unreliable dates —
  TLDR has an item dated 2018, Render a *future*-dated one, Lea Verou interleaves
  2009 items among current ones. Clamp future dates to now, don't trust feed
  ordering, and sort on a normalized timestamp.
- **Guard against double-counting one voice.** Simon Willison publishes three
  overlapping feeds (`everything` / `links` / `entries`) and hnrss duplicates the
  dedicated HN adapter. Ingesting both sides of either pair inflates the
  distinct-source count that ranking depends on. The `source` model needs a way
  to express "these are the same voice" — or the curation step must guarantee it
  never happens.
- **Dead-source detection has a measured baseline**: of 137 probed feeds, 9 were
  dead and 4 more were alive but dormant for 1–3 years. A dormant feed returns
  valid content and never updates, so consecutive-failure counting won't catch
  it. Consider a staleness signal (newest item older than N months) distinct from
  a failure signal.

