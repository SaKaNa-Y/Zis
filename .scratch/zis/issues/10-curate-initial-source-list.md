# 10 — Curate the initial source list

Type: task
Status: open
Blocked by: 01

## Prior work

**RSS candidates are collected and verified**:
[candidate-sources-rss.md](../research/candidate-sources-rss.md) — 137 URLs
probed, **110 verified** (fetched, HTTP 200, valid feed XML, item counts and
newest-item dates measured, not estimated). Includes 10 concrete expected
co-citation clusters, negative controls, and a tiered "minimum viable 30".
YouTube / GitHub / Bluesky candidates are being collected separately.

What remains for this ticket: the user picks the final set, and the seed file
gets written.

**Findings that shape the pick:**

- **The awesome-lists were a dead end.** ~850 feeds across the three public
  collections; ~7 survived. The dominant genre — single-company engineering
  blogs — **cites nobody and produces zero clusters**. Individually interesting,
  worthless to a co-citation product. Buy aggregators and origin blogs instead.
- **Seven top aggregators are excerpt-only** (Cooper Press family, TLDR, This
  Week in Rust): the link lists are **not in the feed**. Extracting cited URLs
  needs an issue-page fetch, under Ticket 01's robots.txt rule. Without it the
  minimum-viable-30 loses most of its cluster-forming power — **a prerequisite,
  not an enhancement.**
- **Pick exactly one Simon Willison feed.** `everything` / `links` / `entries`
  overlap; two would double-count one voice against distinct-source ranking.
- **Don't ingest hnrss** — HN has its own richer adapter; both would double-count.
- **Four dead feeds**: Matt Pocock (newest 2023-11-30, drop outright), Anthony Fu
  (2025-04), Lee Robinson (no feed at any URL), Vue.js blog (2024-09).
- **Lobsters' feed works but fails the robots.txt rule** — pending a product
  decision, not a technical one.
- **Some feeds carry unreliable dates** — TLDR has a 2018 item, Render a
  future-dated one, Lea Verou interleaves 2009. Sort defensively, clamp to now.

**Platform candidates are also collected and verified**:
[candidate-sources-platforms.md](../research/candidate-sources-platforms.md) —
**25 YouTube channels** (channel IDs resolved and feeds fetched; 24 active within
~6 weeks), a **75-repo GitHub watchlist** (all slugs resolve), and **22 Bluesky
people + 20 org accounts with DIDs + 11 feed generators**.

- **Select Bluesky accounts on external-link density, not fame.** Measured range
  is 100% (adactio) to 7% (pfrazee); an account that posts no links contributes
  nothing to a co-citation spine. **~40% of "obviously should be there" handles
  are dead or empty** — karpathy last posted 2023 despite 34k followers;
  mitchellh, tailwindcss.com and anthropic.com all have `postsCount: 0`.
- **Three GitHub repos have moved**: `facebook/react` → `react/react`,
  `facebook/react-native` → `react/react-native`, `containers/podman` →
  `podman-container-tools/podman`.
- **Four YouTube candidates rejected**: Coding Garden and Josh tried coding
  (dormant since Dec 2025), Ben Awad (handle 404s), "David Farley" (stale 2006
  channel — the live one is Modern Software Engineering,
  `UCCfqyGl3nq_V0bo64CjZh8g`).
- **GitHub trending**: five concrete query shapes given, one verified live
  (`total_count` 547). The durable signal is **locally-computed
  `stargazers_count` deltas**, since Ticket 01 found stargazer-listing access
  narrowing.



## Question

**The product is only as good as this list.** Clustering needs overlapping
coverage of the same events, so the list must be chosen for *overlap*, not just
quality — twenty sources that each cover different things produce zero signals.

Assemble the concrete v1 source list:

- **~50–100 RSS/Atom feeds** — dev blogs, framework release blogs, engineering
  blogs, personal blogs worth reading. Must include the ones that cover the same
  events from different angles.
- **YouTube channel feeds** — channel IDs for the dev channels worth following,
  as `feeds/videos.xml?channel_id=…`.
- **GitHub** — the repos and orgs to watch for releases; how "trending" is
  approximated given there's no official endpoint (see Ticket 01).
- **Bluesky** — which accounts, feeds, or search terms define the tech-adjacent
  slice. This is the least obvious of the four and needs real thought.
- **Lobsters and HN** — endpoints and any tag filters.

For each: URL, transport type, suggested poll cadence, initial trust weight,
whether a favicon is discoverable.

**Validate before finalizing** — for each feed, confirm it responds, is valid,
includes full content or just excerpts, and how often it actually publishes. A
list of 100 feeds where 30 are dead is worse than a validated 50.

**Bias the selection toward the user's stated interests** — this is a personal
tool first. Ask what they actually read now, and what they wish they'd hear
about sooner.

Deliverable: a seed data file (JSON or a Drizzle seed) ready to load, plus a
note on which sources are expected to co-cite each other — that expectation is
what Ticket 05's prototype will test against.
