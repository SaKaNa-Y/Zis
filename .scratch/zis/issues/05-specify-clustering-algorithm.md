# 05 — Specify the clustering algorithm

Type: prototype
Status: open
Blocked by: 01, 04, 13

## Question

URL co-citation is the clustering spine. It is the product's differentiator and
the one piece that must be *right*, so it gets a prototype rather than a
discussion — run against real fetched data from HN, a few RSS feeds, and
Bluesky.

**Part 1 — URL canonicalization.** Two Items cluster when they cite the same
canonical URL, so canonicalization *is* the algorithm. Specify and test:

- Strip tracking params (`utm_*`, `ref`, `fbclid`, `gclid`, …) — allowlist or
  denylist? A denylist is safer: stripping an unknown param can change what the
  URL points at.
- Resolve redirects and unwrap shorteners (`t.co`, `bit.ly`, `buff.ly`). **How
  many hops before giving up, and how does this interact with the SSRF
  validator in Ticket 06?** Every redirect hop needs re-validating.
- Normalize scheme, host case, `www.`, trailing slash, default ports, fragments.
- Decide the hard cases: does `?page=2` matter? AMP URLs vs canonical? A repo
  URL vs that repo's releases page? `news.ycombinator.com/item?id=…` is a
  *discussion of* a URL, not the URL — the HN thread and the blog post it links
  must land in the same cluster.

**Part 2 — cluster formation.** Given canonical URLs, when is a Signal emitted?

- Time window — do citations 3 days apart cluster? Rolling window or daily
  batch?
- Does an Item's *own* URL and the URLs it *links to* both count as citations?
  (An HN post's `url` field is a citation of the target.)
- Self-citation guard: five posts from one source citing the same URL is not
  five sources agreeing.

**Part 3 — embedding second pass.** For Items sharing no URL. Similarity
threshold, and how a threshold gets tuned without a labelled dataset. Prove the
second pass earns its complexity — **if URL co-citation alone produces good
clusters on real data, say so and cut embeddings from v1 entirely.** That would
also void the embeddings half of Ticket 02, which is a good outcome, not a
setback.

Deliverable: a throwaway script over real fetched data, plus a written spec of
the canonicalization rules and cluster-formation conditions. Report false
positives and false negatives found on real data — the failure modes matter more
than the happy path.

## Acceptance criteria

From the prior-art study
([rss-reader-prior-art.md](../research/rss-reader-prior-art.md)). These are the
four documented failure modes of **memeorandum** — Techmeme's engine run without
its 26 editors. They are the bar this prototype must clear, because at 5–10
slots/day each one is a 10–20% quality regression:

1. **No unmerged duplicate clusters** — the same story must not occupy two slots.
2. **No stale items at the top** — needs temporal decay, so old clusters stop
   absorbing new arrivals and stop outranking fresh ones.
3. **No thin clusters from correlated bursts** — rank by **distinct sources**,
   never total mentions, and suppress bursts from a single origin or from
   accounts resharing each other.
4. **No headline spin** — a cluster title taken verbatim from one source carries
   that source's framing. The LLM naming pass exists partly to fix this.

## Additions to the plan, from prior art

- **Add the two skipped cascade layers.** The layered consensus across production
  systems is: URL normalization → **publisher canonical signals** → content
  fingerprinting → embeddings → **temporal decay**. The map's plan covers layers
  1 and 4 only. Layers 2 and 5 are cheap and must not be skipped; layer 3
  (SimHash/MinHash) is genuinely optional for this corpus.
- **`rel=canonical` can arrive as an HTTP header**, not only a `<link>` tag.
  Prefer it over local normalization when the publisher declares one.
- **Bounded redirect hops — 3 is the commonly cited limit — and re-run the
  unwrap**, because nested shorteners are real (a `bit.ly` re-shortened by
  `ow.ly` then `t.co`).
- **Not every query param is noise.** Sort and pagination params sit alongside
  tracking params. Use an explicit denylist plus per-publisher overrides, never a
  blanket strip.
- **Never delete duplicates — collapse them, preserving provenance** (which
  source, first seen when, via which URL). Canonicalization answers "which
  representation defines the record"; dedup answers "have we seen this." The
  provenance rows *are* the "why this surfaced" explanation, so the clustering
  table and the explainability feature are the same table.
- **Enumerate reshare/alias semantics for every adapter before writing the
  clustering code.** This is where co-citation systems actually die — Sill's
  creator on Nuzzel: *"You'd sometimes see the same post six times in a row."*
  Zis's cases: an HN submission vs its `news.ycombinator.com/item` comments link,
  a GitHub release vs the repo root, a Bluesky repost/quote chain, the same story
  on Lobsters and HN.
- **Prior art for the time window**: Sill uses a rolling 24h aggregation window,
  user-adjustable. Relevant to the signal-lifecycle question.

## Test data

[candidate-sources-rss.md](../research/candidate-sources-rss.md) section (a)
gives **10 concrete expected co-citation clusters** with target distinct-source
counts (React release, TypeScript release, Rust release, Cloudflare week,
frontier-model launch, web-platform feature, Postgres release, viral long-form
post, Node security release). Judge the prototype against these, plus:

- **C6 is the adversarial case — run it first.** An Anthropic announcement is
  cited by 5–7 sources while **Anthropic publishes no feed at all**, so the
  origin URL is never ingested as an item. This tests that clustering keys on the
  **cited URL**, not on URLs Zis happens to have ingested. If this cluster can't
  form, that's a design bug — find it now, not in three months.
- **Negative controls that must NOT cluster**: AWS News during a normal week,
  GitHub changelog items, Hugging Face community posts, Vercel marketing posts.
  All are high-volume and near-zero external citation. If clusters form here, the
  embedding pass is *detecting* rather than *naming* — a direct violation of the
  map's invariant.
- **C4 (Cloudflare week) is the burst stress test** — five posts in one day, which
  exercises temporal decay and the "correlated burst produces thin clusters"
  failure mode.
- **C5 (frontier-model launches) is the interest-filter test** — it fires
  constantly, and without filtering Zis silently becomes an AI-news site.
- **C1 (React) fires only a few times a year** and `react.dev/rss.xml` has 23
  items ever — don't tune thresholds on it alone.

Cross-platform patterns from
[candidate-sources-platforms.md](../research/candidate-sources-platforms.md):

- **The alias rule has two cases that want opposite answers.** In a *framework
  release*, the GitHub release-tag URL and the announcement blog URL are two URLs
  for one event and must join, or one strong cluster splits into two thin ones.
  In a *trending breakout*, the repo root **is** the canonical thing. One rule
  will not serve both; the proposed discriminator is whether a release exists for
  the event at all. Settle this explicitly.
- **Count distinct owning entities, not distinct source rows** — see Ticket 04.
  Vercel on GitHub + YouTube + Bluesky is one vote, not three.
- **Bluesky reposts must not be attributed to the wrong account.** A feed item
  carrying a `reason` field is a repost, and its `post.author` is the *reposted*
  account, not the account queried. Getting this wrong silently inflates the
  distinct-source count.
- **Simon Willison as an evaluation oracle.** He does the co-citation job
  manually at a ~75% external-link rate, usually within hours of an AI launch. If
  Zis's brief and his link stream diverge sharply on a given day, one of them is
  wrong — a cheap ongoing quality test that needs no labelled dataset.
- **Expect thin clusters on infra/database releases**: the explainer videos lag
  by days, so temporal decay will often have closed the cluster before they
  arrive. Two-to-three source clusters are the realistic outcome there, not five.



