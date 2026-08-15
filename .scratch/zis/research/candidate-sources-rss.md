# Zis — Candidate RSS/Atom Sources

Labels: `wayfinder:research`
Scope: **RSS/Atom feeds only.** YouTube channel feeds, GitHub, and Bluesky are
handled by a separate agent and are deliberately absent here.

## Selection principle

Sources are picked for **overlapping coverage**, not individual quality. Zis
clusters by co-citation of the same canonical URL across *distinct sources*
(map.md: "rank by DISTINCT SOURCES citing a URL, never total mentions"), so a
source only earns its slot if it is likely to link the same URL as some other
source in this list.

This is why the **corporate engineering-blog genre is almost entirely excluded**
despite dominating every public awesome-list. `kilimchoi/engineering-blogs`
carries ~700 feeds (Airbnb Eng, Grab Tech, Deliveroo Eng, Criteo, Feedzai,
Jobandtalent…); `tuan3w/awesome-tech-rss` carries 143. I mined both. The
overwhelming majority are single-company blogs that write about their own
internal work and cite nobody — they are individually interesting and produce
**zero clusters**. Only the handful whose posts are routinely re-linked by the
wider ecosystem (Cloudflare, GitHub, Netflix, Stripe, Discord, Docker, Oxide)
are carried over. The awesome-lists also skew heavily to non-tech verticals
(marketing, psychology, neuroscience) that are out of Zis's domain entirely.

The high-co-citation genres, in rough order of value to clustering:

1. **Newsletters/aggregators** — their entire job is linking other people's URLs.
   Highest cluster yield per feed by a wide margin.
2. **Framework/runtime official blogs** — the *origin* URL that everyone else
   cites. Low volume, but they anchor the biggest clusters.
3. **Link-blog individuals** (Simon Willison above all) — high-frequency,
   deliberately citational.
4. **Tech press** — covers the same releases as everyone else, same week.
5. Everything else.

## Verification method

Every URL below was fetched with `curl -sL` (descriptive UA, feed `Accept`
header), then checked for (a) HTTP 200, (b) a real `<rss` / `<feed` / `<rdf:RDF`
root element, and (c) parsed for item count and newest item date. The
`items` and `newest` figures are **measured, not estimated**, as of 2026-08-15.

`verified?` values:

- **yes** — fetched, HTTP 200, valid feed XML, items present.
- **no** — fetched and failed. Listed in the "Failed / no feed found" section so
  nobody re-spends time on them.
- No entry is marked UNVERIFIED: **every URL in the tables below was fetched.**

**Caveat on `full-text?`**: this column reports whether the feed carries a
`content:encoded` / Atom `<content>` element with substantial bytes-per-item. It
is a strong signal, not a guarantee that the *entire* article body is present —
a few publishers put a long teaser in `content:encoded`. Where the measurement
is inferential I write `full*`.

**Caveat on frequency**: derived from the newest 3 item dates plus item count.
For low-volume blogs this is a small sample.

---

## 1. Newsletters & aggregators

The highest-value category for co-citation and the one the awesome-lists
underweight. Note the Cooper Press family (JavaScript Weekly, Node Weekly, React
Status, Frontend Focus, Golang Weekly, Postgres Weekly, Ruby Weekly) all share
one platform: **their RSS carries only ~4 recent issues and the item body is an
excerpt, not the link list.** To extract the cited URLs you must fetch the issue
page. Budget for that — it is the single most important ingestion detail in this
document, because these are the feeds most likely to *create* clusters.

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| JavaScript Weekly | `https://javascriptweekly.com/rss` | weekly (Tue) | excerpt | yes | **Top-tier co-citation.** 4 items retained. Must fetch issue page for links. |
| Node Weekly | `https://nodeweekly.com/rss` | weekly (Thu) | excerpt | yes | Cooper Press. 4 items retained. |
| React Status | `https://react.statuscode.com/rss` | weekly (Fri) | excerpt | yes | Cooper Press. 4 items retained. |
| Frontend Focus | `https://frontendfoc.us/rss` | weekly (Wed) | excerpt | yes | Cooper Press. Overlaps JS Weekly heavily — good, that's the point. |
| Golang Weekly | `https://golangweekly.com/rss` | weekly (Fri) | excerpt | yes | Cooper Press. |
| Postgres Weekly | `https://postgresweekly.com/rss` | weekly (Wed) | excerpt | yes | Cooper Press. Pairs with Planet PostgreSQL. |
| Ruby Weekly | `https://rubyweekly.com/rss` | weekly (Thu) | excerpt | yes | Cooper Press. Lower priority unless Ruby is in the interest profile. |
| PyCoder's Weekly | `https://pycoders.com/feed` | weekly (Tue) | full* | yes | Atom `<content>`, ~32 KB/item — link list likely IS in the feed. Better shape than Cooper Press. |
| This Week in Rust | `https://this-week-in-rust.org/rss.xml` | weekly (Wed) | excerpt | yes | ~53 KB/item — huge link list. |
| TLDR | `https://tldr.tech/api/rss/tech` | daily (weekdays) | excerpt | yes | 20 items. Daily cadence = best cluster-seeding cadence in this table. One bogus 2018-dated item in the feed; sort defensively. |
| Console.dev | `https://console.dev/rss.xml` | weekly | excerpt | yes | 8 items. Tools/newsletter; narrower than the rest. |
| Changelog news | `https://changelog.com/news/feed` | irregular | full | yes | 185 items but **newest is 2026-04-29 — going stale.** Verify it's still published before relying on it. |
| Changelog master | `https://changelog.com/feed` | irregular | full | yes | 50 items, newest 2026-07-21. Podcast-heavy. |
| Web Tools Weekly | `https://webtoolsweekly.com/feed/` | weekly (Thu) | excerpt | yes | 20 items, current. |
| CSS Weekly | `https://css-weekly.com/feed/` | weekly-ish | full | yes | **Newest item 2026-05-26 — ~3 months stale.** Include with low expectations. |

