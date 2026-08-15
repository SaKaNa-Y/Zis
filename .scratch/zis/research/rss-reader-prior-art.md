# RSS Reader & Aggregator Prior Art — Mechanism Study

Research for Zis Phase 0. Organised by mechanism, not by product. Every section
ends with an explicit **For Zis** verdict: copy / adapt / reject.

Scope note: this is prior-art research, not a spec. Where a finding contradicts a
standing constraint in `../map.md`, it is flagged loudly rather than softened.

---

## 0. The headline finding, stated up front

**The single closest prior art to Zis's clustering spine — Techmeme — abandoned
full automation in 2008 and today runs 3 full-time plus 23 part-time editors
across five continents for near-24×7 coverage.** Twenty years in, with the same
link-graph clustering engine still underneath, the answer to "can you cluster
tech news by co-citation alone?" that the market has converged on is: *yes, but
it needs a human refinement layer to be good.*

Gabe Rivera's own 2008 post is titled "Guess what? Automated news doesn't quite
work." His stated example: "only an algorithm would feature news about Anna
Nicole Smith's hospitalization after she's already been declared dead."

The control experiment exists and is still running. **memeorandum** is the same
engine with the editors removed. Reported failure modes of the unedited version:

- duplicate clusters for one story that never get merged,
- stale items lingering at the top of the page,
- thin clusters elevated by a burst of correlated cross-linking,
- headlines taken verbatim from the source, carrying that source's spin.

Read carefully, though, this is *encouraging* for Zis, not damning. The raw
algorithm was never bad — reporting notes the engine "handled duplicates well
and picked up related stories even without links between them," and memeorandum
sustained quality under spam pressure. **The editors are a refinement layer, not
a rescue.** Rivera has also said he expects LLM-enabled intelligence to narrow
the gap for the unedited sites.

The four failure modes above are the acceptance criteria for Zis's clustering
work. Three of them (merge, staleness, burst suppression) are the exact things a
bounded-output product must get right, because with 5–10 slots per day a single
duplicate cluster is a 10–20% quality regression, not a minor blemish.

**For Zis: adapt.** Keep deterministic co-citation as the spine — it is
vindicated by 20 years of Techmeme. But budget explicitly for the refinement
layer that Techmeme staffs with 26 people. In a single-user product, that layer
has three plausible occupants: (a) the LLM naming/summarising pass doing double
duty as a merge/split adjudicator over *candidate* clusters, (b) the interest
profile acting as a relevance filter, or (c) the single user, given cheap
merge/kill affordances. Do not assume the spine alone produces a publishable
front page. It demonstrably does not.

---

## 1. Deduplication and clustering

### 1.1 The layered consensus

Every production system converges on the same cascade, cheapest signal first:

1. **URL normalisation** — the cheap, high-yield first pass.
2. **Publisher canonical signals** — `rel=canonical`, AMP unwinding.
3. **Content fingerprinting** — SimHash/MinHash LSH for near-duplicates.
4. **Semantic embeddings** — for stories that share no URL and no phrasing.
5. **Temporal decay** — so stale clusters stop absorbing new arrivals.

Zis's stated plan (URL co-citation spine, embeddings second pass) sits at layers
1 and 4 and **skips 2, 3 and 5**. Layers 2 and 5 are cheap and should not be
skipped. Layer 3 is genuinely optional for this corpus (see 1.4).

### 1.2 URL normalisation — the part that carries the load

The canonical transform list, assembled from crawler-engineering practice:

- follow redirects with a **bounded hop limit** (3 is the commonly cited number),
  and re-run, because shortener nesting is real — a `bit.ly` re-shortened by
  `ow.ly` and again by `t.co` was routine on Twitter;
- force HTTPS; canonicalise host (`www` / non-`www`);
- strip trailing slash;
- drop `utm_*`, `ref`, `fbclid` and session IDs — UTM parameters exist purely to
  attribute a session to a campaign and carry **zero content signal**;
- sort remaining meaningful params;
- prefer `rel=canonical` when the publisher declares one — note it can arrive as
  an **HTTP header**, not just a `<link>` tag;
- unwind AMP and m-dot path prefixes.

One caveat worth encoding: **not every query param is noise.** Sort and filter
params sit alongside tracking params. A blanket "strip all params" rule breaks
paginated and filtered URLs. The recommended discipline is an explicit denylist
plus per-publisher overrides, not wholesale dropping.

Design principle worth lifting verbatim: *deduplication answers "have we seen
this before?"; canonicalisation answers "which representation should define the
record?"* — and **deleting duplicates is usually wrong**. Collapse them into one
canonical signal while preserving provenance: which source, when first seen, via
which URL. That provenance record *is* Zis's "why this surfaced" explanation.
The clustering table and the explainability feature are the same table.

### 1.3 Co-citation ranking — what Nuzzel actually teaches

Nuzzel is the strongest evidence *for* Zis's approach, and the most instructive
about its limits.

**The mechanism:** show links posted by people you follow, sorted by how many
distinct people shared the same article. Fast Company's summary is the line to
remember — "if Nuzzel had a secret sauce, it was that it had no secret sauce."
Founder Jonathan Abrams explicitly contrasted "a social aggregation approach"
with aggregators using "human editors or machine learning." Optional
friend-of-friend expansion widened the corpus when the inner ring was quiet.

**What it teaches, concretely:**

- **Unique-sharer count, not share count, is the ranking primitive.** Sill, the
  modern Bluesky/Mastodon successor, states this explicitly: popularity is "the
  number of *unique accounts* that share a URL." One loud account cannot
  manufacture a cluster. This maps directly onto Zis: rank by *distinct sources*
  citing a URL, never by total mentions.
- **A 24-hour aggregation window is the working default.** Sill groups links
  posted within a rolling 24h period, user-adjustable. This is prior art for
  Zis's daily cadence and, importantly, for the signal-lifecycle question the
  map lists as unspecified.
- **Invert the feed: link above post.** Sill's stated design change from a
  standard timeline is that the *link* is the primary object and posts are
  grouped underneath it, exposed via a "Shared by N accounts" affordance. This
  is exactly the cluster-as-primary-entity model Zis wants, already validated in
  a shipping product.
