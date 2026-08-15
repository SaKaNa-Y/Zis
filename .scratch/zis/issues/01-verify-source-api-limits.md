# 01 — Verify source API limits against official docs

Type: research
Status: resolved
Blocked by: none

## Question

The source set was chosen on evidence from third-party API-vendor blogs — sites
that market alternatives to the APIs they describe, and therefore have an
interest in the numbers looking bad. Every figure below needs confirming against
**official primary documentation** before anything depends on it.

Confirm or correct, citing official docs only:

1. **Hacker News** — Firebase API (`hacker-news.firebaseio.com/v0/`) and Algolia
   HN Search. No auth? Actual rate limits (Algolia reportedly ~10k req/hr)?
   Does the Algolia item endpoint really return the full nested comment tree in
   one request?
2. **GitHub** — authenticated REST and GraphQL rate limits. What's the cheapest
   way to get trending repos, given there is no official trending endpoint?
   Releases and stars for a watchlist of repos — cost per poll?
3. **Bluesky / AT Protocol** — confirm the read path is genuinely free and
   ungated. Are the pollable AppView endpoints (`public.api.bsky.app`) sufficient
   to sample a tech-adjacent slice on a 15-minute cadence, or does useful
   coverage require the Jetstream firehose? Rate limits on the public AppView?
4. **Lobsters** — is the `.json` suffix on `/hottest`, `/newest`, `/s/{id}`
   officially supported and documented, or incidental? Any stated rate limit or
   robots/ToS constraint?
5. **YouTube** — confirm channel RSS (`/feeds/videos.xml?channel_id=…`) costs
   zero Data API quota and needs no key. Confirm it's still supported.
6. **Reddit and X** — confirm the exclusions hold. Reddit: is self-service
   registration actually closed, and does the non-commercial restriction really
   cover a single-user personal tool? X: is there genuinely no free read tier?

Also flag any **robots.txt / ToS constraint on polite crawling** for RSS and
general web fetching that should shape the fetcher's defaults (User-Agent
format, conditional requests, backoff).

Deliverable: a table of source → auth requirement → rate limit → polling budget
at a 15-minute cadence → official doc URL, plus a note on anything that
contradicts the assumptions in the map's Notes.

## Answer

Researched against official primary sources only. Cadence assumed throughout:
**15 min = 4 polls/hr = 96 polls/day**. Anything I could not confirm from a
primary source is marked **UNVERIFIED** rather than filled in.

### Table

| Source | Auth | Official rate limit | Budget @ 15-min cadence | Official doc |
|---|---|---|---|---|
| HN Firebase `hacker-news.firebaseio.com/v0/` | None | **"There is currently no rate limit."** (verbatim) | Unconstrained by any published limit. 1 req for `/topstories` (≤500 ids) + 1 req per item; comment trees cost 1 req per node. | https://github.com/HackerNews/API |
| HN Algolia `hn.algolia.com/api/v1/` | None (no key in any documented call) | **UNVERIFIED** — see below | Unknown. Design to a self-imposed cap and honor 429. | https://hn.algolia.com/api (SPA, serves no fetchable text) |
| GitHub REST | PAT / App token | 5,000 req/hr authenticated user; 60/hr unauth; App installation 5,000/hr base, +50/hr per repo >20 and per user >20, ceiling 12,500/hr | 1,250 req per poll. With authenticated conditional requests, **304s do not count at all**. | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| GitHub GraphQL | PAT / App token | 5,000 **points**/hr. Cost = (sum of requests each connection needs) ÷ 100, rounded, min 1. Node limit 500,000/call; every connection needs `first`/`last` in 1–100. | 1,250 pts per poll. A 100-repo releases+stars query ≈ **1–2 points**. | https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api |
| GitHub Search | PAT | **30 req/min** authenticated (10/min unauth); 1,000 results max per search; scope caps at 4,000 matching repos | Ample — 4 searches/hr against an 1,800/hr ceiling. | https://docs.github.com/en/rest/search/search |
| Bluesky AppView `public.api.bsky.app` | **None — endpoint does not support auth** | **No number published.** Docs say only "generous rate-limits" and ask developers to make contact if limited. The 3,000-req/5-min-per-IP figure is a **hosted-PDS** limit, not an AppView limit. | Cannot be budgeted from docs. Read `ratelimit-*` headers, back off on 429. | https://docs.bsky.app/docs/advanced-guides/rate-limits |
| Lobsters | None | No stated rate limit. **robots.txt `Disallow: /` for all non-whitelisted agents** — see contradictions. | Blocked by robots.txt for a generic client. RSS is the sanctioned path. | https://lobste.rs/robots.txt, https://lobste.rs/about |
| YouTube channel RSS `/feeds/videos.xml?channel_id=` | None | Not a Data API endpoint — **costs zero quota**. No published per-feed limit. | 4 polls/hr per channel, no quota drawdown. | https://developers.google.com/youtube/v3/guides/push_notifications |
| YouTube Data API v3 (for contrast) | API key | 10,000 units/day combined, **plus a separate hard cap of 100 `search.list` calls/day**; `videos.list`/`channels.list`/`playlistItems.list` = 1 unit each | `search.list` at 15 min needs 96 calls/day against a 100/day cap. Unusable. | https://developers.google.com/youtube/v3/determine_quota_cost |
| X / Twitter | Paid, pay-per-use | **No free tier documented.** "The X API uses pay-per-usage pricing. No subscriptions—pay only for what you use." Posts: Read **$0.005 per resource**. 3M post reads/month cap. | N/A — excluded. | https://docs.x.com/x-api/getting-started/pricing |
| Reddit | — | **UNVERIFIED** — could not reach any official page (see below) | N/A | — |