## 2. Framework, runtime & browser official blogs

These are the *origin* URLs that newsletters and press cite. Individually low
volume — most publish only on releases — but a release post here is what anchors
the largest clusters in the whole corpus.

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| React (react.dev) | `https://react.dev/rss.xml` | rare (release-driven) | excerpt | yes | 23 items. **Cluster anchor.** Long gaps are normal. |
| Next.js | `https://nextjs.org/feed.xml` | ~monthly | excerpt | yes | 71 items, current. |
| Vercel | `https://vercel.com/atom` | near-daily | full | yes | **1471 items** — very high volume, mixes product/changelog/marketing. Will need filtering or it floods. |
| Vue.js blog | `https://blog.vuejs.org/feed.rss` | **dormant** | full | yes | Valid feed, but **newest item is 2024-09-01**. Vue announcements have moved off this blog. Include only as an archive; do not expect cluster participation. |
| Svelte | `https://svelte.dev/blog/rss.xml` | ~monthly | excerpt | yes | 104 items, current (2026-08-13). |
| Node.js | `https://nodejs.org/en/feed/blog.xml` | weekly-ish | excerpt | yes | 1048 items; includes every security release. Good anchor. |
| Deno | `https://deno.com/feed` | ~monthly | excerpt | yes | 249 items. |
| Bun | `https://bun.com/rss.xml` | irregular | excerpt | yes | 176 items. Note domain is `bun.com`, not `bun.sh`. |
| TypeScript | `https://devblogs.microsoft.com/typescript/feed/` | ~6/yr | full | yes | Release posts are major cluster anchors. |
| Rust | `https://blog.rust-lang.org/feed.xml` | ~6-weekly | full | yes | Release cadence is predictable — good clustering test data. |
| Inside Rust | `https://blog.rust-lang.org/inside-rust/feed.xml` | ~monthly | full | yes | Governance/team posts. Lower co-citation than main blog. |
| Go | `https://go.dev/blog/feed.atom` | ~monthly | full | yes | Newest 2026-05-21 — slow but alive. |
| Astro | `https://astro.build/rss.xml` | ~monthly | excerpt | yes | 184 items, current. |
| Vite | `https://vite.dev/blog.rss` | rare | full | yes | 12 items. Major-release anchor. |
| Tailwind CSS | `https://tailwindcss.com/feeds/feed.xml` | rare | excerpt | yes | Newest 2026-05-08. Very low volume. |
| Angular | `https://blog.angular.dev/feed` | ~fortnightly | full | yes | Medium-hosted. Current. |
| Nuxt | `https://nuxt.com/blog/rss.xml` | ~monthly | excerpt | yes | Note path: `/blog/rss.xml`, not `/rss.xml`. |
| React Router / Remix | `https://remix.run/blog/rss.xml` | rare | excerpt | yes | Newest 2026-06-17. |
| Python Insider | `https://blog.python.org/feeds/posts/default` | ~weekly | excerpt | yes | Blogger-hosted. Every CPython release. |
| Django | `https://www.djangoproject.com/rss/weblog/` | ~weekly | excerpt | yes | Current. |
| Ruby on Rails | `https://rubyonrails.org/feed.xml` | ~monthly | full | yes | Current. |
| Laravel News | `https://laravel-news.com/feed` | daily | full | yes | Use `laravel-news.com/feed`, **not** `feed.laravel-news.com`. Really a newsletter/aggregator — high co-citation within PHP. |
| Zig | `https://ziglang.org/news/index.xml` | rare | excerpt | yes | 29 items. |
| V8 | `https://v8.dev/blog.atom` | rare | full | yes | **Newest 2025-08-04 — a year stale.** Low priority. |
| WebKit | `https://webkit.org/feed/atom/` | ~monthly | full | yes | Use `/feed/atom/`; plain `/feed/` returns 403. Safari release notes = strong cluster anchor. |
| Mozilla Hacks | `https://hacks.mozilla.org/feed/` | ~monthly | full | yes | Newest 2026-06-23. |
| Chrome for Developers | `https://developer.chrome.com/static/blog/feed.xml` | ~weekly | excerpt | yes | 10 items retained; newest 2026-06-22. |
| web.dev | `https://web.dev/static/blog/feed.xml` | ~monthly | excerpt | yes | 10 items. Overlaps Chrome blog. |

