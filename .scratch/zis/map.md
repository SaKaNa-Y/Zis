# Zis — Phase 0 Map

Labels: `wayfinder:map`

## Destination

A written **Phase-0 spec** for Zis: product positioning, source set, ingestion
architecture, clustering and ranking model, core entities, security model, and
repo/CI setup — complete enough to slice into build tickets. **No production
code.** Prototypes are throwaway artifacts, not the deliverable.

## Notes

**Domain**: a personal, single-user, bounded daily brief of what actually
mattered in tech. Not an RSS reader. Not an inbox.

**Skills every session should consult**: `/grilling` and `/domain-modeling` by
default; `/research` for AFK research tickets; `/prototype` for UI/logic
questions.

**Standing product constraints** (settled in charting — treat as invariants,
challenge only with a reason):

- **Global-first corpus.** The crawl runs on its own schedule, independent of
  subscriptions. Personal subscriptions are a later layer. AI cost amortizes
  across the corpus, not per user.
- **Bounded output.** At most ~5–10 signals per day. **No unread counts. No
  infinite scroll. No "Everything" tab.** The discipline is the product; an
  escape hatch to the firehose rebuilds the anxiety inbox.
- **Single user, publicly deployed.** No signup route exists at all; the account
  is seeded by migration. **Every route is auth-gated** except login and the
  cron endpoint (shared-secret auth, not session). Responsive web — phone and
  desktop. `user_id` on the six personal-layer tables from day one.
- **Detection is deterministic.** URL co-citation is the clustering spine;
  embeddings are a second pass. The LLM **names and summarizes** clusters, it
  never detects them.
- **Explicit interest model.** Editable free text. Every surfaced item explains
  why it surfaced. This is the direct fix for the thing X gets wrong.
- **No queue infrastructure.** All-polling on a 15-minute cron. No Redis, no
  Inngest/Trigger.dev, no persistent worker. If a source needs streaming later,
  that is one adapter changing, not a re-architecture.
- **Text-first.** Article images stripped at ingestion; one optional thumbnail
  URL per article. Source icons (favicons) fetched once per source. All remote
  image fetches go through the crawler's URL validator.

**Prior-art findings that bind** (from
[rss-reader-prior-art.md](research/rss-reader-prior-art.md) — full mechanism
study of Techmeme, Nuzzel/Sill, Reeder, Feedly, Readwise, TLDR et al.):

- **The co-citation spine is vindicated, but is not sufficient alone.** Techmeme
  runs this exact idea with 26 editors on top; memeorandum is the unedited
  control and produces unmerged duplicates, stale top items, and thin clusters
  from correlated bursts. At 5–10 slots/day one duplicate is a 10–20% quality
  regression. **A refinement layer needs an owner** — LLM merge adjudication over
  candidate clusters, interest-profile filtering, or one-click user merge/kill.
- **Rank by DISTINCT SOURCES citing a URL, never total mentions.** One loud
  account must not be able to manufacture a cluster.
- **Enumerate reshare/alias semantics per adapter before writing clustering
  code** — HN submission vs its comments link, GitHub release vs repo root,
  Bluesky repost chains. This, not embedding math, is where co-citation quality
  actually goes.
- **Never delete duplicates — collapse them, preserving provenance.** The
  provenance record *is* the "why this surfaced" explanation: the clustering
  table and the explainability feature are the same table.
- **The interest profile is the product, not a filter on it.** Nuzzel got
  relevance free from the follow graph; Zis has none, so co-citation alone
  measures general tech salience — which Techmeme already publishes. **Standing
  assumption: the user is willing to write and maintain the profile.**
- **Summary quality will not differentiate.** Placement beats model quality in
  every AI-reader review. The LLM's naming/summarising job is necessary, not the
  reason the product is good.
- **API-first sourcing is a moat, not just a licensing convenience** — 79% of top
  news sites block AI crawlers and Cloudflare catches legitimate readers as
  collateral.
- Add to the clustering cascade: publisher `rel=canonical` (can arrive as an
  **HTTP header**, not only a `<link>`), and **temporal decay** so stale clusters
  stop absorbing new arrivals.