### Per-question answers

**1. Hacker News.** Firebase: no auth, and the doc states outright *"There is
currently no rate limit."* Comments are **not** nested — an item exposes `kids`
(comment ids in ranked display order) and each comment has a `parent`; the doc
tells you to "Load the item and get their IDs, then load them." A 200-comment
thread is ~200 requests. `descendants` gives the total comment count without
traversal. `/topstories` and `/newstories` cap at 500 ids; `/updates` returns
changed item ids, which is the cheap delta channel.

Algolia: the `items/{id}` endpoint **does** return the full nested tree — I
fetched `hn.algolia.com/api/v1/items/1` and confirmed a recursive `children`
array (story → comment 15 → 17 → 1079), each child carrying the same key set
with `type: "comment"`. So one Algolia request replaces N Firebase requests for
a thread. That is the single biggest ingestion lever in this ticket.

The **~10k req/hr figure is UNVERIFIED**. `hn.algolia.com/api` is a
client-rendered SPA that serves no documentation text to a fetcher, and the
number appears only in third-party npm wrappers. Algolia's platform docs do
document the underlying `maxQueriesPerIPPerHour` mechanism and note it is
applied *per server in a 3-server cluster* (so a nominal limit of N permits up
to 3N), but HN's actual key configuration is not public. Treat the limit as
unknown, self-cap, and handle 429.

**2. GitHub.** Limits as tabled. **There is no trending endpoint** — confirmed
absent across the REST repos, search, and starring reference pages. Cheapest
substitute: `GET /search/repositories?q=created:>YYYY-MM-DD stars:>N&sort=stars&order=desc`
— one call against the 30/min search budget, capped at 1,000 returned results
and a 4,000-repo match scope.

Watchlist releases + stars: **use GraphQL, not REST.** REST costs 1 request per
repo per poll (100 repos = 100 of 1,250). GraphQL batches them: 100 repos each
with `releases(first: 5)` is 1 + 100 = 101 underlying requests → 101 ÷ 100 →
**1 point**. Effectively free.

The real lever is conditional requests: *"Making a conditional request does not
count against your primary rate limit if a 304 response is returned and the
request was made while correctly authorized with an Authorization header."*
To maximize 304s the docs say request only the fields you need, use a **stable**
sort order (not `sort=updated`), and keep query params byte-identical between
polls. Also honor `x-poll-interval` when present.

**Watch out:** the starring reference page carries a July 2026 notice that access
to the **stargazers listing** endpoints is being limited to admins and
collaborators. The `stargazers_count` field on the repository object is
unaffected, so star *totals* and deltas survive; per-star *timestamps* via
`application/vnd.github.star+json` may not.