- **The failure mode is repetition, not mis-clustering.** Sill's creator on
  Nuzzel's decay: "It didn't handle quote tweets or retweets well. You'd
  sometimes see the same post six times in a row." The lesson is that
  co-citation systems die from *unhandled reshare semantics*, not from bad
  similarity math. Zis's equivalents: an HN submission and its `news.yc` comment
  link, a GitHub release and its repo root, a Lobsters post and its HN twin, a
  Bluesky repost chain. **Enumerate the reshare/alias semantics of every adapter
  before writing the clustering code**, because that — not embeddings — is where
  the quality actually goes.

**The uncomfortable part.** Nuzzel's ranking was a function of *who you follow*.
That social graph did enormous unacknowledged work: it filtered for relevance
before ranking ever ran, and it was continuously curated by the user for reasons
unrelated to the reader. Zis has no social graph. A global corpus with no
follow-graph means co-citation count measures *general tech-news salience*, not
"salience to this user." That is a different quantity, and it is precisely the
quantity Techmeme's front page already publishes for free.

Zis's interest profile is meant to bridge that gap. That is a coherent design,
but be honest that **the interest profile is doing the job Nuzzel got for free
from the follow graph**, and is therefore load-bearing rather than a nice-to-have
explanation layer. If the interest profile is weak, Zis degrades into a
worse-latency Techmeme.

### 1.4 Embeddings — where they actually help, and the cost

Evidence, briefly:

- *Real-time News Story Identification* (arXiv 2508.08272): all LLM embeddings
  beat a TF-IDF baseline on clustering AMI; BGE-M3 best. TF-IDF was good at
  *outlier detection* but not at clustering.
- SIGIR-adjacent and library benchmarks agree there is no universal winner, and
  that on simple, well-behaved corpora the advanced representations "do not
  always win."
- Reference architecture (Chronicle): MiniLM embeddings, MinHash LSH at 0.85
  Jaccard for near-dup, HDBSCAN (min cluster size 3), agglomerative at 0.6 cosine
  as fallback, TF-IDF fallback when no GPU, incremental batches of ~400 docs.
- Miranda et al.'s streaming approach models **temporal similarity as a Gaussian**
  and adds it to the content similarity. Multiple sources flag temporal decay as
  "the missing piece in naive systems."

The honest read for Zis: **embeddings buy you the stories that share no URL.**
"Three separate posts about the React compiler shipping, none linking each
other" is a real and valuable cluster that co-citation cannot see. That is worth
having. But note that in a tech corpus dominated by HN, Lobsters, GitHub and
Bluesky, *the URL is almost always present* — these are link-sharing platforms.
The co-citation spine will have unusually high coverage here compared to the
general news corpus these papers study. That is a genuine structural advantage of
the chosen source set and it should be stated as such.

Conversely: **MinHash/SimHash near-dup is much less valuable for Zis than the
literature suggests.** The literature is dominated by the wire-copy problem —
AP/Reuters syndication reprinted verbatim across hundreds of outlets. Zis's
corpus has almost no wire copy. Skipping layer 3 is defensible; skipping layer 5
(temporal decay) is not.

**For Zis:**
- **Copy:** unique-source counting (not mention counting) as the ranking
  primitive; 24h rolling window; link-as-primary-object with sources grouped
  beneath; provenance-preserving collapse rather than deletion.
- **Copy:** full URL normalisation including `rel=canonical` and AMP unwinding —
  Zis's plan currently under-specifies this and it is the highest-yield,
  lowest-risk work in the whole clustering story.
- **Adapt:** add an explicit temporal-decay term to cluster membership. Without
  it, day-2 arrivals join day-1 clusters forever and the signal-lifecycle
  question has no answer.
- **Adapt:** embeddings as a second pass, but scope them to *cluster merge
  candidates only* (does cluster A subsume cluster B?), not to raw item
  clustering. That keeps the deterministic spine authoritative, keeps cost
  bounded, and is the cheapest place to buy back Techmeme's merge behaviour.
- **Reject:** MinHash/SimHash near-duplicate detection as a day-one layer. Wrong
  corpus for it.
- **Reject (as insufficient, not wrong):** the belief that co-citation + LLM
  naming produces a publishable front page unattended. Plan the merge/kill
  affordance now.

---

## 2. Unread counts and bounded volume

### 2.1 The anxiety problem is real and named

The framing in the community is that RSS readers inherited an "Inbox Zero"
philosophy — an unread count per source — and with more than a dozen feeds
reaching zero is hopeless. The observed user behaviour is bulk dismissal: people
hit "Mark all as read" every few weeks because the list is too long to consume.
That is a total product failure dressed as a feature.

Even Folo's own Show HN framing concedes it: the post cites the "1,000+ unread"
problem as motivation, noting most readers don't help filter noise.

### 2.2 The design fork — three answers, one clear winner

| Approach | Product | Mechanism |
|---|---|---|
| Eliminate the count | Reeder (2024 rewrite) | Synced *timeline position*; "Say goodbye to unread counts!" |
| Make it a preference | NetNewsWire | Toggle off the Dock unread badge |
| Keep count, ease triage | Unread | Gesture triage, widgets |

Silvio Rizzi rebuilt Reeder from scratch around removing the unread count,
keeping the old app alive as *Reeder Classic* for people who wanted it. Brent
Simmons has articulated "add options that reduce anxiety" as an explicit
NetNewsWire design principle, with the Dock badge toggle as the worked example;
a user described noticing "a sort of calm" and attributed it to that deliberate
design. The outstanding NetNewsWire feature request is telling — users want the
*number* gone from individual feeds while keeping the *list* of what was missed.

Note what Reeder's replacement actually is: **synced timeline position.** Not
"nothing." Removing the count creates a real orientation problem — "where was I?"
— and Reeder answers it with a durable resume point rather than a debt counter.
Zis's daily-brief boundary answers the same question with a date. That is a
stronger answer, but only if the brief is genuinely complete-in-itself.

### 2.3 Prior art for a hard cap

The bounded-output space splits three ways, and only one is a true numeric cap:

1. **Finite-by-inbox-zero** — Electric Pants ("Finite by design", "No infinite
   scroll designed to keep you trapped", an explicit "All Caught Up" screen,
   name a deliberate play on doom-scrolling); Newsfeed (no badges, no endless
   scroll, most-recent-only chronological merge). **These are not caps.** If 300
   items arrive you still face 300. They bound the *interaction pattern*, not the
   volume.