- **Distinct-source counting needs an OWNING-ENTITY dimension.** Vercel's GitHub
  release + YouTube video + Bluesky post are one organization wearing three hats;
  counting them as three lets any vendor manufacture a cluster about itself.
  Vendor posts are provenance, not votes. (Tickets 04, 05.)
- **Bluesky's zero-auth path is narrower than assumed**: `searchPosts` returns
  403 on the public AppView (edge/WAF block, verified twice), so the hashtag and
  search slice is unavailable without auth. `getAuthorFeed` / `getFeed` /
  `getProfile` work fine, so the path is **follow-graph + feed-generator
  polling**, with authed `searchPosts` or Jetstream as escalation.

**Settled stack**: Next.js 16 (App Router) + Drizzle + Neon Postgres, tiered
retention from day one; Vercel Hobby + GitHub Actions cron hitting an
authenticated route handler; DeepSeek for generation with a separate embeddings
provider, both behind a provider-agnostic interface.

**Next.js 16 gotchas** (found resolving Ticket 03 — applies project-wide, and
most tutorial content on the web is wrong about these):

- `middleware.ts` is **deprecated and renamed `proxy.ts`**; the export must be
  named `proxy` or be the default. Codemod:
  `npx @next/codemod@canary middleware-to-proxy .`
- Proxy runs on the **Node runtime by default**, and the `runtime` config option
  is unavailable there — **setting `runtime: "nodejs"` throws.**
- **Server Functions are not separate routes** — they POST to the route they're
  used on, so excluding a path from the proxy matcher also un-gates every Server
  Action on it. Proxy is optimistic; the `verifySession()` DAL is the boundary.

- **Polite fetching is a hard rule, not a nicety** (found in Ticket 01). Parse
  and obey `robots.txt` **per host, before fetching** — including for article
  fetches from the open web, and including `Content-Signal` directives such as
  `ai-input=no`. Lobsters was assumed viable and fails this check; it will not be
  the last. Conditional requests (`etag` / `last-modified`) everywhere, stable
  byte-identical query params so 304s actually fire, serial rather than
  concurrent fetching, honor `retry-after` and `x-poll-interval`, and send a
  descriptive User-Agent with a contact URL.

**Sources in**: Hacker News, GitHub, curated RSS/Atom (incl. YouTube channel
feeds), Bluesky, Lobsters. **Out**: Reddit (free tier is non-commercial only;
registration gated behind manual approval; no paid step below ~$12k/mo — note
this is **unverified**, see Ticket 01), X (pure pay-per-use, $0.005/read, no free
tier — verified).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [01 — Verify source API limits](issues/01-verify-source-api-limits.md) —
  verified against primary docs. **HN Firebase has no published rate limit**;
  **Algolia `items/{id}` returns the whole nested comment tree in one request**
  (verified by fetch), so the shape is Firebase for story lists + `/updates`
  deltas, Algolia for thread hydration. **GitHub GraphQL batches 100 repos into
  ~1 point** of 5,000/hr, and **authenticated 304s don't count at all** — so
  persist `etag`/`last-modified` per URL from day one and keep query params
  byte-identical. **YouTube RSS is confirmed by Google's own docs, zero quota**;
  the Data API is not merely expensive but *impossible* at this cadence
  (`search.list` caps at 100/day, 15-min polling needs 96/day **per channel**).
  **Bluesky's public AppView doesn't support auth at all** — genuinely free, but
  **no numeric limit is published**, so any Bluesky capacity figure is an
  assumption and must be labelled one. X exclusion confirmed (pure pay-per-use,
  $0.005/read, no free tier). **Reddit exclusion is UNVERIFIED** — all Reddit
  domains 403 the fetcher, so every claim traces back to third-party blogs;
  excluded anyway, so not worth further spend. Also: GitHub is narrowing
  **stargazer-listing** access (July 2026) — `stargazers_count` totals survive,
  per-star timestamps may not, which touches the cold-start velocity question.