## 3. Infra & platform

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| Cloudflare | `https://blog.cloudflare.com/rss/` | near-daily | full | yes | **Best-in-class.** High volume, high external citation, Birthday Week / Developer Week produce guaranteed clusters. |
| GitHub blog | `https://github.blog/feed/` | daily | full | yes | Strong anchor. |
| GitHub changelog | `https://github.blog/changelog/feed/` | multiple/day | full | yes | Very high volume, small items. Great for co-citation, needs rate discipline. |
| Fly.io | `https://fly.io/blog/feed.xml` | ~monthly | full | yes | 40 items. Distinctive writing; gets linked. |
| Neon | `https://neon.com/blog/rss.xml` | near-daily | full | yes | 474 items. Note `neon.com` (not `.tech`). Relevant to Zis's own stack. |
| Supabase | `https://supabase.com/rss.xml` | ~weekly | excerpt | yes | 419 items. Launch Week = reliable cluster generator. |
| Render | `https://render.com/blog/feed.xml` | ~weekly | excerpt | yes | Use `/feed.xml`; `/rss.xml` 404s. One future-dated item observed — sort defensively. |
| PlanetScale | `https://planetscale.com/blog/rss.xml` | ~weekly | full | yes | 25 items, ~40 KB each. |
| Val Town | `https://blog.val.town/rss.xml` | ~weekly | excerpt | yes | Use `blog.val.town`, not `/blog/`. |
| Docker | `https://www.docker.com/feed/` | ~weekly | full | yes | Current. |
| Stripe | `https://stripe.com/blog/feed.rss` | ~monthly | excerpt | yes | Low volume, high citation when it fires. |
| Discord | `https://discord.com/blog/rss.xml` | ~weekly | excerpt | yes | 100 items. Some date disorder in feed. |
| Netflix TechBlog | `https://netflixtechblog.com/feed` | ~weekly | full | yes | Medium-hosted. The one corporate eng blog with reliably high external citation. |
| Oxide | `https://oxide.computer/blog/feed` | ~monthly | full | yes | Low volume, disproportionately linked on HN/Lobsters. |
| Sentry | `https://blog.sentry.io/feed.xml` | ~weekly | full | yes | 30 items. |
| AWS News | `https://aws.amazon.com/blogs/aws/feed/` | daily | full | yes | High volume; re:Invent week is a cluster storm. Consider seasonal weighting. |
| Planet PostgreSQL | `https://planet.postgresql.org/rss20.xml` | daily | excerpt | yes | Aggregator of ~all Postgres blogs. Pairs with Postgres Weekly for co-citation. |