**3. Bluesky.** The read path is genuinely free and ungated — confirmed, and
more strongly than expected: `public.api.bsky.app` **does not support
authentication at all**, and the docs explicitly request developers use it for
"public web" use cases because it is cached. Un-authed `app.bsky.*` endpoints
(`getAuthorFeed`, `getProfile`, feed reads) work there; write paths do not.

Two gaps. First, **no numeric AppView limit is published** — only the phrase
"generous rate-limits" and an invitation to make contact. The 3,000-per-5-min
per-IP number circulating in developer discussions is the **hosted PDS** limit
from the same doc, not the AppView, and applying it to AppView planning would be
wrong. Second, **whether AppView polling gives adequate tech-slice coverage
versus Jetstream is not answerable from documentation** — it depends on which
feed generators exist and how much a 15-minute sample misses. That is a
prototype question, not a docs question.

**4. Lobsters.** The `.json` suffix is **real but undocumented**. Nothing on
`/about` or in the README mentions an API, JSON, rate limits, or crawling. But
the BSD-licensed source is itself primary, and it confirms support:

- `config/routes.rb:14` — `get "/hottest" => "home#index", :format => "json"`
- `config/routes.rb:141` — `get "/c/:id.json" => "comments#show_short_id", :format => "json"`
- `config/routes.rb:204` — `get "/tags.json" => "tags#index", :format => "json"`
- `app/controllers/home_controller.rb` — both `index` and `newest` carry
  `format.json { render json: @stories }`
- `app/controllers/stories_controller.rb` `#show` — `format.json` branch present,
  and a comment reading `# canonicalize on title_path for html (json is ok with just short_id)`

So `/hottest.json`, `/newest.json`, and `/s/{id}.json` all work and are
deliberate in code — but they carry **no compatibility promise** and no
documented rate limit. `/newest` and `/s/:id` get JSON via Rails' implicit
`(.:format)` rather than an explicit route declaration, so they are the more
fragile two.

The ToS constraint is the serious finding — see contradictions below.

**5. YouTube.** Confirmed on both counts. `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`
is named verbatim in Google's own Data API v3 documentation as the topic URL for
PubSubHubbub subscriptions, which makes it an officially referenced, currently
supported feed. It is not a Data API endpoint, so it draws **zero quota** and
needs **no key**. This matters more than it looks: the Data API alternative
(`search.list` filtered by channel) is capped at **100 calls per day** in its own
bucket, and 15-minute polling would need 96/day for a *single* channel. RSS is
not merely cheaper, it is the only viable option at this cadence.

Note the docs also describe push (PubSubHubbub) delivering upload/title/description
changes to a webhook. That is a real option later, but it needs an inbound
callback endpoint, which cuts against the map's all-polling constraint.

**6. Reddit and X.**

X — **exclusion confirmed, and the map's number is exactly right.** The official
pricing page states *"The X API uses pay-per-usage pricing. No subscriptions—pay
only for what you use."* No free tier is documented anywhere on it. Posts: Read
is **$0.005 per resource**, matching the map. Additional detail: resources are
deduplicated across a 24-hour UTC window, and pay-per-use accounts cap at 3M post
reads per billing cycle. Note the pricing *model* has changed from the tiered
Free/Basic/Pro structure — it is now pure pay-per-use, so any spec text
describing "no free read tier since Feb 2026" should be reworded to describe the
current pay-per-use model rather than a tier table.

Reddit — **could not verify from any official source, and this gap is
structural.** `reddit.com` and `redditinc.com` refuse this agent outright, and
`support.reddithelp.com` returns 403 to both the fetcher and a direct request.
Every accessible statement about the 100 QPM free tier, the non-commercial
restriction, the ~$12k/yr commercial tier, and the replacement of self-service
OAuth registration with a manual approval queue traces back to third-party
blogs — the exact category of source this ticket exists to get away from. **The
map's Reddit exclusion is currently unverified.** It is probably correct, but it
rests on the same evidence the ticket distrusts. If Reddit matters, someone with
a browser has to read the Data API Wiki and Developer Terms directly.

### Contradictions with the map's Notes