2. **Bounded digest — the real cap.** Readwise Reader's Daily Digest is the
   cleanest documented precedent: unlimited feeds in, but the digest is capped at
   **20–25 posts per day** plus five saved items. Brief Digest goes further —
   clusters related articles across sources and produces *one* LLM briefing per
   day organised by topic. Digest (usedigest.com) uses email itself as the
   boundary: one email at a chosen time, no app to check, no feed to scroll.
   Inoreader ships a daily digest behind its paid tier.
3. **Time compression** — Skim Reader bounds *minutes* via a compression slider
   from two-sentence summary to full article.

Two things follow. First, **Zis's hard cap is not unprecedented but it is
aggressive**: 5–10/day against Readwise's 20–25. Second, and more importantly,
**the products that successfully hold a cap all deliver as a digest, not as an
app you open.** The boundary is enforced by the artefact being finished and sent,
not by discipline in a UI. Readwise, Brief Digest, Digest, TLDR and Inoreader all
work this way.

This is the one place where the map's stated plan is at mild risk. A web app with
a bounded page is a *promise* of boundedness; an email or a dated, sealed daily
page is a *structural* boundary. The map lists digest delivery as "not yet
specified... blocked on nothing except attention." That understates it — the
digest is not a delivery channel decision, it is the mechanism that makes the
cap real. Everything else in this section says so.

**For Zis:**
- **Copy, with conviction:** no unread counts. This is the direction the best
  native clients (Reeder, NetNewsWire) independently moved toward, and Reeder bet
  a full rewrite on it. This constraint is well-supported; hold it.
- **Copy:** the "All Caught Up" completion ritual. Electric Pants's insight —
  that finishing is "a satisfying moment that most apps deliberately hide from
  you" — is free product value and directly reinforces the bounded model.
- **Copy:** a durable resume/orientation signal to replace the count. Reeder uses
  synced timeline position; Zis should use the dated brief. Do not remove the
  count and leave nothing.
- **Adapt / elevate:** treat the daily digest as the *primary artefact*, with the
  web app as a view onto it. Everything that reliably holds a cap in the wild is
  digest-shaped. Consider promoting digest delivery out of "not yet specified."
- **Reject:** any "show more" / "see everything" escape hatch. The map already
  rules this out and the evidence backs it — Electric Pants and Newsfeed both
  treat the absence of the escape hatch as the product.
- **Watch:** 5–10/day is below every documented precedent. Thin days are the
  risk, not busy ones. Decide now whether the brief may be *short* (three items,
  honestly) or must be *filled* — filling it is how a bounded product silently
  becomes a noisy one.

---

## 3. OPML

### 3.1 The standard, and its practical limits

OPML import/export is table stakes — Miniflux, FreshRSS, NetNewsWire, Feedly and
Inoreader all support it. The instructive detail is what it *doesn't* carry.

FreshRSS documents this plainly: **OPML export includes only standard OPML
attributes and omits refresh frequency, credentials, user agent and XPath
scraping rules.** For a full export you are told to dump SQLite instead. FreshRSS
1.20.0 added export/import of *some* proprietary attributes, plus tolerance for
importing invalid OPML — the latter is the real-world signal. **OPML in the wild
is frequently malformed and lenient parsing is mandatory.**

Categorisation is also non-portable in practice: plenaryapp ships each list
twice, once with an extra wrapping `<outline>` for readers that support
categories and once without, precisely because readers disagree.

FreshRSS 1.20.0 also added **Dynamic OPML** — a category populated from a remote
OPML URL, re-fetched. That is a genuinely interesting primitive for a
curated-corpus product: the source list becomes a subscribable, versionable
artefact rather than a one-time import.

### 3.2 Harvestable public collections

Directly relevant to seeding Zis's global corpus:

- **`kilimchoi/engineering-blogs`** — `engineering_blogs.opml`. The most widely
  referenced company-engineering-blog roll. Best single starting point.
- **`tuan3w/awesome-tech-rss`** — `feeds.opml`, startup/science/tech. Covers
  GitHub, Stripe, Spotify, eBay, Atlassian engineering plus Smashing Magazine,
  web.dev, UX Collective. Its README is *generated from* the OPML, which is a
  nice pattern for keeping a curated list honest.
- **`plenaryapp/awesome-rss-feeds`** — `recommended/with_category/Programming.opml`
  (Code as Craft, Overreacted, Coding Horror, Facebook Engineering, GitLab,
  Google Developers Blog), plus local-news lists.
- **`RSS-Renaissance/awesome-AI-feeds`** — `feedlist.opml`, AI/ML focus.
- The GitHub **`opml` topic** is the browsing entry point for more.

**Caveat, load-bearing:** HN commenters note these lists go stale — the Plenary
list's last commit was three years old at time of discussion, and "many
awesome-xxx repos follow the same pattern." Expect dead Feedburner URLs and
pre-rename domains. Any harvest needs a validation pass and a pruning policy.

**For Zis:**
- **Copy:** OPML *import* with lenient parsing, and support both flat and
  category-wrapped forms. It is the only way a curated corpus gets seeded without
  hand-typing 200 URLs.
- **Adapt:** treat the harvested OPML collections as *seed input to a curation
  step*, not as the corpus. These lists are optimised for "lots of feeds," which
  is the opposite of Zis's thesis. Validate every URL, prune aggressively, and
  keep the surviving list in the repo as the corpus definition.
- **Consider:** FreshRSS's Dynamic OPML pattern — corpus-as-remote-artefact —
  fits Zis's "global corpus independent of subscriptions" model well.
- **Deprioritise:** OPML *export*. Zis is single-user with no migration story and
  a curated corpus that isn't a subscription list. Export is a reflex, not a
  requirement here. Revisit if the personal-subscriptions layer ships.

---

## 4. Feed discovery

The mechanism is settled and well-documented; the implementation order matters.

**Primary — autodiscovery `<link>` tags.** Convention dating to 2002:
`<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS">`.
Parser details that bite:

- `rel` must be matched lowercase `alternate` for autodiscovery (case-insensitive
  elsewhere in HTML, but not here);
- accept types `application/rss+xml`, `application/atom+xml`,
  `application/rdf+xml`, and tolerate `text/xml` (old WordPress emitted it);