- [02 — Choose AI providers](issues/02-choose-ai-providers.md) — generation
  **DeepSeek `deepseek-v4-flash`** (~$0.40–0.63/month at this workload; `deepseek-chat`
  and `deepseek-reasoner` are **retired after 2026-07-24**; JSON mode is
  `json_object` only, no schema mode, and can return empty content — so
  `generateJson` must validate-and-retry). Embeddings **`bge-small-en-v1.5`,
  384-dim, via Cloudflare Workers AI** (~2.8% of the free daily neuron quota).
  **Key insight: pin the MODEL, not the vendor** — bge-small is open-weight, so
  the same vectors come from Cloudflare or from local `transformers.js`, turning
  the one irreversible decision into a config change. 384-dim `halfvec` ≈ 82 MB/yr
  vs 1536-dim ≈ 657 MB/yr, which alone would exceed the Neon free tier in a year.
  Gemini ruled out (free tier trains on input, undocumented embedding quota);
  Voyage is the quality upgrade path. **Constraint: the interest profile must
  never appear in a DeepSeek prompt** — inputs are trained on by default and
  stored in the PRC, which is acceptable only because prompts carry
  already-public article text.

- [03 — Choose the auth solution](issues/03-choose-auth-solution.md) —
  **hand-rolled signed session cookie** (`jose` HS256 in a `__Host-` cookie,
  Argon2id passphrase, `session_version` column for revocation), 90-day rolling
  sessions. Clerk ruled out (free tier caps sessions at 7 days, non-configurable);
  Auth.js v5 ruled out (~33 months in beta); GitHub OAuth rejected (more
  security-critical code to hand-roll, and it makes GitHub a single point of
  lockout with no reset flow). Better Auth is the runner-up if a second user,
  passkeys, or social login ever appear.
  **Cross-cutting finding: `middleware.ts` is deprecated in Next.js 16 — renamed
  to `proxy.ts`, defaults to the Node runtime, and setting `runtime: "nodejs"`
  now throws.** Server Actions POST to the route they're used on, so a matcher
  that excludes a path also un-gates its Server Actions — proxy can never be the
  only boundary; a `verifySession()` DAL is the real one.

## Not yet specified

- **Cold start for velocity scoring.** Importance ranking leans on velocity
  against a baseline, but a fresh install has no history and no idea what
  "unusual" looks like. Either a relevance-only warm-up period, or seed from
  absolute thresholds. Sharpens once the ranking model (Ticket 08) is settled.
  Note Ticket 01's finding that GitHub is narrowing stargazer-listing access, so
  per-star timestamps may not be available for velocity.
- **Personal subscriptions layer.** In scope for the product eventually, but the
  shape only becomes specifiable once the global corpus and entity model exist.
- **AI assistant over the corpus.** "What happened in React this week?" — needs
  the entity model and embedding strategy settled before the retrieval design is
  answerable.
- **Signal lifecycle.** What happens to a signal on day 2 when new sources join
  the cluster — does it resurface, merge, or stay closed? Depends on the
  clustering spec (Ticket 05) and on whether briefs are sealed (Ticket 13).
  Prior art: Sill uses a rolling 24h aggregation window, user-adjustable.

## Out of scope

Work consciously ruled beyond this map's destination. These never graduate — if
the destination is redrawn they return as a fresh effort.

- **Billing, plan tiers, usage quotas, teams/shared feeds, admin dashboard** —
  Phase 5 concerns. Should not shape a single Phase-1 decision.
- **Native mobile apps** — responsive web plus optional PWA covers the stated
  phone requirement. Revisit only if the product proves itself.
- **OpenTelemetry, PostHog, full observability stack** — Sentry plus a
  `source_fetch_log` table answers every operational question at single-user
  scale.
- **E2E test infrastructure (Playwright)** — Vitest unit tests on feed parsing,
  URL canonicalization, and URL validation are the ones that earn their keep now.
- **Monorepo tooling** — one Next.js app, one repo. A monorepo is pure overhead.
- **Reddit and X integration** — ruled out on terms and cost, not on sharpness.
