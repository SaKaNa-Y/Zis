# Ingestion pipeline spec — stages, schedule, and table shapes

Settled by [Specify the ingestion pipeline](https://github.com/SaKaNa-Y/Zis/issues/8).
Read [`docs/security-model.md`](./security-model.md) before writing anything that
fetches, and the clustering spec on `prototype/clustering-spike` before touching
canonicalization — this document specifies *when* stages run and *what state they
keep*, and defers the canonicalization rules themselves to that spec.

The binding constraint is **compute, not storage**, and the unit of compute is the
**Neon wake** rather than the query — see
[ADR-0008](./adr/0008-the-neon-wake-is-the-unit-of-compute-cost.md), which every
number here follows from.

---

## 0. Three premises of the ticket that were wrong

Recorded because each one was load-bearing in the design that preceded it.

1. **"Vercel Hobby is 10s default / 60s max."** Wrong. With fluid compute (on by
   default) Hobby is **300s default and 300s maximum**
   ([docs](https://vercel.com/docs/functions/configuring-functions/duration),
   updated 2026-07-01). The ticket's main argument for splitting the pipeline
   across several crons — that function timeouts force it — does not exist.
2. **"Per-source cadence cuts compute."** Wrong, and backwards. Neon's
   5-minute idle tail is charged **per wake**, so a Source polled rarely saves
   nothing; the compute is spent by the wake that asks "who is due". Implemented
   as several cron schedules it would *increase* cost.
3. **"Fetch, cluster and summarize could be one long run or separate
   schedules."** The first is right, but not for the stated reason. They are one
   run because separate schedules mean separate wakes.

A fourth constraint the ticket did not consider: this repo is **private**, so
GitHub Actions is capped at **2,000 free minutes/month**, not unlimited. A
15-minute cron is 2,880 runs/month and breaches that on job count alone.

---

## 1. Where the pipeline runs

**A Node script inside the GitHub Actions runner, connecting to Neon directly.
Vercel serves only the UI.**

The deciding argument is not the duration headroom — 300s would probably have been
enough. It is that the alternative requires a permanently public,
shared-secret-authenticated route whose only purpose is to be poked by a machine,
and #7 established that an exemption from the auth boundary is the shape a bypass
takes. **Removing a route beats hardening one.** After this decision the only
route not session-gated is login.

Consequences:

- `docs/security-model.md` §5 no longer describes a cron endpoint; there isn't one.
- No duration ceiling, and no cold start on the request path.
- DB credentials exist in two places (Vercel env vars for the UI, Actions secrets
  for the pipeline). Accepted cost.
- `safeFetch` and the canonicalization cascade must be importable by both the
  Next.js app and the runner script — one implementation, two entry points. A
  second copy in a standalone script is the failure mode to guard against, because
  #6 established the cascade as where bugs actually live.

---

## 2. Schedule

**One cron. One wake. Hourly.**

```yaml
# .github/workflows/ingest.yml
on:
  schedule:
    - cron: '17 * * * *'   # hourly, deliberately off the hour
  workflow_dispatch:        # manual trigger, and the entry point for --backfill
```

Offset to `:17` rather than `:00` because every naive scheduler on the internet
fires on the hour, and origin politeness is a hard rule here (#2), not a nicety.

**Why hourly and not 15 minutes.** Nothing in Zis renders faster than daily: one
Brief per local day, sealed once cut. A Signal needs two independent Publishers to
converge before it can be admitted at all, which takes longer than an hour by
definition. 15-minute polling buys no product property and breaches both free
tiers. Hacker News is the only Source with any claim to tighter polling — it is
the highest-yield Source in the corpus (438 Citations, 229 thread resolutions) and
its front page churns several times a day — but it churns on a scale of hours, not
minutes, and a story that appears and vanishes inside one hour was never going to
be co-cited.

**Why not daily.** A single daily poll loses most of HN and TLDR, whose feed
windows are shorter than a day.

**The daily Brief cut is not a second schedule.** The hourly run checks whether
the reader's local cut hour has been crossed since the last cut and, if so, runs
the daily stages in the same wake. The `(user_id, local_date)` uniqueness guard
from `ranking-model.md` §7 makes that idempotent and safely retryable. A second
cron would cost a second 5-minute tail every day for no gain.

---

## 3. Stages

The ticket proposed `fetch → normalize → canonicalize → dedupe → cluster → score
→ summarize`. Three corrections: there is **no dedupe stage** (canonicalization
resolves duplicate addresses into one `Link`, which is the dedupe), there is **no
score** (ADR-0006 — admission is absolute bars), and **issue-page hydration** is a
required stage the ordering omitted.

### Hourly

| # | stage | notes |
|---|---|---|
| 1 | **select due** | `WHERE disabled_at IS NULL AND (retry_after_at IS NULL OR retry_after_at <= now())`. No scheduler — see §4. |
| 2 | **fetch** | Per-host serial, global concurrency cap 6. `robots.txt` checked per host *before* fetching. Conditional requests where the Transport supports them. |
| 3 | **normalize** | Transport-specific → `Item`. Natural key and date clamping per §5. |
| 4 | **hydrate** | Aggregator Sources only: fetch the issue page and extract its link list. §6. |
| 5 | **canonicalize** | L1–L5 cascade, unchanged from the clustering spec. Hydrated URLs flow through the identical path. |
| 6 | **citation-worthiness** | Drop reference-only and intra-publisher outbound Citations *before* Strength is counted. |
| 7 | **alias merge** | Deterministic rules only. Never time-gated (ADR-0004). |
| 8 | **strength** | `COUNT(DISTINCT publisher_id)` with the self-citation guard — scoped to the Publisher and keyed on the Signal's target ([ADR-0020](adr/0020-provenance-is-a-property-of-the-story-not-of-a-url.md)). |

### Stage 0 — the host-ownership assertion, which fails the run

Before stage 1, the run asserts
[ADR-0020](adr/0020-provenance-is-a-property-of-the-story-not-of-a-url.md)'s
invariant over the Items already in the corpus:

> Every host a Publisher's own Items are published on must resolve to that
> Publisher, unless it is a **Transport venue host, which is owned by nobody**.

The Transport venue set is **derived from each Source's transport, never listed**.
This is deliberately **not a CI check**: CI has no corpus, so a static check can only
read `source-register.json` against itself, and the hole is only visible once Items
exist. It fails the **ingest run** — ADR-0008 makes the wake the unit of cost, and a
wake that would silently mis-count Strength is worth losing. `clustering-model.md`
§4 records the two silent registry failures this replaces.

### Daily, inside the wake that crosses the cut hour

| # | stage | notes |
|---|---|---|
| 9 | **embed** | New Signals, and Signals whose `Text Basis` rung improved. |
| 10 | **match Interests** | `MAX` cosine over the reader's separately-embedded Interests (ADR-0003). |
| 11 | **admission** | Two absolute routes: `interest` at Strength ≥2 with a match, `convergence` at Strength ≥3 without (ADR-0006). |
| 12 | **cut Brief** | Every un-briefed Signal clearing Admission. Then sealed. |
| 13 | **summarize** | **Admitted Signals only.** |
| 14 | **prune** | Retention tiering, §9. |

**Summarizing only what makes the Brief** is the difference between ~10 DeepSeek
calls a day and ~1,400, and it is what makes #3's $0.40–0.63/month estimate true
rather than aspirational.

**The summary is written in English, regardless of the Item's language**
([#24](https://github.com/SaKaNa-Y/Zis/issues/24)) — a fixed property of the
prompt, not a reader preference. DeepSeek is strong at Chinese, so this is a
refusal rather than a limitation, on three grounds. A Brief is **sealed** (#14), so
summary language is baked at cut time and can never be changed for a past Brief;
switching later would leave Earlier bilingual by accident of which day each Brief
was cut. A translated summary whose title links out to an English origin
(`ui-and-ia.md` §3) is a **translation layer the product never announced**, which
cuts against #14's honesty principle in the one place it is load-bearing. And
making it a preference fails ADR-0009's admissibility test directly: different
summary text is different information.

**No window is needed to decide what "today's Brief" contains.** ADR-0007 gives
each Signal at most one Brief ever, and `ranking-model.md`'s 7-day cutoff handles
staleness, so the cut considers *every un-briefed Signal that clears Admission* —
no 24-hour window, no top-N.

**One accepted coupling, named because it is the sharpest failure mode here.**
Embedding runs inside the cut, so an embedding-provider outage yields a thin Brief
that then **seals** that way. Accepted for v1 rather than paying for hourly
embedding to decouple it; if it fires in practice, moving stage 9 to the hourly
run is the fix and it costs no extra wake.

### Transaction boundaries

**Commit per Source.** Each Source's Items and Citations land in their own
transaction; stages 5–8 run as one transaction at the end over whatever committed.
The natural key (§5) makes re-running free, so a failed Source is retried next hour
with nothing to undo. All-or-nothing would let one flaky origin starve the corpus
indefinitely.

---

## 4. Cadence is uniform; deferral is per-Source

**There is no `poll_interval_minutes` column, and no scheduler.** Curated
per-source cadence was cut: it saves zero CU-hours (ADR-0008), and with the
validator cache a Source that hasn't changed costs exactly **one 304**.

The Transports split cleanly, and the split is the argument. Probed live:

| Transport | conditional request | evidence |
|---|---|---|
| RSS / Atom | **yes** | `etag` / `last-modified` widely present; #2 requires byte-identical query params so 304s actually fire |
| HN Firebase | **no** | returns `Cache-Control: no-cache`, no validator |
| Bluesky AppView | **no** | returns `Cache-Control: public, max-age=30`, no validator |
| GitHub GraphQL | **no** | POST; cannot 304 |

So the 304-able majority is cheap to poll hourly, and the Sources that *cannot*
304 are exactly the ones no one wanted throttled. A curated cadence would have
bought nothing and cost a column, a scheduler, and a decision per Source during
curation.

**What does survive is `retry_after_at`** — a different thing wearing similar
clothes. Cadence would be *our* schedule; `retry_after_at` is *the origin's*
instruction (`Retry-After`, `x-poll-interval`, both mandatory under #2) plus our
own failure backoff. One is a knob we don't need; the other is politeness we are
already required to implement.

---

## 5. Idempotency, and dates that lie

**Natural key: `UNIQUE (source_id, external_id)`**, where `external_id` is the
Transport's own identifier — RSS `guid`, HN item id, Bluesky AT-URI, GitHub
release tag.

- **No `guid`?** Fall back to the canonicalized URL, and only then to
  `hash(title + link)`.
- **Edited upstream?** Update `title` and `summary` **in place; never re-key.**
  Existing Citations stand, because a Citation is a historical claim about what an
  Item linked to. A Brief Entry that already froze the old text keeps showing it —
  which sealing makes correct rather than a compromise.

**Dates.** Several verified feeds carry unreliable dates: TLDR has an item dated
2018, Render a *future*-dated one, Lea Verou interleaves 2009 items among current
ones.

- Store the raw feed value **and** `published_at = min(feed_date, fetched_at)`,
  which clamps future dates for free.
- **Never trust feed ordering.** Sort only on the normalized column.
- **Do not reject old items at ingestion.** The seed backfill wants them, and the
  7-day cutoff already stops a 2009 item from reaching a Brief. Filtering at
  ingestion would break backfill to fix a display bug.

---

## 6. Issue-page hydration

**A required stage, not an enhancement.** Seven of the highest-value aggregators
(JavaScript Weekly, Node Weekly, React Status, Frontend Focus, TLDR, This Week in
Rust) publish **excerpt-only** feeds — the link lists that make them valuable are
not in the feed. Measured in the #6 prototype: **820 links recovered from 24
issues**, and JavaScript Weekly appears as a voter in 5 of the top clusters.

- **No cap.** The prototype's 24-issue cap was a guard against a runaway fetch
  loop, and the validator cache dissolves what it guarded: an issue page is
  immutable once published, so it is hydrated **once ever**, not once per run.
  Steady state across 7 aggregators is one or two new issues a day.
- **Position: after normalize, before canonicalize** (stage 4), so hydrated URLs
  flow through the identical L1–L5 cascade rather than a parallel path.
- **`is_aggregator` is an explicit flag** on the Source, never inferred from the
  host.
- Subject to `robots.txt` and `safeFetch` like every other fetch. No exemption.

---

## 7. Failure and dormancy are two signals, with two consequences

Consecutive-failure counting catches dead feeds. It **cannot** catch dormant ones:
of 137 probed feeds, **9 were dead and 4 more were alive but dormant for 1–3
years**, and a dormant feed returns valid content forever.

| signal | source | consequence |
|---|---|---|
| **failing** | `consecutive_failures` | exponential backoff into `retry_after_at`; **auto-disable at 10** |
| **dormant** | `newest_item_at` older than **6 months** | **flagged for review, never auto-disabled** |

10 failures with backoff spans days rather than minutes, so a long origin outage
does not kill a good Source. Dormancy never auto-disables because a quarterly blog
is legitimately quiet — a Publisher's silence is not a fault.

**The mechanism that makes the split work is one asymmetry: a 304 counts as
success for the failure counter but must not touch `newest_item_at`.** That single
rule is the whole dormant-versus-dead distinction; get it wrong and every dormant
feed reads as healthy forever.

---

## 8. Table shapes

### `source`

```
id                    uuid pk
publisher_id          uuid not null references publisher
transport             enum('rss','atom','hn_firebase','hn_algolia','github_graphql','bluesky_feed')
endpoint_url          text not null unique
is_aggregator         boolean not null default false
disabled_at           timestamptz null
disabled_reason       text null
consecutive_failures  integer not null default 0
retry_after_at        timestamptz null
last_polled_at        timestamptz null
newest_item_at        timestamptz null   -- freshness only; a 304 must NOT touch this
created_at            timestamptz not null default now()
```

No `poll_interval_minutes` (§4). No `etag` / `last_modified` — those live in
`http_cache`, keyed by URL. The `host → publisher_id` UNIQUE constraint that the
self-citation guard depends on lives on `publisher`, not here; without it a
Publisher can vote on its own changelog (#6).

### `source_fetch_log`

The whole observability story at this scale — Sentry plus this table, with the
full stack ruled out of scope.

```
id             bigserial pk
source_id      uuid not null references source
started_at     timestamptz not null
duration_ms    integer not null
outcome        enum('ok','not_modified','http_error','timeout',
                    'robots_denied','parse_error','too_large') not null
http_status    integer null
items_seen     integer not null default 0
items_new      integer not null default 0
bytes          integer not null default 0
error_message  text null

index (source_id, started_at desc)
```

Volume at 47 Sources hourly: ~1,128 rows/day, ~34k/month — trivial against 0.5 GB.
Pruned at 30 days. **Log 304s too**: they are the evidence a Source is alive, and
dropping them to save rows destroys the dormancy signal.

### `http_cache`

```
url            text pk        -- canonicalized
etag           text null
last_modified  text null
last_status    integer null
fetched_at     timestamptz not null
```

**Validators only. Never bodies.** One store rather than two because there are two
fetch populations — Sources, and arbitrary URLs (the ≤120 `rel=canonical` fetches
and the issue pages, which have no Source row) — and the arbitrary-URL population
is the larger one. Two stores would be two implementations of the same 304 handling.

This looks like it conflicts with ADR-0005, and doesn't. Under ADR-0005 no
publisher HTML is stored, so a 304 has nothing to serve *from* — but what a 304
lets us skip is not re-serving content, it is **re-extracting** it: the Citations
pulled from that issue page are already persisted rows, and `Item.text` under the
30-day tier is the only text store. A 304 on a hydrated issue page means "your
Citations are still current, do nothing."

### `robots_cache`

Separate from `http_cache` because it is keyed by **host**, not URL, and because
the failure modes are opposite: a stale `http_cache` entry causes a redundant
fetch, while a wrongly-permissive robots entry causes a policy violation.

```
host           text pk
verdict        text not null          -- 'allow' | 'disallow' | 'ambiguous'
directives     jsonb not null
status         int not null
content_type   text null
waf_action     text null              -- e.g. 'challenge', 'captcha'
authoritative  boolean not null
fetched_at     timestamptz not null
expires_at     timestamptz not null   -- 24h TTL
```

`verdict` is **stored, not inferred from an empty `directives`** — an empty
ruleset and no obtainable ruleset are opposite facts, and #29 found a host
(`arstechnica.com`) that returns the first while meaning the second.

**Fail closed, and the answerable responses are a positive whitelist**
(ADR-0014). Only two responses yield a verdict; everything else is `ambiguous`:

| response | verdict |
|---|---|
| 200 + `text/plain` | **parse and obey** |
| **any 404** | **allow** — the file is absent, so nothing is restricted. Body and content-type are **irrelevant**: 18 of the 19 `404-ALLOWED` hosts in the corpus serve `text/html` on that 404, and one of them (`feeds.arstechnica.com`) serves 518 KB of it |
| 200 + any other content-type | **deny** — `openhome.bilibili.com/robots.txt` returns 200 with `text/html`, so a parser trusting the status code finds no `Disallow` and concludes "allowed" (#16) |
| 2xx other than 200, or a zero-length 2xx | **deny** — `arstechnica.com/robots.txt` answers 202, `Content-Length: 0`, `x-amzn-waf-action: challenge`, and an empty body parses as an empty ruleset, i.e. as "allowed" (#29) |
| 4xx other than 404, 5xx, timeout, TLS failure | **deny** — `feed.infoq.com` answers 406 `application/json`; `hnrss.org` failed a TLS handshake once and allowed all on retry, so a transport error is not a verdict either |

The asymmetry between the 200 and 404 rows is the whole rule: **on a 200 the body
*is* the ruleset**, so content-type is load-bearing; on a 404 there is no ruleset
to misparse. A soft-404 is dangerous when it returns **200** for missing content.

Both directions of the parser have to be right. `hacker-news.firebaseio.com`
serves `Allow: /*.json$` **above** `Disallow: /`, so `/v0/topstories.json` is
allowed **only** to a parser doing `*` wildcards, `$` anchoring, and
longest-match-wins with Allow beating Disallow on ties — a line-prefix matcher
fails *closed* on the highest-yield Source in the corpus (#29).

And separately: **HTTP 200 is necessary but not sufficient proof of content** — a
robots-*allowed* Bilibili page returned 200 carrying a captcha interstitial. That
applies to feed validation generally, not just to robots.

### The verdict is per host, and perishable

**Per host** (ADR-0014): a verdict binds the host that served it, and there is no
Publisher-level inheritance **in either direction**. A sibling host's readable
file cannot clear an unreadable one, and an unverifiable apex cannot condemn a
subdomain that answered — `feeds.arstechnica.com` is allowed while
`arstechnica.com` is not. A Source is usable when **the hosts it actually fetches**
are cleared, which for an ordinary RSS Source is the feed host alone: stage 4 is
the only fetch of a publisher page and it is Aggregator-only.

**Perishable**: four ordinary tech hosts added a blanket `Disallow: /` inside
three years (Lobsters 2024, Changelog late-2025, The Register 2026, YouTube's feed
path by 2025). So the TTL expires rather than a boolean persisting, and hosts are
re-probed — including hosts that previously yielded no verdict at all.

**And obtainable by this pipeline's egress.** A file readable only from a
workstation is state the sweep can never refresh, and a host that challenges the
runner on `robots.txt` will challenge it on the fetch that follows.

### The Source register: three states

The corpus record that sits above these verdicts has **three** states, not two
(ADR-0014):

- **in** — every host the Source fetches has an `allow` verdict.
- **excluded-on-policy** — a quoted `Disallow` or `Content-Signal` directive.
- **`unverifiable`** — no verdict is obtainable. Carries the *evidence of
  unanswerability* where an exclusion carries a directive.

`ambiguous` is the per-response verdict above; `unverifiable` is the register word
for a host that yields nothing else. An `unverifiable` host is **not a Source** —
it is re-probed on the ordinary TTL and nothing waits on it.

Register columns, one row per host: `host`, state, `status`, `content_type`,
`waf_action`, `probed_at`, and the quoted directive where one exists. Populating
it is [Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11)'s
deliverable; the columns are fixed here so a host that is recorded but unused
(`arstechnica.com`) has somewhere to live.

---

## 9. Retention

Tiered from day one: **full text ~30 days**, then title + canonical URL + summary
+ embedding retained indefinitely.

Pruning runs as stage 14, inside the daily wake. No separate schedule.

**This window must not be shortened to buy Brief density.** It is irreversible
under ADR-0005 — the corpus can never re-fetch what rolled off, which is the
retention wall #6 already hit — 3,607 of 4,986 Signals already carry no ingested
text for Interest matching, and the resource it would free is compute, which is the
one thing shortening it does not save. Items per day is a function of Source count,
cadence, and *publisher-side* feed retention, never of our own pruning window.

The corpus converges rather than grows: full text is bounded at ~30 days of
ingestion, and the permanent tier is a few hundred bytes per Signal. The 384-dim
`halfvec` choice from #3 is what keeps the embedding column at ~82 MB/yr instead of
~657 MB/yr, which alone would exceed the free tier within a year.

---

## 10. Fetch concurrency, and why it is a compute decision

**Per-host serial, global concurrency cap 4–6, with a stated budget that a normal
run completes in ≤2 minutes.**

#2 requires "serial rather than concurrent" fetching. That is politeness toward a
given *origin*, not a global rule, and the 47 Sources span ~44 distinct hosts. Per-
host serialism honors the actual intent — no origin ever sees two overlapping
requests from Zis — while a cap of 6 across 44 hosts still leaves every host polled
one at a time.

**Strictly global serialism costs double the compute to protect nobody**, because
the hosts are disjoint. This is the stage where run duration and the CU budget turn
out to be the same variable (ADR-0008): a ~10-minute globally-serial run bills a
15-minute wake, 45 CU-hours/month, against 21 for a ≤2-minute run.

**The ≤2-minute budget belongs in this spec as a number**, because it is what keeps
§11 true and it will otherwise rot silently as Sources are added.

---

## 11. The CU-hour estimate

| | value |
|---|---|
| Cadence | hourly, one cron, one wake — 24/day |
| Wake cost | ≤2 min run + 5 min idle tail = **7 min** |
| Per day | 168 min = 2.8 h |
| Per month | 84 h → **21 CU-hours** at a pinned 0.25 CU |
| Neon free cap | 100 CU-hours/project/month |
| Headroom for UI | ~79 CU-hours ≈ 316 h of 0.25-CU compute |
| GitHub Actions | 720 runs/month ≈ 720–1,440 min against 2,000 free (private repo) |
| Storage | 0.5 GB cap; ~82 MB/yr of embeddings plus a 30-day text window |

Two provisioning requirements this arithmetic depends on:

- **Pin the compute to a fixed 0.25 CU (min = max).** Neon's free tier autoscales
  to 2 CU, which would multiply every figure here by up to 8.
- **Scale-to-zero cannot be disabled on the free plan** (5 min, fixed) — which is
  what makes the tail a constant rather than a tunable.

For comparison, and to record why 15 minutes was rejected: 96 wakes/day at the same
7-minute cost is 672 min/day = **336 h/month = 84 CU-hours**, leaving 16 for the UI,
plus 2,880 Actions runs against a 2,000-minute cap.

---

## 12. Backfill

**A mode of this pipeline, not a separate script** — a `--backfill` flag that
ignores `retry_after_at`, walks deeper feed windows, and **skips the Brief cut
entirely**. A separate script would be a second implementation of the
canonicalization cascade, which #6 established as where the real bugs live.

It runs under the same `safeFetch` and `robots.txt` rules, with the 7-day cutoff
applied so a years-deep window fills the Citation graph without dumping a year of
stories into Brief #1. Cost is one long wake, once — negligible.

**It must run before the first Brief is ever cut**, or Brief #1 seals against an
empty Citation graph.

---

## 13. Transport notes that bind

- **GitHub releases require authentication to work at all.** The #6 prototype got
  **403 on every release fetch** (`facebook/react`, `vercel/next.js`,
  `microsoft/TypeScript`, `nodejs/node`, `rust-lang/rust` — 0 items each). Use
  authenticated **GraphQL**: #2 verified ~1 point per 100 repos out of 5,000/hr,
  and authenticated 304s cost zero points. Dropping the Transport is not free —
  #6's `announcement→cited-release-tag` alias rule produced 15 bridges and travels
  *on* release-tag URLs. The credential is a **fine-grained PAT scoped to public
  read only**, and it **expires** — a new operational surface worth naming here
  rather than discovering when it lapses.
- **`hnrss.org` is banned as a Transport**, in the same shape as the `rsshub.app`
  exclusion. It duplicates the dedicated HN adapter, and because it is a
  *different host* the `host → publisher_id` UNIQUE constraint cannot catch it —
  ingesting both sides inflates the distinct-Publisher count that all of ranking
  rests on. Simon Willison's three overlapping feeds (`everything` / `links` /
  `entries`) need no new rule: they share a host, so that constraint already forces
  them into one Publisher.
- **XML parsing: the rule, not the library.** Byte cap enforced **before** the
  parser sees input, no DTD, no entity expansion. The contract is a **test that
  feeds a billion-laughs payload and asserts rejection** — verified, not assumed.
  Name a library as a starting point; the test is what survives a swap.