- HTML5 also defines **`rel="feed"`**, where `type` is *not required* — WHATWG
  added it because feeds aren't really "alternate representations" and MIME type
  isn't a reliable feed indicator. A robust reader accepts both `rel` values;
- resolve relative `href` against `<base>` or the document URL;
- when multiple links exist, **the first should be the site's main feed** — a
  usable default-selection heuristic. Deduplicate comments feeds and
  format-duplicates (WordPress historically emitted RSS 2.0, RSS .92, Atom and a
  comments feed as four separate links);
- autodiscovery tags commonly appear on *every* page, so resolving an arbitrary
  article URL usually works — you don't need the homepage.

**Fallback — path probing.** There is no canonical probe list in any standard.
Paths appearing organically: `/feed`, `/feed.xml`, `/rss.xml`, `/feed.rss`,
`/feed.atom`, `/rss/`, `/atom.xml`, `/index.xml`. Validate a hit by **sniffing
the XML root element**, not by trusting `Content-Type`.

**Why probing must be the fallback, not the primary:** feeds are frequently
proxied off-domain — Ars Technica's link points at `feeds.arstechnica.com`, and
the RSS Board's own example points at FeedBurner. Blind path-probing fails
exactly where autodiscovery succeeds.

**Recommended order:** fetch URL → parse `<head>` for `rel="alternate"` or
`rel="feed"` → resolve relative hrefs → prefer first, expose others by title →
only then probe common paths → validate by root element.

Adjacent: FreshRSS supports **XPath and JSON scraping** for sites with no feed at
all, and per-feed cookie/redirect settings. `dylan-k/blogroll-roller` is a small
reference implementation of "list of URLs in, OPML out" via autodiscovery.

**For Zis: copy, verbatim, then stop.** This is solved, cheap, and the ordering
above is the right one. Discovery runs once per source at curation time, not on
the hot path — so build the simplest correct version and do not invest further.
Reject XPath/JSON scraping fallbacks for now: they are per-site maintenance
burden, and a curated corpus can simply exclude feedless sites.

---

## 5. Full-text extraction

### 5.1 What the benchmarks actually say

Four independent evaluations, consistent conclusion:

- **Zyte/ScrapingHub article-extraction-benchmark** (F1): trafilatura 0.945,
  go_readability 0.943, readability-lxml 0.922, newspaper3k 0.912, dragnet 0.907,
  readability_js 0.887. Commercial: AutoExtract 0.970, Diffbot 0.951.
- **Bevendorff et al., SIGIR 2023:** no single extractor wins at all complexity
  levels. **Readability has the highest median (0.970) and highest
  predictability; Trafilatura the best overall mean (0.883).** Differences widen
  on complex pages. Their best ensemble double-weighted Readability, Trafilatura
  and Goose3; all ensembles beat all individuals.
- **OSTI (181 files, ROUGE-Lsum):** Trafilatura mean F1 0.937, precision 0.978;
  Readability highest mean recall 0.929. Both near-perfect precision — they omit
  nearly all boilerplate.
- **WCXB (multi-type pages, beyond news):** rs-trafilatura 0.903, Resiliparse
  0.817, Trafilatura 0.841, Readability 0.736. Notably the neural **ReaderLM-v2
  (0.741) underperformed several heuristic systems** despite being far larger.

Practical notes: Trafilatura's accuracy comes from cascading — own heuristics,
then jusText, then readability-lxml. **`readability-lxml` scores lower than
`readability.js` in essentially every benchmark** because the Python port tracks
an older version of the algorithm; if you have Node, use the JS one.
**Mercury Parser appears in none of these suites** — Postlight archived it
(`@postlight/parser`) and modern comparisons substitute Readability.js,
Trafilatura, Newspaper4k and Resiliparse. Treat Mercury as deprecated.

Miniflux ships a **local Readability port** plus CSS-selector scraper rules,
rewrite rules, and regex include/exclude filters — the shape of "good default,
per-site override" that works in practice.

### 5.2 The load-bearing point for a JS/TS stack

The benchmark winner (Trafilatura) is Python. For a Next.js app the realistic
choices are **`@mozilla/readability`** (which benchmarks *better* than the Python
readability port and has the highest median and best predictability of any
extractor in the SIGIR study) or a Go/Rust service. Readability.js is the right
default and the benchmarks support it — the gap to Trafilatura is real but small,
and Readability's *predictability* is arguably worth more to a bounded product
than Trafilatura's mean.

### 5.3 Paywalls

The consistent guidance is to **degrade gracefully**: fall back to the feed's
own summary content rather than attempting a bypass. Scraping premium content
without consent is precisely what publishers are defending against, and it is the
behaviour that gets a UA blocklisted (see §6.3).

**For Zis:**
- **Copy:** `@mozilla/readability` as the extractor. Benchmarks support it; it is
  the right language; it is predictable.
- **Adapt:** Miniflux's per-site CSS-selector override escape hatch, but only if
  a curated corpus of ~100–200 sources actually produces problem sites. With a
  hand-curated corpus you can just drop a site that extracts badly — a luxury
  general-purpose readers don't have. Use it.
- **Reject:** Mercury Parser (archived, absent from every benchmark) and neural
  extractors (ReaderLM-v2 loses to heuristics at far higher cost).
- **Reject:** any paywall bypass. Fall back to feed summary. For Zis this costs
  almost nothing — clustering keys on URLs, and the LLM summarises the *cluster*,
  so a paywalled member contributes its co-citation vote regardless of whether
  its body extracts.

---

## 6. Polite polling

### 6.1 The checklist

Rachel Kroll's Feed Reader Behavior project is the de facto conformance suite.
Its criteria, as reported:

**Conditional requests**
- Generate well-formed `If-Modified-Since` using **unaltered** `Last-Modified`.
- Consistently recognise and store `ETag` from 200 responses.
- Generate well-formed `If-None-Match` using **unaltered** `ETag`.
- **`ETag` values are quoted per the RFCs and the quotes are part of the value** —
  store and return them intact. This is the single most common implementation bug.

**Cache handling**
- Never "forget" cache parameters after 12 hours or on any schedule.
- Never *invent* an `If-Modified-Since` value. On first contact with a feed,
  **omit the header** rather than sending `null`, `nil`, or your own timestamp.
  You and the server will disagree about update times and you will miss content
  by bumping the value forward.
- Honour `Cache-Control: max-age` to reduce polling frequency.