## 4. AI / ML

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| **Simon Willison (everything)** | `https://simonwillison.net/atom/everything/` | multiple/day | excerpt | yes | **The single highest-value feed in this document.** Blog + links + quotes merged. Extreme co-citation rate — he links what everyone else is about to link, usually first. |
| Simon Willison (links only) | `https://simonwillison.net/atom/links/` | multiple/day | excerpt | yes | Subset of the above. Use *either* this or `everything`, not both — Zis ranks by distinct sources and the same URL from both feeds would double-count one voice. |
| Simon Willison (entries only) | `https://simonwillison.net/atom/entries/` | ~weekly | excerpt | yes | Long-form only. Same double-count warning. |
| OpenAI news | `https://openai.com/news/rss.xml` | daily | excerpt | yes | 1129 items. Announcement anchor. |
| Google DeepMind | `https://deepmind.google/blog/rss.xml` | ~weekly | excerpt | yes | 100 items, current. |
| Google Research | `https://research.google/blog/rss/` | ~weekly | excerpt | yes | 100 items, current. |
| Hugging Face | `https://huggingface.co/blog/feed.xml` | multiple/day | excerpt | yes | **842 items**, very high volume, much community-authored. Will need quality filtering. |
| Mistral AI | `https://mistral.ai/rss.xml` | ~monthly | excerpt | yes | Use `/rss.xml`, not `/news/feed.xml`. |
| Ollama | `https://ollama.com/blog/rss.xml` | ~monthly | excerpt | yes | 56 items. |
| PyTorch | `https://pytorch.org/blog/feed.xml` | ~weekly | excerpt | yes | 10 items retained. |
| Interconnects (Nathan Lambert) | `https://www.interconnects.ai/feed` | ~2×/week | full | yes | Current (2026-08-14). Heavily citational — good cluster participant. |
| Import AI (Jack Clark) | `https://importai.substack.com/feed` | weekly (Mon) | full | yes | Current. Link-dense. |
| Latent Space | `https://www.latent.space/feed` | ~2×/week | full | yes | Current. ~46 KB/item. |
| Sebastian Raschka | `https://magazine.sebastianraschka.com/feed` | ~monthly | full | yes | 125 KB/item. Newest 2026-07-18. |
| Lil'Log (Lilian Weng) | `https://lilianweng.github.io/index.xml` | rare (~3/yr) | excerpt | yes | Low volume, very high citation when it fires. |
| BAIR | `https://bair.berkeley.edu/blog/feed.xml` | ~monthly | excerpt | yes | Current. |
| The Gradient | `https://thegradient.pub/rss/` | **dormant** | full | yes | Valid feed; **newest 2026-02-18**. Low priority. |

**Anthropic has no discoverable public RSS/Atom feed.** I probed
`/news/rss.xml`, `/engineering/rss.xml`, `/rss.xml` (all 404) and ran `<link
rel=alternate>` autodiscovery on `anthropic.com/news` (no feed link — the page
is JS-rendered). Same result for **Meta AI** (`ai.meta.com/blog`) and
**LangChain** (`blog.langchain.dev` now 301s to a Webflow marketing site with no
feed). These are real gaps: given the brief's emphasis on AI coverage, Anthropic
announcements will have to arrive via *other* sources citing them — which the
co-citation model actually handles gracefully, but it means Anthropic can never
be the anchoring source of its own cluster.

## 5. High-signal individual writers