**Lobsters is the real problem.** `lobste.rs/robots.txt` sets, for
`User-agent: *`, a bare **`Disallow: /`** — the entire site. Only seven named
crawlers are permitted (Applebot, BingBot, DuckDuckBot, GoogleBot, ia_archiver,
Kagibot, Slurp), and even those are blocked from `/search`, `/page/`, and
`/comments/page/`. Their group also carries
`Content-Signal: ai-input=no, ai-train=no, search=yes`. Zis is an AI
summarization pipeline, so `ai-input=no` speaks directly to the intended use, and
a polling JSON client is not on the allowlist. The map lists Lobsters as an
in-scope source on the assumption it is viable free; **on terms, it is closer to
Reddit than to Hacker News**, and the undocumented `.json` endpoints do not
change that. The one sanctioned path is RSS — `/about` says *"Per-tag, multi-tag
and site-wide RSS feeds are available to the public"* — which folds Lobsters into
the existing curated-RSS adapter rather than justifying a bespoke one. This
needs a product decision, not a technical one.

**Bluesky is viable but not budgetable.** The map treats it as viable free,
which holds — the public AppView is unauthenticated by design. But no numeric
limit is published, so no capacity plan can cite one. Any spec figure for
Bluesky polling volume will be an assumption, and should be labeled as such.

**Reddit's exclusion is unverified**, per above. The map states three specific
claims about Reddit as settled; none survive a primary-source check — not
because they are wrong, but because the sources are unreachable from here.

**HN is cheaper than assumed, if Algolia is used for threads.** The map does not
distinguish the two HN APIs. Firebase has no rate limit but requires one request
per comment; Algolia returns whole threads in one request but has an unknown
limit. The sane shape is Firebase for the story list and `/updates` deltas,
Algolia for thread hydration — and that split should be explicit in the
ingestion spec.

**YouTube via the Data API is not merely expensive, it is impossible** at this
cadence (100 `search.list` calls/day vs. 96 needed per channel). The map's choice
of RSS is not an optimization; it is the only option. Worth stating that way so
nobody "upgrades" to the Data API later.

**GitHub stargazer listing access narrows in July 2026.** If the ranking model
wants per-star timestamps to compute velocity, that path may close. Star
*totals* from `stargazers_count` are unaffected. This intersects the map's open
"Cold start for velocity scoring" question.

### Fetcher defaults implied by these sources

- **Conditional requests everywhere.** GitHub exempts authenticated 304s from
  the primary rate limit outright; RSS/Atom feeds honor `If-None-Match` and
  `If-Modified-Since` by convention. Persist `etag` and `last-modified` per URL
  from day one — retrofitting this is painful.
- **Stable query shape.** GitHub's own guidance: request only needed fields, use
  a stable sort (never `sort=updated`), keep params byte-identical across polls,
  or the ETag changes and the 304 never arrives.
- **Serial, not concurrent.** GitHub caps concurrency at 100 shared across REST
  and GraphQL and advises a request queue over parallel fan-out. ≥1s between
  mutating requests.
- **Backoff ladder.** Honor `retry-after`; else if `x-ratelimit-remaining` is 0,
  wait for `x-ratelimit-reset`; else pause ≥1 minute and back off exponentially,
  giving up after a bounded number of attempts. GitHub notes persistent
  violation "may result in the banning of your integration."
- **Honor `x-poll-interval`** where returned.
- **Per-host crawl delay from robots.txt.** `news.ycombinator.com/robots.txt`
  sets `Crawl-delay: 30` for all agents (this governs HTML scraping of the site;
  the Firebase API is a different host and unaffected). `lobste.rs` sets
  `Crawl-delay: 1` on the wildcard group — moot, since that group is also
  `Disallow: /`.
- **Parse and obey robots.txt per host before fetching**, including for article
  fetches from the general web. The Lobsters case shows an assumed-viable source
  failing this check; it will not be the last.
- **UNVERIFIED: GitHub's User-Agent requirement.** GitHub does require a
  `User-Agent` header, but the REST best-practices page carries no guidance on
  its format and I did not confirm the requirement from a primary page. Send a
  descriptive UA with a contact URL regardless — it is the norm, and it is what
  lets a site operator ask you to stop instead of silently blocking you.