**Backoff**
- Honour `Retry-After` on 429.
- **Honour a bare 429 with no `Retry-After`** — it is still a request to slow down.
- Don't fall back to unconditional requests just because a slow-down response
  lacked `Last-Modified`/`ETag`.

**Dead and slow feeds**
- Automatically slow polling for rarely-updating feeds. "If a feed updates once a
  month, there's no reason to poll hourly."

Treat `Last-Modified` and `ETag` as **opaque black-box values**: store exactly as
received, return exactly as received. Some servers send both, some one, some
neither.

This project produces real fixes — the Glance dashboard was found making all RSS
requests unconditionally and fixed it, adding a proper UA instead of the default
Go client string.

### 6.2 Push as a polling reducer

FreshRSS supports **WebSub**, receiving push notifications from WordPress,
Blogger and Medium. Real, but it is an inbound-webhook architecture, which is
exactly what the map's "no queue infrastructure, all-polling" constraint rules
out. Correctly out of scope.

### 6.3 User-Agent, and the 2025–26 blocking crisis

This is now a first-class operational risk, not a courtesy note.

- **79% of top news sites block AI training bots** via robots.txt; 71% also block
  AI *retrieval* bots; only 18% block none.
- Cloudflare's AI-bot blocking and Bot Fight Mode **catch legitimate RSS readers
  as collateral**. OpenRSS was blocked and had to get itself unblocked.
- **Substring matching produces absurd false positives.** A Perishable Press
  blocklist blocked Miniflux — UA
  `Mozilla/5.0 (compatible; Miniflux/2.2.13; +https://miniflux.app)` — because it
  matched the pattern **"Flux."** Removing that pattern fixed it.
- Feeds themselves get 403'd: a Discourse feed served fine in a browser but
  returned 403 to RSS readers *and to the W3C Feed Validator*.
- Techmeme reports the same headwind from the other side — Rivera notes crawling
  has gotten much harder, with paywalls and, more seriously, sites blocking all
  bots except a few search engines. **This is a live threat to the whole
  co-citation model**, since the link graph requires being able to read the pages.

Conventions that follow:
- Publish a distinctive UA with a `+URL`, following the established format:
  `FreshRSS/1.25.0 (Linux; https://freshrss.org)` or the Miniflux form above.
- **Avoid tokens that trip regex blocklists** — "Flux", "GPT", "AI", "Bot",
  "Crawler". A product called *Zis* is fortunate here; do not undo that by
  putting "AI" in the UA string.
- Respect robots.txt for full-text fetches.
- Get listed on verification directories — Cloudflare verified bots,
  `knownagents.com` (which classifies NewsBlur, OpenRSS, FreshRSS, MonitoRSS
  under **"Fetcher"**, a category distinct from training crawlers).

**For Zis:**
- **Copy the entire FRB checklist.** It is cheap, it is a closed set, and it is
  the difference between a good citizen and a UA that gets blocked. Non-negotiable
  given Zis polls a fixed corpus repeatedly forever.
- **Copy:** per-feed adaptive polling intervals derived from observed update
  cadence. This matters *more* for Zis than for a normal reader: the 15-minute
  cron across a global corpus means the polite thing and the cheap thing are the
  same thing (fewer fetches, smaller function budget on Hobby tier).
- **Copy:** the UA convention, with a deliberate check that the token doesn't
  match common blocklist patterns.
- **Adapt:** the map's `source_fetch_log` table should record ETag,
  Last-Modified, status, and consecutive-failure count — that is what makes
  backoff and dead-feed detection possible at all. Specify those columns now.
- **Reject:** WebSub. Correctly excluded by the no-queue constraint.
- **Flag as a real risk:** bot-blocking may degrade the co-citation corpus over
  time. Techmeme, with 20 years of publisher relationships, is complaining about
  it. Zis should prefer sources with API access (HN, GitHub, Bluesky, Lobsters)
  over open-web scraping wherever the choice exists — which the chosen source set
  already does. Worth noting as a *justification* for that source set, not just a
  convenience.

---

## 7. AI features that actually shipped

### 7.1 What exists

**Feedly Leo** — prioritisation, deduplication, mute filters, AI search. Trained
by user up/downvotes.

**Folo** — the direct inspiration. Its own site advertises "Timeline Summary,"
"Vibe Read" ("Let AI read it all. Keep only the signal."), AI-powered source
discovery across 24 official sources, and a Chat feature. Its Show HN framing
adds timeline TL;DRs, digest emails, article Q&A and transcription, and is
careful to state the AI is **optional** — arguing the reader "works well even if
you skip them." Historical note: the earlier "Follow" branding included a
blockchain "Power Token" incentive mechanism for users and creators; recent
release notes mention Stripe subscription upgrades and RSSHub limits, suggesting a
shift toward conventional tiers. Directory listings still tag it "Blockchain."

**Readwise Ghostreader** — inline summarise / define / translate / simplify /
study-questions, Jinja-templated custom prompts with variables for title, full
text, focused paragraph, selection and highlights; Global Ghostreader chats over
the whole library.

**NewsBlur Intelligence** — the outlier, and the most interesting. Not a
black-box recommender: thumbs up/down on **authors, tags, title keywords, full
text, URLs, and regex**, with stories colour-coded green/red/neutral into Focus /
Unread / Hidden. Scoping is Per Site (default), Per Folder, or Global. Newer
natural-language classifiers let you describe what you want in plain English, with
a **"Test on this story"** preview before saving. Resolution is deterministic:
**green always wins** — a story matching both a like and a dislike goes to Focus —
with "super dislikes" as an explicit override.

**Inoreader** — Filters (content + duplicate, incl. **near-duplicate** detection
across feeds/folders/account with a configurable comparison period) and Rules.
The instructive detail: the duplicate filter was moved **server-side to run
continuously in the background**, because the old client-side version was web-only,
operated only on articles your browser had received, couldn't catch duplicates
across sections, and let duplicates trigger rules and reach mobile apps.
Intelligence now lets you choose OpenAI / Anthropic / Mistral and bring your own
key. Quotas: Pro gets 50 filters and 30 rules.

### 7.2 The criticism, taken seriously