Ranked roughly by co-citation value. Several are **stale** — flagged, because a
dormant feed silently contributes nothing and is worth knowing about up front.

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| Jim Nielsen | `https://blog.jim-nielsen.com/feed.xml` | ~3×/week | excerpt | yes | Current (2026-08-14). Link-blog format — **high co-citation**, underrated. |
| Armin Ronacher | `https://lucumr.pocoo.org/feed.atom` | ~monthly | full | yes | Current. Reliably HN-front-paged. |
| Martin Fowler | `https://martinfowler.com/feed.atom` | ~weekly | full | yes | Current. |
| Pragmatic Engineer | `https://blog.pragmaticengineer.com/rss/` | weekly | full | yes | Current. Public posts only (paid tier not in feed). |
| Xe Iaso | `https://xeiaso.net/blog.rss` | ~weekly | full | yes | Current. |
| Chris Coyier | `https://chriscoyier.net/feed/` | ~weekly | full | yes | Current. Link-heavy — good clusterer. |
| Bramus | `https://www.bram.us/feed/` | ~weekly | full | yes | Current. CSS/web-platform link blog — **high co-citation**. |
| Lethain (Will Larson) | `https://lethain.com/feeds/` | ~monthly | excerpt | yes | Current. |
| Jake Archibald | `https://jakearchibald.com/posts.rss` | rare | full | yes | Current (2026-08-11). Low volume, very high citation. |
| Julia Evans | `https://jvns.ca/atom.xml` | ~2×/month | full | yes | Newest 2026-07-21. |
| Rachel Andrew | `https://rachelandrew.co.uk/feed/` | ~weekly | full | yes | Current. |
| Hillel Wayne | `https://buttondown.com/hillelwayne/rss` | ~2×/month | excerpt | yes | Current. |
| Dan Luu | `https://danluu.com/atom.xml` | rare | excerpt | yes | Newest 2026-08-09. 128 items, ~87 KB each — **11 MB feed**, fetch cost is real. |
| Nolan Lawson | `https://nolanlawson.com/feed/` | ~monthly | full | yes | Newest 2026-05-25. |
| Lea Verou | `https://lea.verou.me/feed.xml` | ~monthly | full | yes | Newest 2026-08-06. 242 items with 2009 dates interleaved — date parsing needs care. |
| Stefan Judis | `https://www.stefanjudis.com/rss.xml` | ~monthly | full | yes | Newest 2026-08-04. 64 KB/item. |
| Baldur Bjarnason | `https://www.baldurbjarnason.com/index.xml` | ~weekly | full | yes | Use `/index.xml`; `/feed.xml` returns non-XML. Newest 2026-07-20. |
| Josh Comeau | `https://www.joshwcomeau.com/rss.xml` | rare (~6/yr) | full | yes | Newest 2026-07-06. Low volume but heavily linked when it fires. |
| Dan Abramov | `https://overreacted.io/rss.xml` | rare | excerpt | yes | Newest 2026-06-19. **Cluster anchor when active** — a new Abramov post is co-cited by React Status, JS Weekly, HN, and half the writers above. |
| Sophie Alpert | `https://www.sophiebits.com/atom.xml` | rare | excerpt | yes | Newest 2026-06-25. |
| Ryan Carniato | `https://dev.to/feed/ryansolid` | rare | excerpt | yes | dev.to feed (no personal blog feed). Newest 2026-03-13 — going quiet. |
| Amos / fasterthanlime | `https://fasterthanli.me/index.xml` | **stale** | excerpt | yes | Newest 2025-12-31. Has largely moved to video. Low priority. |
| Anthony Fu | `https://antfu.me/feed.xml` | **stale** | full | yes | Newest 2025-04-28. Named in the brief, but the feed is ~16 months dormant. Include only if you accept it may never fire. |
| Kent C. Dodds | `https://kentcdodds.com/blog/rss.xml` | **stale** | excerpt | yes | Newest 2026-03-16. |
| Matt Pocock | `https://www.totaltypescript.com/rss.xml` | **dormant** | excerpt | yes | Named in the brief, but **newest item is 2023-11-30**. This feed is dead; his output moved to video/X. Recommend dropping. |

**Lee Robinson has no working feed.** Probed `leerob.com/rss.xml`,
`/feed.xml`, `/rss`, `/api/rss.xml` and `leerob.io/feed.xml` — all 404.

## 6. Tech press & community aggregators

| name | feed URL | frequency | full-text? | verified? | notes |
|---|---|---|---|---|---|
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/index` | multiple/day | full* | yes | Current. `content:encoded` present but Ars truncates — treat as long excerpt. |
| The Register | `https://www.theregister.com/headlines.atom` | multiple/day | excerpt | yes | 50 items. Fast on infra/cloud news. |
| LWN | `https://lwn.net/headlines/newrss` | daily | excerpt | yes | Free headlines only; subscriber content gated for ~1 week. Best-in-class kernel/Linux signal. |
| InfoQ | `https://feed.infoq.com/` | multiple/day | excerpt | yes | 15 items. As the brief warned — mixed quality, but genuinely high co-citation with framework releases. Keep, weight down. |
| The New Stack | `https://thenewstack.io/blog/feed/` | multiple/day | full | yes | 26 items. Cloud-native focus. Some SEO-ish filler; weight down. |
| The Verge | `https://www.theverge.com/rss/index.xml` | multiple/day | full | yes | Consumer-skewed. Include for big-tech events only. |
| TechCrunch | `https://techcrunch.com/feed/` | multiple/day | excerpt | yes | Funding-announcement noise is high. **Weight down or cut** — closest thing here to an SEO farm. |
| 404 Media | `https://www.404media.co/rss/` | daily | full | yes | Original reporting, high external citation. Good signal-per-item. |
| Phoronix | `https://www.phoronix.com/rss.php` | many/day | excerpt | yes | 32 items. Very high volume, narrow (Linux/hardware). Include only if that's in the interest profile. |
| Stack Overflow blog | `https://stackoverflow.blog/feed/` | ~2×/week | excerpt | yes | 40 items. |
| Smashing Magazine | `https://www.smashingmagazine.com/feed/` | ~2×/week | full | yes | 40 items, ~34 KB each. |
| CSS-Tricks | `https://css-tricks.com/feed/` | ~2×/week | excerpt | yes | Current (2026-08-14) — still alive post-DigitalOcean. |
| Quanta Magazine | `https://api.quantamagazine.org/feed/` | ~3×/week | full | yes | Note the `api.` host. Science, not tech — include only if in profile. |

