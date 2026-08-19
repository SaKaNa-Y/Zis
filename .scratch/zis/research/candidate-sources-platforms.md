# Candidate Sources — Platforms (YouTube, GitHub, Bluesky)

Scope: non-RSS platform sources for Zis. RSS/Atom feeds are covered by a separate
document. Sources here are chosen for **overlapping coverage** — the value of a
source is not its uniqueness but its tendency to cite the same canonical URL as
another source on the same day.

Builds on [Ticket 01](../issues/01-verify-source-api-limits.md):

- ~~YouTube channel RSS costs **zero Data API quota** and needs **no key**; the
  Data API path is not merely expensive but impossible at a 15-min cadence.~~
  **Superseded — see the caution in §1. Zero quota is not permission (the feed path
  is `Disallow`ed), and "impossible" was the wrong endpoint (`playlistItems.list` is
  1 unit of a separate 10,000/day pool). YouTube is OUT of Phase 0 regardless,
  because a channel does not vote.**
- GitHub **GraphQL batches ~100 repos into ~1 point** of 5,000/hr, and
  authenticated **304s cost nothing**. **Note from
  [#8](https://github.com/SaKaNa-Y/Zis/issues/8): releases return 403 entirely
  without auth, so the PAT is required, not an optimization.**
- Bluesky `public.api.bsky.app` needs **no auth at all** — verification below was
  done by direct unauthenticated fetch.

Verification date: **2026-08-15**. **YouTube section re-probed and overturned
2026-08-17 (#11); the cadence assumed throughout this document is also superseded —
polling is hourly, not 15-minute (#8).**

---

## 1. YouTube

> [!CAUTION]
> **This entire section is superseded. YouTube is OUT of Phase 0 — do not seed any
> of these channels.** Ruled by
> [#11](https://github.com/SaKaNa-Y/Zis/issues/11) on two independent grounds:
>
> 1. **`https://www.youtube.com/robots.txt` contains `Disallow: /feeds/videos.xml`**
>    under `User-agent: *`, served as `text/plain`, present on the apex too. It was
>    **absent in the 2020 and 2023 Wayback snapshots and present by 2025**. The
>    verification below fetched all 25 feeds and **never fetched `robots.txt`** — a
>    perfect fetch of a disallowed path. The method lesson is now a project rule:
>    **check `robots.txt` before liveness, never after**, because a liveness probe
>    cannot fail in a way that reveals a robots problem.
> 2. **A channel does not vote.** Strength is `COUNT(DISTINCT publisher_id)` with the
>    self-citation guard, so a Source earns its place by citing *other* Publishers.
>    The claim below that vendor channels are "the highest-value additions for
>    co-citation specifically" is **backwards**: a vendor's channel, blog and GitHub
>    release are **one Publisher wearing three hats**, so they add Sources without
>    adding reachable Strength. Measured on the one feed body obtained (OpenAI, 15
>    entries): every external URL in the descriptions is `openai.com` or
>    `chatgpt.com` — **zero third-party citations**, i.e. Strength-1 only, which is
>    [#16](https://github.com/SaKaNa-Y/Zis/issues/16)'s Bilibili arithmetic again.
>    Creator channels fail differently: a video is more often **cited than citing**,
>    and that citability is **already free** — the `watch?v=` URL arrives as a `Link`
>    from whoever cites it (777,377 `youtube.com` story URLs in HN's history, per
>    [#2](https://github.com/SaKaNa-Y/Zis/issues/2)) with no channel ingested.
>
> Two further findings, recorded so they are not re-derived:
>
> - **The Data API rescue is real and was refused anyway.** #2's "impossible at this
>   cadence" is an artifact of the wrong endpoint: `search.list` has its own 100/day
>   bucket, but **`playlistItems.list` costs 1 unit against a separate 10,000/day
>   pool** and uploads live in a derivable `UC…` → `UU…` playlist — 25 channels
>   hourly is **600 of 10,000**, and it is a sanctioned API host rather than a
>   disallowed path. Refused on ground 2, not on cost.
> - **The feed is unreliable from a datacenter IP regardless.** Re-probing all 25:
>   **24 returned 404 or 500**, inconsistently across runs (Matt Pocock 200 → 404,
>   OpenAI 200 → 500, Anthropic 404 → 200) while the channel IDs still re-resolve
>   correctly from their handles. Since
>   [#8](https://github.com/SaKaNa-Y/Zis/issues/8) put the pipeline in the GitHub
>   Actions runner, that is the egress Zis actually has.
>
> **What survives:** the `youtube.com` path-shape allowlist entry
> (`/watch → ['v']`, `/playlist → ['list']`) and the `youtu.be` alias rule, because
> YouTube URLs keep arriving as **outbound Citations from other Publishers**.
> Excluding a Source never excludes its URLs. The channel IDs below are also still
> correct, should a later Phase revisit this via the API.

Feed URL is always `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`.
Every row below was verified by fetching that URL and confirming a 200 with Atom
XML; the `latest video` column is the `<published>` of the first `<entry>`, which
is also the activity check.

**How the IDs were resolved** (worth recording — the @handle is not usable in the
feed URL): fetch `https://www.youtube.com/@<handle>` and extract
`"externalId":"UC…"` from the HTML. This is more reliable than the canonical
`<link>`, which on some channel pages still points at the handle URL. Handles
drift — three of the obvious guesses 404'd (`@ContinuousDelivery`,
`@LowLevelLearning`, `@benawad`) — so **store the channel_id, never the handle**.

| Name | channel_id | Latest video (UTC) | Verified? |
|---|---|---|---|
| Fireship | `UCsBjURrPoezykLs9EqgamOA` | 2026-08-14 | yes — 200, Atom |
| Theo — t3.gg | `UCbRP3c757lWg9M-U7TyEkXA` | 2026-08-14 | yes |
| ThePrimeagen | `UC8ENHE5xdFSwx71u3fDH5Xw` | 2026-08-06 | yes |
| Web Dev Simplified | `UCFbNIlppjAuEX4znoulh0Cw` | 2026-07-21 | yes |
| Traversy Media | `UC29ju8bIPH5as8OGnQzwJyA` | 2026-08-10 | yes |
| Modern Software Engineering (Dave Farley) | `UCCfqyGl3nq_V0bo64CjZh8g` | 2026-08-13 | yes |
| Jack Herrington | `UC6vRUjYqDuoUsYsku86Lrsw` | 2026-07-30 | yes |
| Matt Pocock | `UCswG6FSbgZjbWtdf_hMLaow` | 2026-08-12 | yes |
| Low Level | `UC6biysICWOJ-C3P4Tyeggzg` | 2026-08-14 | yes |
| Vercel | `UCLq8gNoee7oXM7MvTdjyQvA` | 2026-08-03 | yes |
| GitHub | `UC7c3Kb6jYCRj4JOHHZTxKsQ` | 2026-08-15 | yes |
| Kevin Powell | `UCJZv4d5rbIKd4QHMPkcABCw` | 2026-08-13 | yes |
| NeetCode | `UC_mYaQAE6-71rjSN6CeCA-g` | 2026-08-14 | yes |
| Hussein Nasser | `UC_ML5xP23TOWKUcc-oAE_Eg` | 2026-08-13 | yes |
| ByteByteGo | `UCZgt6AzoyjslHTC9dz0UoTw` | 2026-08-12 | yes |
| Thoughtworks | `UCQvdU25Eqk3YS9-QnILhKKQ` | 2026-08-13 | yes |
| AWS Developers | `UCT-nPlVzJI-ccQXlxjSvJmw` | 2026-08-14 | yes |

### Additional vendor / platform channels (all verified 200 + Atom)

These are the highest-value additions for **co-citation specifically**: a vendor
channel publishes on the same day as the vendor's blog post, the GitHub release,
and the Bluesky chatter, all pointing at one canonical announcement URL.

| Name | channel_id | Latest video (UTC) | Verified? |
|---|---|---|---|
| Cloudflare Developers | `UC3QIolTSR29ba4_u15vtEUQ` | 2026-08-14 | yes |
| Supabase | `UCNTVzV1InxHV-YR0fSajqPQ` | 2026-08-13 | yes |
| Anthropic | `UCrDwWp7EBBv4NwvScIpBDOA` | 2026-08-10 | yes |
| OpenAI | `UCXZCJLdBC09xxGZ6gcdrc6A` | 2026-08-14 | yes |
| Chrome for Developers | `UCnUYZLuoy1rq1aVMwx4aTzw` | 2026-08-14 | yes |
| Visual Studio Code | `UCs5Y5_7XK8HLDX0SLNwkd3w` | 2026-08-14 | yes |
| Rust Programming Language | `UCaYhcUwRBNscFNUKTjgPFiA` | 2026-08-06 | yes |
| Deno | `UCqC2G2M-rg4fzg1esKFLFIw` | 2026-03-23 | yes (feed OK, but **low cadence** — ~5 months since last upload; borderline) |

**Total verified YouTube channels: 25** (17 creator/practitioner + 8 vendor),
of which 24 have posted within the last ~6 weeks.

### Polling shape

At 25 channels × 4 polls/hr = 100 requests/hr, zero quota drawdown. Conditional
requests matter anyway: YouTube's feed endpoint returns `ETag` and
`Last-Modified`, so a 304 costs almost nothing in bandwidth. Keep the query
string byte-identical (`?channel_id=…` only — no extra params) per Ticket 01's
stable-query-shape rule.

**Alias semantics to enumerate before clustering** (per the map's warning): a
YouTube entry's canonical URL is `https://www.youtube.com/watch?v=<id>`, but the
feed also carries `yt:videoId`. Normalize to the `watch?v=` form and strip
`&t=`, `&list=`, `&pp=`. Short-form `youtu.be/<id>` links appearing in *other*
sources must resolve to the same key, or a video co-cited on Bluesky will fail to
cluster with its own YouTube entry.

### Named candidates that did not make the cut

| Name | channel_id | Why excluded |
|---|---|---|
| Coding Garden | `UCLNgu_OupwoeESgtab33CCw` | Feed 200s, but last upload **2025-12-04** — dormant ~8 months. Include only if long-tail dormancy is acceptable. |
| Josh tried coding | `UCvGwM5woTl13I-qThI4YMCg` | Feed 200s, last upload **2025-12-12** — dormant. |
| David Farley (`UCe-sur2H6sNi39IvqzyQsKw`) | — | A stale 2006-era personal channel, **not** the Continuous Delivery channel. The live one is Modern Software Engineering above. Listed here so nobody re-adds it. |
| Ben Awad | — | Could not resolve a live handle (`@benawad`, `@BenAwad97`, `@BenAwad` all 404). Effectively inactive; dropped. |

---

## 2. GitHub

### 2a. Release watchlist (75 repos)

All 75 slugs below were verified to resolve (HTTP 200 on `github.com/<slug>`,
following redirects, 2026-08-15). Per Ticket 01, a 100-repo GraphQL query with
`releases(first: 5)` costs **~1 point of 5,000/hr** — so this whole list is one
cheap call per poll, and there is no reason to trim it for cost.

**Three slugs have moved and the redirect must be recorded, not followed blindly** —
the REST/GraphQL API will answer under the new name and the release URLs use it:

| Old slug | Current slug |
|---|---|
| `facebook/react` | **`react/react`** |
| `facebook/react-native` | **`react/react-native`** |
| `containers/podman` | **`podman-container-tools/podman`** |

This is exactly the alias problem the map warns about: a Fireship video or a
Bluesky post will link `github.com/facebook/react/releases/tag/v…` for years
after the move. **URL canonicalization must resolve GitHub owner renames**, or
half the React clusters silently split in two.

#### Frameworks & UI

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `react/react` | The single most co-cited release in web dev | Irregular, low volume, very high impact |
| `vercel/next.js` | Settled stack for Zis itself; huge blast radius | Very high — canaries near-daily, minors monthly |
| `vuejs/core` | Second-largest frontend ecosystem | Monthly-ish |
| `sveltejs/kit` | Small but disproportionately discussed | Weekly-ish |
| `angular/angular` | Enterprise mass; predictable majors | Weekly patches, majors ~6mo |
| `solidjs/solid` | Signals discourse bellwether | Low |
| `withastro/astro` | Content-site default; drives "islands" discourse | High, weekly-ish |
| `nuxt/nuxt` | Vue meta-framework | Monthly |
| `remix-run/react-router` | Absorbed Remix; routing news lands here | Frequent |
| `TanStack/query` | Ubiquitous data layer | Frequent |
| `TanStack/router` | Rising type-safe routing | Frequent |
| `tailwindlabs/tailwindcss` | Styling default; v4 engine churn | Moderate |
| `shadcn-ui/ui` | Not versioned like a lib, but registry changes get cited | Continuous commits |
| `storybookjs/storybook` | Component-tooling news | Monthly |

#### Runtimes, compilers, build tooling

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `microsoft/TypeScript` | Every release is a discussed event | ~2mo minors + betas/RCs |
| `nodejs/node` | LTS lines, security releases | Very high |
| `denoland/deno` | Runtime-war coverage | Frequent |
| `oven-sh/bun` | Highest hype-per-release of the three | Very high |
| `vitejs/vite` | Build default | High |
| `rolldown/rolldown` | The Vite bundler migration story | High |
| `evanw/esbuild` | Still the baseline others benchmark against | Frequent |
| `swc-project/swc` | Rust-based JS toolchain | Frequent |
| `web-infra-dev/rspack` | Webpack-compatible Rust bundler | Frequent |
| `vitest-dev/vitest` | Test-runner default | High |
| `biomejs/biome` | Lint/format consolidation story | Moderate |
| `prettier/prettier` | Formatting news, occasional drama | Low |
| `eslint/eslint` | Flat-config migration is still live | Weekly |
| `pnpm/pnpm` | Package-manager competition | Frequent |

#### Data & storage

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `drizzle-team/drizzle-orm` | Settled stack for Zis | Very high, near-weekly |
| `prisma/prisma` | The comparison point for Drizzle news | Weekly |
| `supabase/supabase` | Ships constantly, and blogs about it | Very high |
| `pocketbase/pocketbase` | Indie-backend bellwether | Moderate |
| `postgres/postgres` | Mirror of the canonical repo; majors are big events | Quarterly minors, annual major |
| `redis/redis` | Licensing saga makes releases newsworthy | Moderate |
| `duckdb/duckdb` | Analytics darling, heavily discussed | Quarterly |
| `clickhouse/ClickHouse` | Monthly, always with a blog post | Monthly |
| `sqlite/sqlite` | Mirror; small but universally cited | Quarterly |

#### Languages

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `rust-lang/rust` | 6-week train, each release gets a blog post | Every 6 weeks |
| `golang/go` | 6-month majors, frequent security patches | Predictable |
| `python/cpython` | Annual majors + frequent patches; GIL/JIT news | High |
| `ziglang/zig` | Small but intensely covered | Irregular |
| `astral-sh/uv` | Fastest-moving story in Python tooling | Very high, multiple/week |
| `astral-sh/ruff` | Same org, same discourse | Very high |
| `pola-rs/polars` | Pandas-alternative coverage | High |
| `tokio-rs/tokio` | Rust async core | Moderate |

#### Infra, cloud, observability

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `kubernetes/kubernetes` | Quarterly majors are industry events | Quarterly + patches |
| `docker/compose` | Broad developer surface | Monthly |
| `podman-container-tools/podman` | The Docker alternative story | Monthly |
| `hashicorp/terraform` | Licensing/OpenTofu discourse | Frequent |
| `grafana/grafana` | Observability default | Monthly |
| `open-telemetry/opentelemetry-js` | OTel is out of scope for Zis but in scope for the *brief* | Frequent |
| `cloudflare/workerd` | Workers runtime; pairs with the CF blog | Very high |

#### AI / ML

This slice is where co-citation density is highest right now — an AI release
lands simultaneously on GitHub, HN, a Fireship video, and Bluesky.

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `ollama/ollama` | Local-model news hub | Very high |
| `ggml-org/llama.cpp` | Upstream of most local inference | Near-daily |
| `vllm-project/vllm` | Serving-side standard | High |
| `huggingface/transformers` | Model-support announcements | Very high |
| `pytorch/pytorch` | Majors are events | Quarterly |
| `langchain-ai/langchain` | Divisive but heavily cited | Very high |
| `openai/openai-node` | SDK bumps track API launches | High |
| `anthropics/anthropic-sdk-typescript` | Same, for Anthropic | High |
| `anthropics/claude-code` | Agent-tooling discourse | Very high |

#### Editors, desktop, mobile

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `microsoft/vscode` | Monthly release notes are a reliable co-citation anchor | Monthly |
| `neovim/neovim` | Small but loud community | Irregular |
| `zed-industries/zed` | Editor-competition story | Weekly |
| `helix-editor/helix` | Modal-editor alternative | Irregular |
| `ghostty-org/ghostty` | Terminal discourse | Moderate |
| `tauri-apps/tauri` | Electron-alternative story | Moderate |
| `electron/electron` | Chromium bumps | Frequent |
| `expo/expo` | RN developer surface | Very high (SDK majors quarterly) |
| `react/react-native` | Mobile releases | Quarterly |

#### Server-side frameworks

| owner/repo | Why watch | Release cadence |
|---|---|---|
| `laravel/laravel` | Large, well-covered ecosystem | Annual majors + weekly patches |
| `rails/rails` | DHH-adjacent news travels far | Frequent |
| `django/django` | Predictable, security-release heavy | 8-month majors |
| `spring-projects/spring-boot` | Enterprise Java surface | Monthly |
| `dotnet/runtime` | Annual majors, monthly patches | High |

**Noise warning.** Roughly a dozen of these (`next.js`, `bun`, `uv`, `ruff`,
`llama.cpp`, `transformers`, `expo`, `workerd`, `drizzle-orm`) ship multiple
releases a week, most of them patch-level. At 5–10 slots/day, **an unfiltered
release firehose would consume the entire brief.** The watchlist needs a
significance filter before it reaches clustering — suggested rule: admit a
release only if it is (a) a major or minor bump by semver, or (b) a patch that is
co-cited by at least one non-GitHub source. Rule (b) is the interesting one,
because it lets the co-citation spine decide, which is the architecture the map
already commits to.

### 2b. Approximating "trending"

There is no trending endpoint (Ticket 01 confirmed its absence across the REST
repos, search, and starring references). The search API is the sanctioned
substitute: **30 req/min authenticated**, 1,000 results max per search, 4,000-repo
match scope. That budget is enormous relative to a 15-minute cadence, so several
complementary queries per poll are affordable.

Verified live (unauthenticated, 2026-08-15):
`GET https://api.github.com/search/repositories?q=created:>2026-07-15+stars:>200&sort=stars&order=desc&per_page=5`
returned `total_count: 547` with well-formed items — so the query shape works.

Concrete queries, each targeting a different failure mode of the others:

| Intent | Query (`q=` value) | Notes |
|---|---|---|
| New-and-hot (the closest analogue to github.com/trending) | `created:>{today-30d} stars:>200` sorted `stars` desc | The workhorse. Tune the star floor seasonally; 200 gave ~550 matches over a 30-day window. |
| Breakout this week | `created:>{today-7d} stars:>100` sorted `stars` desc | Catches genuinely new projects before the 30-day window dilutes them. |
| Established repo surging | `stars:>5000 pushed:>{today-2d}` sorted `updated` desc | **Weak** — `sort=updated` is explicitly discouraged by Ticket 01's stable-query-shape rule because it destroys ETag stability. Prefer computing surge from stored `stargazers_count` deltas. |
| Language slices | append `language:rust`, `language:typescript`, `language:python`, `language:go` to the new-and-hot query | Prevents one language from monopolizing the list. Four extra calls/poll is nothing against 1,800/hr. |
| Topic slices | `topic:llm created:>{today-30d} stars:>100`, likewise `topic:ai-agents`, `topic:devtools`, `topic:database` | Topic curation is user-supplied, so quality varies, but the LLM slice is well-tagged. |

**The better trending signal is one Zis computes itself.** Ticket 01 flagged
that GitHub is narrowing stargazer-*listing* access (July 2026) while
`stargazers_count` on the repository object is unaffected. So per-star timestamps
may vanish, but the total will not — which means the durable approach is to store
`stargazers_count` per repo per poll and rank by **delta over a trailing window**,
computed locally. That sidesteps both the missing trending endpoint and the
narrowing stargazer API, and it directly feeds the map's open "cold start for
velocity scoring" question: the warm-up period is however long it takes to
accumulate a baseline of deltas.

Two cautions on search as a source:

- Search results are **relevance/star-ranked, not event-ranked** — the same repos
  will reappear poll after poll. Dedupe against a seen-set keyed on repo id, and
  emit only first-appearances, or trending becomes a daily reprint.
- The 4,000-repo scope cap means a broad query silently truncates. Narrow with
  `language:` / `topic:` rather than widening the date window.

### 2c. Orgs worth watching wholesale

Watching an org (rather than enumerating repos) is worth it where the org ships
across many repos and the interesting release could be in any of them. GraphQL
can list an org's repos and their latest releases in one query, so the cost
argument is the same as the watchlist.

| Org | Why wholesale | Caution |
|---|---|---|
| `vercel` | next.js, turborepo, ai, swr, satori — announcements cross repos | High volume; filter to repos above a star floor |
| `TanStack` | query/router/table/form/start all move together | Manageable size |
| `astral-sh` | uv, ruff, ty — one team, three fast-moving tools | Very high release rate |
| `cloudflare` | workerd, wrangler, workers-sdk, agents | Large org, many internal repos — needs a star floor |
| `denoland` | deno, std, fresh | Small |
| `anthropics` | SDKs, claude-code, MCP-adjacent repos | Small, high signal |
| `openai` | SDKs across languages track API launches | Mostly SDK bumps |
| `huggingface` | transformers, diffusers, accelerate, tokenizers | Very large — star floor essential |
| `rust-lang` | rust, cargo, rustup, crates.io | Moderate |
| `kubernetes` / `kubernetes-sigs` | Ecosystem-wide releases | Enormous; watchlist is better than wholesale |
| `microsoft` | Too big to watch wholesale — enumerate TypeScript/vscode/playwright instead | Do **not** watch wholesale |

Rule of thumb: watch an org wholesale only if it has fewer than ~30 public repos
above 1,000 stars. Above that, the enumerated watchlist is both cheaper to reason
about and less noisy.

---

## 3. Bluesky

Everything below was verified by **unauthenticated** fetch against
`public.api.bsky.app` on 2026-08-15, confirming Ticket 01's finding that the
AppView takes no auth at all.

### 3.0 The finding that reshapes this section

**`app.bsky.feed.searchPosts` returns HTTP 403 on the public AppView.**

Verified twice, with and without a descriptive User-Agent. The response is an
HTML WAF page, not an XRPC error envelope — so it is an edge block, not a lexicon
gap. By contrast `app.bsky.actor.searchActors`, `getProfile`, `getAuthorFeed`,
`getFeed`, and `getPostThread` all answer fine unauthenticated on the same host.

This matters because "search terms / hashtags that define the tech slice" was one
of the three things asked for, and **the obvious mechanism for it is not
available on the free, unauthenticated path.** Hashtag browsing in the Bluesky
app is itself implemented on `searchPosts`, so there is no separate tag endpoint
to fall back to.

Three ways out, in order of preference:

1. **Follow-graph + feed-generator polling instead of search.** `getAuthorFeed`
   over a curated account list and `getFeed` over curated feed generators both
   work unauthenticated, and both are listed below. This keeps the map's
   zero-auth posture intact.
2. **Authenticated `searchPosts` against `bsky.social`.** Requires
   `com.atproto.server.createSession` with an app password, session refresh, and
   a credential in the secret store — a real change to the map's Bluesky story,
   which currently assumes "no auth at all". Worth it only if follow-graph
   sampling proves too thin in prototype.
3. **Jetstream firehose with a keyword filter.** Ticket 01 already flagged
   AppView-vs-Jetstream as a prototype question; the searchPosts block makes
   Jetstream more attractive than it looked, but it is a persistent connection
   and cuts squarely against the map's all-polling / no-worker constraint.

Recommendation: build on (1), label the coverage as an assumption, and treat
(2)/(3) as the escalation path.

### 3.1 People — verified accounts

Verified with `app.bsky.actor.getProfile` (existence + DID + postsCount) and
`app.bsky.feed.getAuthorFeed` (recency). **"Own posts"** excludes reposts — a feed
item carrying a `reason` field is a repost, and its `post.author` is the
*reposted* account, not the account you asked for. Getting this wrong silently
attributes other people's posts to your source, which would corrupt the
distinct-source count that ranking depends on.

**Link %** is the share of the account's last ~50 own posts that carry an
external URL (a `app.bsky.richtext.facet#link` feature in `record.facets`, or an
`app.bsky.embed.external` embed). **This is the column that matters.** Zis
clusters on co-cited canonical URLs, so an account that posts no links
contributes nothing to the spine no matter how influential it is.

| Handle | DID | Who | Posts | Last own post | Link % | Verified? |
|---|---|---|---|---|---|---|
| `adactio.com` | `did:plc:r4p4qrbwfv7fbvpem5hjdmvl` | Jeremy Keith — web standards, links constantly | 1,398 | 2026-08-12 | **100%** | yes |
| `kentcdodds.com` | `did:plc:xzefkiajzjmmyp6zq6ftczg3` | Kent C. Dodds — testing, React, Epic Web | 1,335 | 2026-08-14 | **96%** | yes |
| `b0rk.jvns.ca` | `did:plc:nzrozayxq764zbgl4qtp5ald` | Julia Evans — systems, debugging, zines | 6,828 | 2026-08-06 | **81%** | yes |
| `simonwillison.net` | `did:plc:kft6lu4trxowqmter2b6vg6z` | Simon Willison — LLM tooling, Datasette; the single best AI-news relay on the network | 4,820 | 2026-08-15 | **75%** | yes |
| `glyph.im` | `did:plc:vaa5e4jzfpx6znz3jzxqixym` | Glyph (Twisted, Python) | 6,474 | 2026-08-15 | 71% | yes |
| `cassidoo.co` | `did:plc:bhdap3w2bseikypfnjmaskzf` | Cassidy Williams — newsletter, DX | 2,493 | 2026-08-11 | 65% | yes |
| `danluu.com` | `did:plc:2mrgzk6xlemfv6yugn644xxy` | Dan Luu — systems essays | 53 | 2026-08-10 | 62% | yes (low volume) |
| `hynek.me` | `did:plc:6k63663icgdybm5evgszxjn2` | Hynek Schlawack — Python packaging, attrs | 1,101 | 2026-08-14 | 44% | yes |
| `chriscoyier.net` | `did:plc:xhhcrzsilpamjmz4dvrpt7df` | Chris Coyier — CSS-Tricks, CodePen | 1,029 | 2026-08-12 | 42% | yes |
| `emollick.bsky.social` | `did:plc:flxq4uyjfotciovpw3x3fxnu` | Ethan Mollick — AI adoption research | 2,961 | 2026-08-13 | 37% | yes |
| `una.im` | `did:plc:kesmfbtx2loscqj7ktw5shtt` | Una Kravets — Chrome CSS/DevRel | 764 | 2026-08-13 | 33% | yes |
| `crawshaw.io` | `did:plc:sbgmax2bfm5dlje36qwvzuuq` | David Crawshaw — Tailscale, Go, sqlite | 615 | 2026-08-02 | 32% | yes |
| `wesbos.com` | `did:plc:etdjdgnly5tz5l5xdd4jq76d` | Wes Bos — Syntax.fm | 1,389 | 2026-08-07 | 31% | yes |
| `rachelandrew.co.uk` | `did:plc:xi53lkcvx4b3bl5tgsb7tnqe` | Rachel Andrew — CSS WG, Chrome docs | 1,108 | 2026-08-13 | 29% | yes |
| `bradfitz.com` | `did:plc:7r2fy3b4u7mmnhgbdxnflovv` | Brad Fitzpatrick — Go, Tailscale, memcached | 971 | 2026-08-13 | 28% | yes |
| `mattpocock.com` | `did:plc:oeio7zuhrsvmlyhia7e44nk6` | Matt Pocock — TypeScript | 611 | 2025-05-27 | 23% | yes — **dormant ~15 months** |
| `antirez.bsky.social` | `did:plc:ipt7y6qaf6fn7oeeduboqe44` | Salvatore Sanfilippo — Redis author | 1,314 | 2026-08-14 | 22% | yes |
| `kelseyhightower.com` | `did:plc:7i3fhorekojhdjhkbln7q7gq` | Kelsey Hightower — k8s/cloud, 104k followers | 2,076 | 2026-08-07 | 14% | yes |
| `danabra.mov` | `did:plc:fpruhuo22xkm5o7ttr2ktxdo` | Dan Abramov — React; very active but rarely links out | 15,625 | 2026-08-14 | 11% | yes |
| `sophiebits.com` | `did:plc:lq6wgt3qcyog37cw65o5c277` | Sophie Alpert — ex-React core | 497 | 2026-07-02 | 11% | yes |
| `pfrazee.com` | `did:plc:ragtjsm2j2vknwkz3zp4oxrd` | Paul Frazee — Bluesky/ATProto engineer | 38,605 | 2026-08-13 | 7% | yes — AT Proto news, low link rate |
| `t3.gg` | `did:plc:cy4af3hlkdaht7wltvdmc35k` | Theo | 311 | 2026-03-30 | 34% | yes — **dormant ~4 months**; he is a YouTube-first source |

**Verified to exist but NOT recommended:**

| Handle | DID | Why not |
|---|---|---|
| `karpathy.bsky.social` | `did:plc:j7gi6r4kh6uof7rfrqpm3fej` | 34k followers but **last own post 2023-05-27** — a parked account. Classic trap: high follower count, zero output. |
| `mitchellh.com` | `did:plc:onu3oqfahfubgbetlr4giknc` | `postsCount: 0`. Parked. |
| `shadcn.com` | `did:plc:arv2tmqf7pe2hcakoedcf6bk` | 15 posts, none in the recent feed. Parked. |
| `swyx.io` | `did:plc:xxuso5disl5vq5xfzlr7mf52` | Last own post 2025-10-13; feed is ~90% reposts. |
| `steipete.me` | `did:plc:nzev4hjdwuttjqdvdclp4pom` | Last own post 2026-02-18; mostly reposts. |
| `theprimeagen.bsky.social` | `did:plc:yipcsadljwxcfaji37cqo4gm` | 5 posts total. Parked. |
| `copyconstruct.bsky.social` | `did:plc:hsjjtajmocsjeawffdc6xp4i` | 2 posts. Parked. |
| `gvwilson.bsky.social`, `mcc.bsky.social`, `russcox.bsky.social` | (resolve, but `postsCount: 0`) | Parked. |
| `bsky.app`, `jay.bsky.team` | official/exec accounts | Platform news, not tech news. Include only if AT Proto itself is in the interest profile. |

**Handles checked that do not resolve at all** (recorded so nobody re-tries them):
`dan.abramov.io`, `rauchg.com`, `leerob.io`, `addyosmani.com`, `jaffathecake.bsky.social`,
`jvns.ca`, `patio11.bsky.social`, `why.bsky.team`, `sdras.bsky.social`,
`sarahdrasnerdesign.bsky.social`, `jensimmons.com`, `argyleink.bsky.social`,
`zeldman.com`, `tjdevries.dev`, `acdlite.bsky.social`, `rickhanlonii.me`,
`housecor.bsky.social`, `ethanmollick.bsky.social`, `brendangregg.bsky.social`,
`mipsytipsy.bsky.social`, `openai.com`, `cloudflare.com`, `huggingface.co`,
`rubyonrails.org`, `ghostty.org`.

The miss rate here is the real story: **roughly 40% of "obviously should be on
Bluesky" dev-celebrity handles either don't exist or are parked.** Any Bluesky
source list must be re-verified periodically, not assembled once.

### 3.2 Org / project accounts — verified

These are the co-citation workhorses: they post the release announcement URL, the
same URL the GitHub release and the vendor YouTube video point at.

| Handle | DID | Who | Posts | Last own post |
|---|---|---|---|---|
| `github.com` | `did:plc:sydgpvanh46u766n536r33oa` | GitHub (72k followers) | 487 | 2026-08-13 |
| `zed.dev` | `did:plc:h4nlizncnhhcq7mwpz3uuvzk` | Zed editor | 1,102 | 2026-08-14 |
| `vercel.com` | `did:plc:m2jwplpernhxkzbo4ev5ljwj` | Vercel | 183 | 2026-08-12 |
| `nextjs.org` | `did:plc:np63qsk4tlzguykanskcipxi` | Next.js | 102 | 2026-08-07 |
| `astro.build` | `did:plc:6kf6jxl44h34mprhykvqljcx` | Astro | 330 | 2026-08-14 |
| `sveltesociety.dev` | `did:plc:7zxwd3u7qsknnraxnlb3dhjm` | Svelte Society | 280 | 2026-08-14 |
| `deno.land` | `did:plc:dijfw5anky2izdhc2y6hi73g` | Deno | 408 | 2026-08-06 |
| `nodejs.org` | `did:plc:abbt45q3u3bttqfs7nepehhu` | Node.js | 89 | 2026-08-07 |
| `typescriptlang.org` | `did:plc:svcebrizuuy6vy6tsqmc3icz` | TypeScript | 65 | 2026-07-28 |
| `python.org` | `did:plc:sfrl4dmvaxeq4lqgaucotygo` | Python Software Foundation | 372 | 2026-08-13 |
| `golang.org` | `did:plc:wjk44wlnvy2rz2qq47ctzdkv` | Go | 63 | 2026-08-13 |
| `rust-lang.org` | `did:plc:wicua5idywllkobpfm64byvm` | Rust | 34 | 2026-07-16 |
| `prisma.io` | `did:plc:m6mbn4cko4m6vyynh7q675df` | Prisma | 924 | 2026-08-12 |
| `biomejs.dev` | `did:plc:6ghuqrvcbgc7nm6nvzaedhin` | Biome | 107 | 2026-08-11 |
| `vitest.dev` | `did:plc:uumv6zar7qzfib5gzenz7ncm` | Vitest | 74 | 2026-07-21 (mostly reposts) |
| `laravel.com` | `did:plc:t7557igkeyl2jzzdqxtwvyeb` | Laravel | 85 | 2026-06-03 |
| `anthropic.com` | `did:plc:7xblllgnpqtiotu62pic747n` | Anthropic — **`postsCount: 0`**, 16k followers | 0 | never |
| `tailwindcss.com` | `did:plc:3vxokmxb4ryr6iekmrm5kjof` | Tailwind — **`postsCount: 0`** | 0 | never |
| `supabase.com` | `did:plc:rb4pubqfeokufmgkpjo2vbll` | Supabase | 59 | 2026-04-08 (stale) |
| `bun.sh` | `did:plc:76vf7xzncfaxw3m6qemqpmj4` | Bun | 52 | 2025-08-29 (stale) |

**Resolve DIDs once and store them, not the handles.** A handle is a DNS/`.bsky.social`
alias that the account owner can change at any time; the DID is permanent. If Zis
keys sources on handles, a rename silently turns a live source into a 404 —
and worse, a *third party* can later claim the abandoned handle.

### 3.3 Feed generators (curated feeds)

Discovered via `app.bsky.unspecced.getPopularFeedGenerators?query=…` and each read
back with `app.bsky.feed.getFeed?feed=<url-encoded AT-URI>` — both unauthenticated.
`getFeed` is the important one: it means a curated feed is pollable exactly like
an RSS feed, with no auth and no follow graph.

| Feed | AT-URI | Likes | getFeed unauth? | Newest item at check |
|---|---|---|---|---|
| Tech news | `at://did:plc:ke6e3skfhjdsnky5d3ojauh3/app.bsky.feed.generator/news-tech` | 298 | **yes** | 2026-08-15 09:03 |
| Programming Posts | `at://did:plc:lyrmsmhhg7vzz4ghj44y5xzq/app.bsky.feed.generator/580f28edc909` | 43 | **yes** | 2026-08-15 09:01 |
| Flipboard Tech | `at://did:plc:cndfx4udwgvpjaakvxvh7wm5/app.bsky.feed.generator/flipboard-tech` | 718 | **yes** | 2026-08-15 08:51 |
| Best Tech News Feed | `at://did:plc:cng2pnuzkxb4nb5xmq72tojr/app.bsky.feed.generator/aaacuoiurwqxk` | 205 | **yes** | 2026-08-15 04:41 |
| Dev Trending | `at://did:plc:fxipo3ogt5nrxjddervd4hxa/app.bsky.feed.generator/dev-trending` | 61 | **yes** (only 5 items) | 2026-08-15 02:04 |
| Python Programming | `at://did:plc:te235k5t6h4hp3awy5tuajxx/app.bsky.feed.generator/aaajf4zkrdcte` | 735 | not tested | — |
| Functional Programming | `at://did:plc:vf2ynpa7abn2y4uifm3s6crm/app.bsky.feed.generator/aaahwf75cpyqk` | 25 | not tested | — |
| Graphics Programming | `at://did:plc:zpokoju3rsgadlzwlzsudw4e/app.bsky.feed.generator/gprogramming` | 94 | not tested | — |
| Critical AI & Tech | `at://did:plc:rwvx7nvhwavvyi75m43lup6z/app.bsky.feed.generator/criticalai` | 207 | not tested | — |
| No-Hype Tech Journalism | `at://did:plc:rwvx7nvhwavvyi75m43lup6z/app.bsky.feed.generator/nohype` | 76 | not tested | — |
| Tech Bluesky | `at://did:plc:gzymh5fce2h7hvjm7vsqh2l4/app.bsky.feed.generator/tech-bluesky` | 43 | **NO — 404 `XRPCNotSupported`** | — |

Caveats that need to reach the ingestion spec:

- **Feed generators are third-party services that can vanish.** "Tech Bluesky"
  is listed as popular yet its backing generator returns
  `XRPCNotSupported: Upstream server responded with a 404`. A feed appearing in
  the discovery list is not evidence it still serves. Every feed needs a
  liveness check and a graceful-disable path, and a dead feed must not silently
  drop the source count that ranking depends on.
- **The tech feeds skew journalism, not engineering.** "Tech news", "Flipboard
  Tech", and "Best Tech News Feed" carry consumer/industry coverage (the
  Techmeme slice), while the engineering slice lives in the follow graph. Both
  are useful, but only the second overlaps the GitHub watchlist.
- **`likeCount` is a popularity proxy, not a quality one**, and the discovery
  endpoint is `app.bsky.unspecced.*` — an explicitly unstable namespace. Fine for
  a one-time curation pass, unwise as a runtime dependency.

### 3.4 Search terms / hashtags

With `searchPosts` 403'd, these cannot be polled unauthenticated. Recording them
anyway, because they are what a prototype would test under option (2) or (3)
above, and because they double as **post-hoc filters** over the follow-graph and
feed-generator streams — which is a genuinely useful use for them today.

Hashtags actually in use in the tech slice: `#webdev`, `#javascript`,
`#typescript`, `#css`, `#html`, `#react`, `#vuejs`, `#svelte`, `#rustlang`,
`#golang`, `#python`, `#devops`, `#kubernetes`, `#opensource`, `#programming`,
`#compsci`, `#llm`, `#ai`, `#security`, `#infosec`, `#a11y`, `#accessibility`.

Two cautions. **`#ai` is unusable as a tech signal** — the discovery pass above
shows the AI tag space on Bluesky is dominated by AI *art* feeds
(`AI Art`, `AIイラスト`, `AI Images`, `Drawings - No Ai`), so a term filter on `ai`
imports a large volume of art-community and anti-AI-art discourse. Prefer `#llm`
plus model/vendor names. And **hashtag adoption on Bluesky is weak** relative to
the old Twitter norm; most dev posts carry no tag at all, so tag-based retrieval
under-collects badly. The follow graph is the stronger instrument here.

Better than terms: **domain filtering.** Since every post's outbound links are
available in `record.facets`, the cheapest high-precision tech filter is "post
links to a host on our allowlist" — `github.com`, `arxiv.org`,
`developer.mozilla.org`, `news.ycombinator.com`, vendor blogs. That filter runs
locally over whatever stream is available, needs no search endpoint, and produces
exactly the canonical URLs the clustering spine wants.

### 3.5 Alias / reshare semantics to enumerate

Per the map's instruction to enumerate these per adapter *before* writing
clustering code, what was observed:

- **Reposts.** A `getAuthorFeed` item with a `reason` field
  (`app.bsky.feed.defs#reasonRepost`) is a repost; `post.author` is the original
  author. A repost must **not** count as a second distinct source citing a URL —
  otherwise one popular post manufactures a cluster, which is precisely the
  failure the map rules out.
- **Quote posts.** `embed` of type `app.bsky.embed.record` (or
  `recordWithMedia`) wraps another post. The quoted post's links are the quoter's
  citation only if the quoter didn't add their own. Decide deliberately.
- **Two link locations.** URLs live in `record.facets[].features[]` of type
  `app.bsky.richtext.facet#link` **and** in `embed.external.uri` (the link card).
  They frequently disagree — the facet carries what was typed, the card carries
  what the resolver landed on. Extract both, canonicalize, dedupe.
- **`postsCount` includes replies and reposts**, so it is a poor activity metric
  on its own. Actual recency requires a `getAuthorFeed` call, which is why every
  row above has both columns.
- **Handle vs DID.** As above — key on DID.

### 3.6 Polling budget

Ticket 01's finding stands: **no numeric AppView limit is published**, so any
figure here is an assumption and must be labelled one. Shape of the load:

- ~22 people + ~18 org accounts = 40 `getAuthorFeed` calls per poll
- ~10 feed generators = 10 `getFeed` calls per poll
- ≈ 50 requests per poll → **200 requests/hour**, serial

That is almost certainly well inside "generous rate-limits", but it is an
assumption, not a budget. Read `ratelimit-*` response headers on every call, log
them, and back off on 429 — the same discipline Ticket 01 prescribes.

---

## 4. Expected co-citation across platforms

This is the point of the whole document: sources were picked for **overlap**, not
coverage. Below are the concrete patterns where one canonical URL should be
independently cited by several sources on the same day. The RSS side is another
agent's document, but the joins are named here because the joins are the product.

**Pattern A — framework release.** React or Next.js ships. Same day:
`react/react` GitHub release (canonical: the release tag URL) → the project's own
blog post (canonical: `react.dev/blog/…`, arriving via RSS) → `nextjs.org` /
`vercel.com` Bluesky post linking that blog URL → a Fireship or Theo video →
several of the 22 Bluesky people linking the same blog URL → an HN submission of
it. **Five to seven distinct sources on one canonical URL.** Note the release-tag
URL and the blog URL are *different* URLs for one event — the alias table has to
join them, or this splits into two thin clusters instead of one strong one.

**Pattern B — TypeScript / language release.** `microsoft/TypeScript` GitHub
release → devblogs post (RSS) → `typescriptlang.org` Bluesky → Matt Pocock (if he
returns to Bluesky; on YouTube regardless) → HN. Same alias problem: GitHub
release tag vs. the devblogs announcement URL.

**Pattern C — AI model / tool launch.** The densest overlap of all.
`anthropics/*` or `openai/*` SDK release → vendor blog (RSS) → Anthropic/OpenAI
YouTube video → `simonwillison.net` on Bluesky at 75% link rate, usually within
hours → `emollick.bsky.social` → Fireship within a day or two → HN front page.
Simon Willison is doing something close to the co-citation job manually, which
makes him the highest-value single Bluesky account in this list and also a useful
**evaluation oracle**: if Zis's brief and his link stream diverge sharply on a
given day, one of them is wrong, and that is a cheap test to run.

**Pattern D — infra / database release.** `duckdb/duckdb` or `clickhouse/ClickHouse`
GitHub release → project blog (RSS) → ByteByteGo or Hussein Nasser video within
the week → HN. **Weaker and slower** — the video lags by days, so temporal decay
(which the map already adds to the cascade) will often have closed the cluster
before the video arrives. Expect these to surface as GitHub+RSS+HN two-or-three
source clusters, not five.

**Pattern E — GitHub trending breakout.** A repo spikes. The search-API trending
proxy catches it → Bluesky people link the repo URL → HN submits it → Fireship
covers it within a week. Here the canonical URL is the **repo root**, and the map
explicitly names "GitHub release vs repo root" as an alias case to settle. Note
these two patterns want *opposite* resolutions: in Pattern A the release tag
should fold into the announcement, in Pattern E the repo root is the canonical
thing. One rule will not serve both — the discriminator is whether a release
exists for the event at all.

**Where overlap will be thin, and that's fine:** Kevin Powell (CSS), NeetCode
(interview prep), Thoughtworks, and the dormant channels will rarely co-cite
anything. They are breadth, not spine. Under the map's
distinct-sources-not-mentions rule they cost nothing when they don't overlap.

**The failure mode to watch.** Vendor accounts across YouTube, GitHub, and
Bluesky are *the same organization*. Vercel's GitHub release, Vercel's YouTube
video, and `vercel.com`'s Bluesky post are one source wearing three hats, and
counting them as three distinct sources lets any vendor manufacture a cluster
about itself — the exact "one loud account" failure the map's ranking rule
exists to prevent. **Distinct-source counting needs an owning-entity dimension,
not just a source-row dimension**: N platform accounts belonging to one entity
should contribute at most one to the distinct-source count. Independent voices
(Fireship, Simon Willison, HN) are what should make a cluster, and the vendor
posts are provenance, not votes. This is a clustering-spec decision (Ticket 05),
surfaced here because this document is what creates the problem.