**Feedly Leo — the dedup complaint is the one Zis must read.** A Trustpilot
reviewer: *"Deduplication and Mute filters don't seem to provide added value at
all"*, plus an AI button that produced no summary; "very disappointing," "feel
scammed." A G2 reviewer reports noise still seeping through, guessing the AI is
"still learning." The dominant complaint overall is **pricing/paywalling**, not
concept failure — AI search largely Enterprise-gated, Pro+ annual-only, "All
features are behind a 2nd paywall," a threat-intel practitioner noting Leo sits
behind an enterprise-grade paywall. Counterweight: long-time paid users report
Leo genuinely cuts checking time *after setup and training*.

That qualifier — **"with a little setup and training"** — is the finding. Leo
works for people who invested in configuring it and disappoints people who
expected it to work out of the box. Zis's explicit editable interest profile is
the same bet, made honestly and visibly instead of hidden behind a vote history.
That is a real improvement in *legibility*, but it does not remove the underlying
requirement: **someone has to do the configuration work, and if they don't, the
product underperforms.** Zis has exactly one user and no onboarding funnel to
lose them in, which is the strongest argument that this bet is safe here and
wasn't at Feedly.

**Readwise — the consent controversy.** A blogger who called Reader "a bit of a
poster-child for 'AI done well'" — simple, well-considered, fully opt-in — turned
on it when auto-summarisation stopped being opt-in and ran every document for
every user through a GPT model. Their objection is specifically about *other
people's content*: Reader is a way to consume content the reader doesn't own.
Readwise subsequently added a global Ghostreader disable. Other complaints: credit
limits exhausted before reset; bland output (Readwise's own docs ask whether your
summaries are "putting you to sleep with their dry, matter-of-fact tone").

**The verdict reviewers converge on:** *Ghostreader's value comes from **where**
it sits rather than **how good** the model is.* For deep annotators the
zero-friction inline placement beats a better model in another tab; for people who
just want summaries, "you're paying a subscription premium for something a general
chatbot does comparably well." Summary quality is "good but not exceptional"
versus pasting into a chatbot.

### 7.3 What this means for Zis

The pattern across all four products: **AI-as-summariser is commodity and
weakly valued; AI-as-placement and AI-as-selection is where the value is.**
Nobody praises the summary text. People praise not having to go find the thing.

Zis's stated division of labour — the LLM **names and summarises** clusters but
**never detects** them — is therefore correct but slightly mis-emphasised. The
LLM is being assigned the commodity job. The valuable job (selection, placement,
"why am I seeing this") is being done by deterministic ranking plus the interest
profile. That is the right architecture and it is *cheaper* than the alternative.
But it means the summary quality will not be the product's differentiator, and no
amount of prompt engineering will make it one. Budget attention accordingly.

Two further reads:

- **Folo is a weak differentiation threat but a strong feature-parity threat.**
  Its marketing is entirely generic ("AI reads the internet for you," "keep only
  the signal") with no described mechanics, no stated cap, and no position on
  unread counts. Zis's clustering spine and hard cap are genuinely
  differentiated against it. But it ships digests, chat, discovery and
  transcription today, and its own Show HN cites the same "1,000+ unread"
  motivation. The differentiation is the *boundedness*, not the AI.
- **NewsBlur's classifier design is the most transferable AI-adjacent idea here**
  and it is barely AI at all: deterministic, inspectable, user-authored,
  colour-coded so you can *see the training working*, with a "Test on this story"
  preview and a stated conflict-resolution rule. That is what an explicit,
  editable interest model should feel like. It is also the clearest existing
  answer to "every surfaced item explains why it surfaced."

**For Zis:**
- **Copy:** NewsBlur's inspectability model — deterministic resolution, visible
  scoring, a preview that shows what a profile edit *would* have done to
  yesterday's brief. This is the single most valuable AI-adjacent mechanism found
  in this survey and almost nobody has copied it.
- **Copy:** Inoreader's server-side lesson — dedup must run in the pipeline, not
  in the client. Client-side dedup can't see across sections and lets duplicates
  reach downstream consumers. For Zis, dedup must happen before the brief is
  composed, not at render time. (Zis's architecture already implies this; it is
  worth stating as a rule so nobody later "optimises" it into the view layer.)
- **Copy:** Folo's honesty that AI features are optional and the product works
  without them. Good positioning and a good architectural forcing function.
- **Adapt:** LLM naming/summarising of clusters, yes — but hold expectations low
  and keep the prompt cheap. Every source says summary quality is not where
  loyalty comes from. Spend the token budget on merge adjudication (§1.4)
  instead, where there is no commodity substitute.
- **Reject:** AI-driven *detection* or ranking. Feedly's users can't tell whether
  Leo is working; that opacity is the complaint underneath the pricing gripes.
  The map's constraint here is well-founded — hold it.
- **Reject:** any always-on AI processing of every item. Readwise's
  auto-summarisation backlash is instructive, and for Zis it is also a cost
  argument: summarise the ~5–10 surfaced clusters, not the corpus.
- **Reject, emphatically:** anything resembling Folo's token/crypto layer.

---

## 8. Curated bounded digests — the actual competition

The map positions Zis against RSS readers. The evidence says the real competitor
set is the hand-curated newsletter, and that set is strong.

**TLDR** — the benchmark. Weekday cadence, **8–15 links** with 2–3 sentence
summaries and a reading-time estimate per link, a genuine five-minute read.
Curated by topic-specialist freelance editors who are practitioners (engineers
from Google, Meta; biotech professionals for the biotech edition). Founder Dan Ni
has said he drew on **3,000–4,000 sources via RSS feeds and aggregators**. Ads
capped at three clearly-labelled placements per issue, in the same
headline-and-summary format as editorial. Thirteen editions.

**Console.dev** — weekly, deep-dive, positioned for tool discovery and
lightweight evaluation rather than daily scanning. **Bytes** — JS/frontend,
lighter tone. **Hacker Newsletter** — weekly best-of-HN.

Note what TLDR's mechanics tell you. Its item count (8–15) brackets Zis's target
(5–10). Its source count (3,000–4,000) is an order of magnitude above what Zis
plans to curate. Its differentiator is neither — it is that **a domain
practitioner reads everything and picks**. That is the same conclusion as
Techmeme, arrived at from the opposite direction: at the bounded-output end of
this market, humans currently win, and they win on *judgement*, not on coverage.

**For Zis:**
- **Copy:** the format primitives. Per-item reading-time estimate, 2–3 sentence
  summary, a genuinely five-minute total. These are cheap and they are what makes
  a bounded brief feel finished rather than truncated.
- **Copy:** TLDR's source scale as an ambition. Zis's crawl can plausibly cover
  thousands of sources where a human editor at TLDR needs freelancers to do it.
  **Coverage is Zis's structural advantage over a newsletter; boundedness is its
  advantage over a reader.** The product lives in that intersection and the
  positioning should say so.
- **Confront:** Zis's honest pitch is not "better than TLDR" — a practitioner's
  judgement is not currently beatable by a co-citation count. It is *"TLDR, but
  the selection is tuned to my stated interests instead of a general audience's,
  and I can see and edit why."* That is a real and defensible claim. It also
  means the interest profile is the product, again (cf. §1.3). Two independent
  lines of evidence now point at the same component.

---

## 9. Summary table — copy / adapt / reject

| # | Mechanism | Verdict | The one thing |
|---|---|---|---|
| 1 | URL co-citation spine | **Adapt** | Vindicated by Techmeme, but they staff 26 editors on top of it. Plan the refinement layer. |
| 1 | URL normalisation | **Copy** | Highest-yield, lowest-risk work in the project. `rel=canonical` + AMP + bounded redirect unwind + UTM strip. |
| 1 | Unique-*source* counting | **Copy** | Sill/Nuzzel: count distinct sharers, never mentions. |
| 1 | Reshare/alias semantics | **Copy (as a work item)** | Nuzzel died of "the same post six times." Enumerate per adapter *before* clustering code. |
| 1 | Temporal decay in clustering | **Copy** | Named as "the missing piece in naive systems." Also answers the signal-lifecycle question. |
| 1 | Embeddings | **Adapt** | Scope to cluster *merge adjudication*, not raw clustering. Link-sharing corpus means co-citation coverage is unusually high. |
| 1 | MinHash/SimHash near-dup | **Reject** | Solves the wire-copy problem. Zis has no wire copy. |
| 2 | No unread counts | **Copy** | Reeder bet a full rewrite on it; NetNewsWire calls anxiety a design axis. Well-supported. |
| 2 | "All Caught Up" completion ritual | **Copy** | Free value; reinforces the bound. |
| 2 | Resume/orientation signal | **Copy** | Reeder replaced the count with synced position. Don't remove the count and leave a void. |
| 2 | Digest as primary artefact | **Adapt / elevate** | Every product that holds a cap is digest-shaped. Currently under-weighted in the map. |
| 2 | Escape hatch to firehose | **Reject** | Already ruled out; evidence agrees. |
| 3 | OPML import (lenient) | **Copy** | Malformed OPML is the norm; support flat + category-wrapped. |
| 3 | Public OPML harvest | **Adapt** | Seed input to curation, not the corpus. Lists go stale; validate and prune. |
| 3 | OPML export | **Deprioritise** | Single user, curated corpus, no migration story. |
| 4 | Autodiscovery-then-probe | **Copy** | Settled. Both `rel=alternate` and `rel=feed`; validate by XML root, not Content-Type. |
| 4 | XPath/JSON scraping fallback | **Reject** | Per-site maintenance burden; curated corpus can just exclude feedless sites. |
| 5 | `@mozilla/readability` | **Copy** | Highest median + best predictability; beats the Python readability port. |
| 5 | Per-site CSS override | **Adapt** | Cheap escape hatch; with ~100–200 curated sources you can also just drop bad sites. |
| 5 | Mercury Parser / neural extractors | **Reject** | Archived / loses to heuristics at higher cost. |
| 5 | Paywall bypass | **Reject** | Degrade to feed summary. Costs Zis almost nothing — the co-citation vote still counts. |
| 6 | Full FRB conditional-GET checklist | **Copy** | Opaque ETag incl. quotes; omit `If-Modified-Since` on first contact; honour bare 429. |
| 6 | Adaptive per-feed intervals | **Copy** | Polite and cheap are the same thing on Hobby tier. |
| 6 | UA convention + blocklist check | **Copy** | Miniflux was blocked for matching "Flux." Don't put "AI" in the UA. |
| 6 | WebSub | **Reject** | Violates the no-queue constraint. Correctly excluded. |
| 7 | NewsBlur-style inspectable scoring | **Copy** | Best transferable idea found. Deterministic, visible, previewable. |
| 7 | Server-side dedup | **Copy** | Inoreader's own migration. Dedup before composition, never at render. |
| 7 | LLM names/summarises only | **Adapt** | Correct, but it's the commodity job. Spend tokens on merge adjudication instead. |
| 7 | AI detection/ranking | **Reject** | Feedly users can't tell if Leo works. Opacity is the real complaint. |
| 7 | Always-on AI over corpus | **Reject** | Readwise backlash + cost. Summarise the surfaced 5–10 only. |
| 8 | TLDR format primitives | **Copy** | Reading-time per item, 2–3 sentence summaries, five-minute total. |
| 8 | Beat a human curator on judgement | **Reject as a goal** | Compete on *personalised, inspectable* selection instead. |

---

## 10. Where Zis's stated plan is contradicted or at risk

Stated plainly, in priority order.

1. **"Detection is deterministic" is sound; "and that's sufficient" is not.**
   Techmeme runs the same idea with 26 humans on top. memeorandum is the
   no-humans control and its documented failures — unmerged duplicate clusters,
   stale top items, thin clusters from correlated bursts — are all fatal at 5–10
   slots/day. The spine is right. The refinement layer is missing from the map
   and needs an owner: LLM merge adjudication, interest-profile filtering, or a
   one-click user merge/kill. Pick one before Ticket 05.

2. **The hard cap needs a structural boundary, not a UI promise.** Readwise
   (20–25/day), Brief Digest (one briefing), Digest (one email), TLDR (8–15) all
   enforce the bound by *shipping a finished artefact*. Electric Pants and
   Newsfeed, which bound only the interaction pattern, don't actually cap volume.
   The map lists digest delivery as low-priority and unblocked; the evidence says
   it is the mechanism that makes the headline constraint real. Consider
   promoting it.

3. **The interest profile is load-bearing, from two directions.** Nuzzel got
   relevance free from the follow graph; Zis has no graph, so co-citation count
   alone measures general tech salience — which is what Techmeme already
   publishes. And TLDR beats everyone on judgement, so Zis's defensible claim is
   *personalised and inspectable* selection. Both roads end at the interest
   profile. It is not an explanation layer bolted onto ranking; it is the
   product. Feedly's lesson sharpens this: Leo works for users who trained it and
   disappoints those who didn't. Zis's one user must be willing to write and
   maintain that profile, and the map should say so as an assumption.

4. **Summary quality will not differentiate.** Every AI-reader review reaches the
   same verdict: placement beats model quality, and summaries are "good but not
   exceptional" versus pasting into a chatbot. The map correctly assigns the LLM
   the naming/summarising job — just don't expect that job to be the reason the
   product is good.

5. **Bot-blocking is a live threat to the co-citation corpus.** 79% of top news
   sites block AI crawlers; Cloudflare catches legitimate readers as collateral
   (Miniflux blocked for matching "Flux"); Techmeme itself reports crawling has
   gotten much harder. Zis's API-first source set (HN, GitHub, Bluesky, Lobsters)
   is a genuine mitigation and deserves to be recorded as a *reason* for that
   choice, not just a licensing convenience.

6. **A minor one, worth deciding early:** 5–10/day is below every documented
   precedent. Thin days are the risk. Decide whether the brief may be honestly
   short or must be filled — filling it is exactly how a bounded product becomes
   a noisy one.

---

## Sources

Clustering / dedup: [Techmeme About](https://www.techmeme.com/about) ·
[Techmeme: automated news doesn't quite work (2008)](https://news.techmeme.com/081203/automated) ·
[Techmeme at 20 (Crazy Stupid Tech)](https://crazystupidtech.com/2025/09/08/at-20-techmeme-has-never-been-hotter/) ·
[TechCrunch: Techmeme gives up on fully automated news](https://techcrunch.com/2011/10/31/techmeme-opens-the-kimono-on-how-it-chooses-headlines-and-sources/) ·
[How Sill works](https://docs.sill.social/how-sill-works/) ·
[Introducing Sill](https://docs.sill.social/blog/introducing-sill/) ·
[Nieman Lab on Sill/Nuzzel](https://www.niemanlab.org/2024/11/remember-nuzzel-a-similar-news-aggregating-tool-now-exists-for-bluesky/) ·
[Fast Company: The News According to Nuzzel](https://www.fastcompany.com/3036995/the-news-according-to-nuzzel) ·
[Real-time News Story Identification (arXiv 2508.08272)](https://arxiv.org/html/2508.08272v1) ·
[Unsupervised Story Discovery (arXiv 2304.04099)](https://arxiv.org/pdf/2304.04099) ·
[Chronicle reference architecture](https://github.com/dukeblue1994-glitch/chronicle)

Volume / bounded output: [Reeder](https://apps.apple.com/app/reeder/id6475002485) ·
[TechCrunch on the new Reeder](https://www.techcrunch.com/2024/09/23/the-new-reeder-app-is-built-for-rss-youtube-reddit-mastodon-and-more) ·
[NetNewsWire forum: mark all as read](https://discourse.netnewswire.com/t/mark-all-as-read-all-articles-disappear/311) ·
[Electric Pants](https://apps.apple.com/us/app/-/id6756977663) ·
[Skim Reader](https://apps.apple.com/ar/app/skim-reader/id6758281041) ·
[Show HN: Folo](https://news.ycombinator.com/item?id=46033915)

OPML: [kilimchoi/engineering-blogs](https://github.com/kilimchoi/engineering-blogs) ·
[tuan3w/awesome-tech-rss](https://github.com/tuan3w/awesome-tech-rss) ·
[plenaryapp/awesome-rss-feeds](https://github.com/plenaryapp/awesome-rss-feeds) ·
[FreshRSS backup/export docs](https://freshrss.github.io/FreshRSS/en/admins/05_Backup.html)

Discovery: [RSS Board autodiscovery](https://www.rssboard.org/rss-autodiscovery) ·
[WHATWG feed autodiscovery](https://blog.whatwg.org/feed-autodiscovery) ·
[Dries Buytaert on RSS auto-discovery](https://dri.es/rss-auto-discovery)

Extraction: [Trafilatura evaluation](https://trafilatura.readthedocs.io/en/latest/evaluation.html) ·
[scrapinghub/article-extraction-benchmark](https://github.com/scrapinghub/article-extraction-benchmark) ·
[Bevendorff et al., SIGIR 2023](https://dl.acm.org/doi/pdf/10.1145/3539618.3591920) ·
[OSTI extraction evaluation](https://www.osti.gov/servlets/purl/2429881) ·
[WCXB benchmark](https://arxiv.org/pdf/2605.21097)

Polling: [Feed Reader Behavior project](https://rachelbythebay.com/frb/) ·
[feed score, take two](https://rachelbythebay.com/fs/help.html) ·
[Rob O'Leary: RSS feed 403s](https://www.roboleary.net/blog/rss-feed-403/) ·
[BuzzStream: which news sites block AI crawlers](https://www.buzzstream.com/blog/publishers-block-ai-study/) ·
[knownagents.com FreshRSS entry](https://knownagents.com/agents/freshrss)

AI features: [Miniflux: Opinionated?](https://miniflux.app/opinionated.html) ·
[Miniflux FAQ](https://miniflux.app/faq.html) ·
[NewsBlur Intelligence Training](https://www.newsblur.com/features/intelligence-training) ·
[NewsBlur trainer overhaul](https://blog.newsblur.com/2026/01/22/intelligence-trainer-overhaul/) ·
[Inoreader duplicate filters](https://www.inoreader.com/blog/2020/08/win-the-clone-wars-with-duplicate-filters.html) ·
[Inoreader filters and rules](https://www.inoreader.com/blog/2023/06/streamline-content-discovery-with-filters-and-rules.html) ·
[Readwise Ghostreader docs](https://docs.readwise.io/reader/guides/ghostreader/overview) ·
[theAdhocracy: disable auto-summarisation](https://theadhocracy.co.uk/wrote/disable-auto-summarisation-in-readwise-reader) ·
[Feedly Trustpilot reviews](https://www.trustpilot.com/review/feedly.com) ·
[folo.is](https://folo.is/)

Digests: [TLDR](https://tldr.tech/) ·
[Paved: TLDR and the art of content curation](https://www.paved.com/blog/tldr-newsletter-curation/)