**Two entries deliberately flagged rather than recommended:**

| name | feed URL | verified? | why flagged |
|---|---|---|---|
| Hacker News frontpage | `https://hnrss.org/frontpage` | yes | Works, current. But **HN has its own adapter** per map.md (Firebase + Algolia), which gives scores, comment trees, and `/updates` deltas that RSS cannot. Ingesting both would double-count HN as two distinct sources and corrupt the distinct-source ranking. **Do not add as RSS.** |
| Lobsters | `https://lobste.rs/rss` | yes | Feed works. But Ticket 01 found **Lobsters fails the `robots.txt` / polite-fetching check**, and map.md treats polite fetching as a hard rule. Listed for completeness; **excluded on policy, not on quality.** |

## 7. Failed / no feed found

Recorded so nobody re-spends time. All probed 2026-08-15.

| name | URLs tried | result |
|---|---|---|
| Anthropic | `/news/rss.xml`, `/engineering/rss.xml`, `/rss.xml`, autodiscovery on `/news` | 404 / no feed link |
| Meta AI | `ai.meta.com/blog/rss`, `/rss/`, autodiscovery | 404 / no feed link |
| LangChain | `blog.langchain.com/rss/`, `blog.langchain.dev/rss/`, `changelog.langchain.com/feed.xml` | 301→Webflow HTML |
| Lee Robinson | `leerob.com/rss.xml`, `/feed.xml`, `/rss`, `/api/rss.xml`, `leerob.io/feed.xml` | all 404 |
| Turso | `turso.tech/blog/rss.xml`, `/rss.xml`, `/blog/rss`, `blog.turso.tech/rss.xml` | all 404 |
| Railway | `blog.railway.com/rss/`, `blog.railway.app/rss/`, `railway.com/blog/rss.xml`, `/feed.xml` | all 404 |
| Electron | `electronjs.org/feed.xml`, `/blog/feed.xml`, `/blog.xml`, `/blog/feed` | all 404 |
| SolidJS | `solidjs.com/blog/rss.xml`, `/blog/feed.xml` | 200 but returns HTML |
| Bytes.dev | `/rss.xml`, `/feed`, `/rss` | all 404 |

---

# (a) Expected co-citation clusters

This is the test data the clustering prototype should be judged against. Each
block names an event type, the canonical URL that gets cited, and the **distinct
sources** expected to cite it. Zis ranks by distinct-source count, so the number
in brackets is the target cluster size.

### C1 — A React release or major React Team post [7-9 sources]
Canonical URL: `react.dev/blog/...`
Cited by: **react.dev** (origin) · **React Status** · **JavaScript Weekly** ·
**Frontend Focus** · **Vercel blog** · **InfoQ** · **hnrss/HN adapter** ·
**Josh Comeau** (if it touches rendering) · **Jim Nielsen**.
This is the canonical happy-path cluster. Fires only a few times a year — note
`react.dev/rss.xml` has just 23 items ever, so don't tune thresholds on it alone.

### C2 — A TypeScript release (e.g. 5.x / 6.0 beta) [6-8 sources]
Canonical URL: `devblogs.microsoft.com/typescript/announcing-typescript-...`
Cited by: **TypeScript devblog** (origin) · **JavaScript Weekly** · **Node
Weekly** · **Frontend Focus** · **InfoQ** · **The New Stack** · **HN** ·
**Stefan Judis**. (Matt Pocock *would* be the ninth — his feed is dead, which is
exactly the cost of a dormant source.)

### C3 — A Rust release / major Rust RFC [5-7 sources]
Canonical URL: `blog.rust-lang.org/...`
Cited by: **Rust blog** (origin) · **This Week in Rust** · **Inside Rust** ·
**LWN** · **InfoQ** · **HN** · **Armin Ronacher** / **Xe Iaso** / **Amos**
(rotating).
Strong test case because This Week in Rust is a *pure* aggregator — if the
prototype can't extract its link list, this cluster collapses to 2.

### C4 — A Cloudflare Birthday/Developer Week announcement [6-8 sources]
Canonical URL: `blog.cloudflare.com/...`
Cited by: **Cloudflare** (origin) · **The Register** · **The New Stack** ·
**InfoQ** · **HN** · **Simon Willison** · **JavaScript Weekly** (if Workers-
related) · **Jim Nielsen**.
Bursty: five posts in one day. Good stress test for **temporal decay** and for
the "correlated burst produces thin clusters" failure mode memeorandum exhibits.

### C5 — A frontier-model launch (OpenAI / DeepMind / Mistral) [7-10 sources]
Canonical URL: `openai.com/index/...` or `deepmind.google/...`
Cited by: **OpenAI/DeepMind/Mistral** (origin) · **Simon Willison** (almost
always within hours) · **Interconnects** · **Latent Space** · **Import AI** ·
**TLDR** · **Ars Technica** · **The Verge** · **TechCrunch** · **HN**.
Largest and most reliable cluster family in the corpus. **Also the best test of
the interest-profile filter** — it will fire constantly, and without filtering
Zis becomes an AI-news site.

### C6 — An Anthropic announcement [5-7 sources, ZERO from origin]
Canonical URL: `anthropic.com/news/...`
Cited by: **Simon Willison** · **Interconnects** · **Latent Space** · **TLDR** ·
**Ars Technica** · **HN** · **Import AI**.
**Deliberately included as an adversarial case.** Anthropic publishes no feed, so
the origin never appears. Tests that clustering keys on the *cited URL*, not on
having ingested that URL as an item. If the prototype can only cluster URLs it
has itself ingested, this cluster does not form — and that is a design bug worth
finding early.

### C7 — A web-platform / CSS feature ships in a browser [5-7 sources]
Canonical URL: `webkit.org/blog/...` or `developer.chrome.com/blog/...`
Cited by: **WebKit** or **Chrome for Developers** (origin) · **Bramus**
(near-certain) · **Rachel Andrew** · **Lea Verou** · **CSS-Tricks** · **Frontend
Focus** · **Smashing Magazine** · **Jim Nielsen**.
The **densest non-AI cluster** available. Bramus + Rachel Andrew + Lea Verou is
a deliberately redundant trio — that redundancy is the whole point.

### C8 — A Postgres release or major extension [4-6 sources]
Canonical URL: `postgresql.org/about/news/...`
Cited by: **Planet PostgreSQL** · **Postgres Weekly** · **Neon** · **Supabase** ·
**PlanetScale** · **LWN** · **HN**.
Note Neon/Supabase/PlanetScale are *competitors* who all blog about the same
upstream release — a clean natural experiment in vendor-independent co-citation.

### C9 — A viral long-form engineering post [4-8 sources]
Canonical URL: any of `danluu.com`, `lucumr.pocoo.org`, `oxide.computer/blog`,
`jvns.ca`, `netflixtechblog.com`.
Cited by: **HN** · **Lobsters** (if policy allowed) · **Simon Willison** ·
**Jim Nielsen** · **Changelog** · **TLDR** · **Pragmatic Engineer** ·
**Hillel Wayne**.
Tests the "no official origin, discovered purely by co-citation" path — the case
where Zis genuinely beats a plain reader.

### C10 — A Node.js security release [4-5 sources]
Canonical URL: `nodejs.org/en/blog/vulnerability/...`
Cited by: **Node.js blog** (origin) · **Node Weekly** · **JavaScript Weekly** ·
**The Register** · **InfoQ** · **Sentry**.
Predictable cadence, easy to schedule a test around.

### Negative controls (should NOT cluster)
Deliberately include these to check for false merges:
- **AWS News blog** during a normal week — high volume, near-zero external citation.
- **GitHub changelog** items — many per day, each cited by nobody.
- **Hugging Face blog** community posts — 842 items, mostly uncited.
- **Vercel blog** marketing posts — 1471 items, most never linked externally.
If the prototype forms clusters out of these, it is clustering on *topic
similarity* rather than *shared cited URL* — i.e. the embedding pass has been let
loose where the deterministic spine should rule (map.md: "the LLM names and
summarizes clusters, it never detects them").

---

# (b) Minimum viable 30

Optimized for **co-citation density**, not breadth. The logic: buy the
aggregators first (they manufacture clusters), then the origin blogs those
aggregators most reliably cite, then a small redundant set of citational
individuals. Several excellent feeds are cut purely because nothing else in the
30 would ever co-cite them.

**Tier 1 — Aggregators (7).** Highest cluster yield per feed.
1. `https://simonwillison.net/atom/everything/` — Simon Willison
2. `https://tldr.tech/api/rss/tech` — TLDR (daily; only daily aggregator here)
3. `https://javascriptweekly.com/rss` — JavaScript Weekly
4. `https://react.statuscode.com/rss` — React Status
5. `https://frontendfoc.us/rss` — Frontend Focus
6. `https://this-week-in-rust.org/rss.xml` — This Week in Rust
7. `https://blog.jim-nielsen.com/feed.xml` — Jim Nielsen (link blog, 3×/week)

**Tier 2 — Origin blogs the aggregators cite (11).**
8. `https://react.dev/rss.xml` — React
9. `https://nextjs.org/feed.xml` — Next.js
10. `https://devblogs.microsoft.com/typescript/feed/` — TypeScript
11. `https://nodejs.org/en/feed/blog.xml` — Node.js
12. `https://blog.rust-lang.org/feed.xml` — Rust
13. `https://go.dev/blog/feed.atom` — Go
14. `https://blog.cloudflare.com/rss/` — Cloudflare
15. `https://github.blog/feed/` — GitHub
16. `https://openai.com/news/rss.xml` — OpenAI
17. `https://deepmind.google/blog/rss.xml` — Google DeepMind
18. `https://webkit.org/feed/atom/` — WebKit

**Tier 3 — Press with genuine co-citation (5).**
19. `https://feeds.arstechnica.com/arstechnica/index` — Ars Technica
20. `https://www.theregister.com/headlines.atom` — The Register
21. `https://lwn.net/headlines/newrss` — LWN
22. `https://feed.infoq.com/` — InfoQ (weighted down)
23. `https://www.404media.co/rss/` — 404 Media

**Tier 4 — Citational individuals, chosen for redundancy (7).**
24. `https://www.bram.us/feed/` — Bramus (web platform)
25. `https://rachelandrew.co.uk/feed/` — Rachel Andrew (redundant with Bramus **on purpose**)
26. `https://lucumr.pocoo.org/feed.atom` — Armin Ronacher
27. `https://www.interconnects.ai/feed` — Interconnects (AI)
28. `https://www.latent.space/feed` — Latent Space (redundant with Interconnects on purpose)
29. `https://blog.pragmaticengineer.com/rss/` — Pragmatic Engineer
30. `https://chriscoyier.net/feed/` — Chris Coyier

### Why these 30 and not others

- **Redundancy is a feature.** Bramus/Rachel Andrew and Interconnects/Latent
  Space are near-duplicates in topic. A breadth-optimized list would cut one of
  each; a co-citation-optimized list keeps both, because two sources citing one
  URL *is* the signal. This is the single biggest way this list differs from a
  conventional "best 30 tech feeds".
- **Six of the seven Tier-1 aggregators are JS/web-skewed**, which concentrates
  the corpus rather than spreading it. Deliberate: 30 feeds spread across ten
  ecosystems produce singleton clusters. Better to cover three ecosystems
  densely (JS/web, Rust/systems, AI) than ten thinly.
- **Cut despite quality**: Dan Luu, Julia Evans, Josh Comeau, Dan Abramov, Jake
  Archibald, Lea Verou, Martin Fowler, Oxide, Netflix — all excellent, all *low
  frequency*. At 30 feeds they'd mostly contribute nothing on a given day. They
  are the first additions at 40-50 feeds, where the corpus is dense enough that a
  rare post lands in an existing cluster instead of sitting alone.
- **Cut on policy**: HN via `hnrss` (has its own adapter — double-counting risk),
  Lobsters (fails the robots.txt rule per Ticket 01).
- **Cut as noise**: TechCrunch, The Verge, Phoronix, AWS News, GitHub changelog,
  Hugging Face, Vercel — all high volume, all low external-citation-per-item.
  They add fetch cost and dilute the distinct-source count without adding
  clusters. Add them later *with* down-weighting, not now.
- **Cut as dead**: Matt Pocock, Anthony Fu, Vue.js blog, V8, The Gradient — named
  in the brief or obvious picks, but measurably dormant.

### Ingestion notes that bear on the 30

- **7 of the 30 are excerpt-only aggregators whose link lists are not in the
  feed** (the Cooper Press trio, TLDR, This Week in Rust). Extracting cited URLs
  requires fetching the issue page — subject to the same robots.txt/polite-
  fetching rule. **If this is not built, the 30 loses most of its cluster-forming
  power.** Treat it as a prerequisite, not an enhancement.
- **Feed sizes vary by 3 orders of magnitude** (Hugging Face 842 items / Dan Luu
  ~11 MB vs React 23 items). Conditional requests (`etag`/`last-modified`) matter
  disproportionately for the large ones.
- **Date fields are unreliable** in several verified feeds: TLDR has a 2018-dated
  item, Render has a future-dated item, Lea Verou interleaves 2009 dates, Discord
  is out of order. Sort defensively and clamp to `now`.
