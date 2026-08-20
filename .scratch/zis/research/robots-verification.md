# Zis — robots.txt verification of the whole candidate source corpus

Resolves [Robots-verify the whole candidate source corpus](https://github.com/SaKaNa-Y/Zis/issues/29).
Probed **2026-08-20**. Method: for every distinct host, `robots.txt` was fetched
**first**; only then was the specific candidate path evaluated against the
`User-agent: *` group. **No feed or page body was fetched** — liveness is #11's
column and re-probing it is exactly the check that cannot reveal a robots problem.

- UA: `ZisBot/0.1 (+https://github.com/SaKaNa-Y/Zis)`. No group in any file
  matched this UA, so `User-agent: *` governs everywhere.
- Corpus: **118 distinct hosts** across the ~110 feeds in
  `candidate-sources-rss.md`, the 42 RSS + 10 Bluesky + HN + GitHub-releases
  Sources in `PROTOTYPE-clustering/sources.mjs` (a strict subset of the doc —
  every prototype feed URL is also in the doc), the two Postgres additions, the
  four platform hosts, and the **newsletter issue-page paths**, which are a
  separate robots surface from the feeds that list them.
- **44 additional apex hosts** were fetched where they differ from the
  subdomain, per the YouTube trap. **162 robots.txt fetches total.**
- Fail-open guards applied: `text/plain` required; HTTP 200 treated as
  necessary-not-sufficient; 404 recorded as its own verdict, not folded into
  "pass".

**Verdict counts:** ALLOWED 94 · 404-ALLOWED 19 · **DISALLOWED 3** · AMBIGUOUS 2.

---

## The casualty list

### 1. The Register — `www.theregister.com/headlines.atom` **DISALLOWED**

```
User-agent: *
Allow: /ads.txt
Allow: /app-ads.txt
Disallow: /
```

The apex `theregister.com` carries the identical rule, so this is not a
subdomain-only trap. The live file is stamped `# Last updated: 18 June 2026` and
opens with `# POLICY: Default-deny. Any crawler not explicitly allowed below is
BLOCKED.`

**This is in the prototype's 42** — `theregister` contributed **40 citations** of
6,468 in the #6 run. It votes in none of the 10 named clusters and in none of the
top signals by strength, so the measured yield loses 40 citations and no Signal.

Two things #11 must decide rather than infer:

- The file **explicitly allows `Claude-User`, `Claude-SearchBot` and
  `claude-code`** while blocking `ClaudeBot`. Zis's crawler is none of those.
  Sending one of those UAs to get past the default-deny would be UA spoofing, not
  permission — and the map's polite-fetching rule is a rule about the crawler Zis
  actually is.
- There is a stated licensing path (`situationpublishing.com/ai-licensing/`).
  That is a commercial decision, not a robots finding.

**Recently added — and this is the one that matters most.** Absent from the
2020, 2023, **and 2025-12** snapshots (all three carry only `Crawl-delay: 5` +
`Disallow: */trackback/`); the blanket block is present by 2026-06. So it
appeared **inside the last eight months**, well after #2's source survey.

### 2. Changelog — `changelog.com/feed` and `changelog.com/news/feed` **DISALLOWED**

```
user-agent: *
disallow: /
```

That is the entire file — 26 bytes. Both candidate feeds die on it. Not in the
prototype's 42, so #6's measured yield is untouched.

**Recently added.** 2020, 2023, 2025-06 and 2025-09 snapshots all carry a normal
five-line file (`/ad/impress`, `/auth/github`, …); the blanket `disallow: /` is
present by **2025-11-04**.

### 3. Lobsters — `lobste.rs/rss` **DISALLOWED** (confirms the existing exclusion)

```
User-agent: *
Crawl-delay: 1
Disallow: /
```

Already excluded on policy via [Verify source API limits against official docs](https://github.com/SaKaNa-Y/Zis/issues/2);
this is the primary-source confirmation, plus
`Content-Signal: ai-input=no, ai-train=no, search=yes`. The file names a
whitelist of search engines above the `*` group and carries a comment inviting a
PR to be added to it — so the block is deliberate and per-crawler, not an
accident. **Recently added**: absent 2023-10 and 2024-01, present by 2024-06.

---

## Cannot be cleared: 2 AMBIGUOUS — needs a human read

Both are **press feeds in the prototype's 42**, and in both cases the *robots
surface itself* is behind a bot defence, so no verdict is available at any status
code.

### InfoQ — `feed.infoq.com/`

`feed.infoq.com/robots.txt` → **406** `application/json` (Spring
`"Could not find acceptable representation"`). The apex and `www.infoq.com`
→ **405** with `text/html` and an **AWS WAF `Human Verification` interstitial**
carrying `awsWafCookieDomainList` / `gokuProps`. This is guard #1 and guard #2
arriving together on the robots file itself: a status-trusting parser sees no
`Disallow` and concludes "allowed". **It is not allowed — it is unknown.**
InfoQ contributed 15 citations in #6.

### Ars Technica — `feeds.arstechnica.com/arstechnica/index`

`feeds.arstechnica.com/robots.txt` → **404**, but with `text/html` and a
518 KB "Page not found | Ars Technica" page — a soft-404, so guard #4's
"404 means allowed" does not cleanly apply. The apex `arstechnica.com/robots.txt`
→ **HTTP 202, `Content-Length: 0`, `x-amzn-waf-action: challenge`**, identically
with a browser UA. A 202 with an empty body parses as an empty ruleset, i.e. as
"allowed" — a fourth distinct fail-open shape, and one no guard on the list
currently catches. Ars contributed **47 citations** in #6, the largest of the
three press publishers.

**Recommended guard to add:** treat any `robots.txt` response that is not a
`text/plain` 200 or a hard 404 as **AMBIGUOUS → fail closed**, and specifically
reject 2xx-other-than-200 and zero-length 2xx.

---

## Content-Signal register

`Content-Signal` is a separate permission axis from `Disallow`, and only
`ai-input=no` bites Zis — it does not train models. Recorded here so the
distinction is not collapsed later.

**`ai-input=no` — robots-ALLOWED but signal-restricted (3 hosts):**

| host | signal | in prototype's 42? |
|---|---|---|
| `lobste.rs` | `ai-input=no, ai-train=no, search=yes` | no — already DISALLOWED anyway |
| `kentcdodds.com` | `ai-train=no, search=yes, ai-input=no` | **yes** (as `bluesky-author`; 109 citations) |
| `xeiaso.net` | `ai-train=no, search=yes, ai-input=no` | no (doc-only candidate) |

`kentcdodds.com` is the live one: the prototype polls Kent via Bluesky, not RSS,
so the feed itself is not the issue — but `candidate-sources-rss.md` lists
`kentcdodds.com/blog/rss.xml`, and **article-body fetches from that host** are
covered by the signal either way. That is #11's call, not this ticket's.

**`ai-train=no` only — does not restrict Zis:** `blog.val.town`, `val.town`,
`www.phoronix.com` / `phoronix.com`, `vercel.com`. Several add `use=reference`.

**`ai-train=yes, search=yes, ai-input=yes` — explicitly permissive:**
`blog.cloudflare.com`, `cloudflare.com`, `neon.com`, `nextjs.org`, `nuxt.com`,
`planetscale.com`, `pytorch.org`, `render.com`, `sentry.io`, `supabase.com`,
`vuejs.org`.

---

## Additions to the map's excluded-on-policy register

The register currently holds Lobsters, Bilibili, and YouTube channel RSS. Add:

- **The Register** (`www.theregister.com/headlines.atom`) — `Disallow: /` under
  `User-agent: *`, verified against primary `robots.txt` served `text/plain`, on
  both the subdomain and the apex. Blanket block added between 2025-12 and 2026-06.
- **Changelog** (`changelog.com/feed`, `changelog.com/news/feed`) — `disallow: /`
  under `user-agent: *`, verified against primary `robots.txt` served
  `text/plain`. Added between 2025-09 and 2025-11.
- **Lobsters** — now verified against primary `robots.txt` rather than assumed;
  also `Content-Signal: ai-input=no`.

**Not** added, because they are unresolved rather than excluded: **InfoQ** and
**Ars Technica**. They belong in a *pending* state, and under a fail-closed
default that means unusable until a human clears them.

---

## Effect on #6's measured yield, and therefore on #11's supply figures

| publisher | verdict | citations in #6 | in a named cluster? | in top signals? |
|---|---|---|---|---|
| The Register | **DISALLOWED** | 40 | no | no |
| Ars Technica | **AMBIGUOUS** | 47 | no | no |
| InfoQ | **AMBIGUOUS** | 15 | no | no |
| Changelog | **DISALLOWED** | n/a — not in the 42 | — | — |
| Lobsters | **DISALLOWED** | n/a — not in the 42 | — | — |

**102 of 6,468 citations (1.6%)** sit behind a host that is now blocked or
unresolved. **Zero named clusters and zero top-strength Signals lose a voter** —
the whole press tier votes at the tail. The supply figures #11 is curating
against move by ~1.6% of citations, but by **three of the six press
publishers**, which matters more for genre coverage than for volume: the press
tier drops from six to three (`lwn`, `404media`, `thenewstack`).

---

## Two more findings worth carrying, both order-of-operations

### A fail-*closed* trap, in the opposite direction from every guard so far

`hacker-news.firebaseio.com/robots.txt`:

```
User-agent: *
Allow: /*.json$
Allow: /*.json?*$
Disallow: /
```

The candidate path `/v0/topstories.json` is **ALLOWED** — but only by a parser
that implements `*` wildcards, `$` anchoring, and longest-match-wins with
Allow-beats-Disallow on ties. A naive line-prefix matcher sees `Disallow: /`,
concludes "blocked", and **silently kills the single highest-yield source in the
corpus** (`hn` = 438 citations, and the origin of three of the top four
Signals). Both directions of the parser have to be right, not just the fail-open
one.

### `api.github.com` returns 403 unauthenticated, 404 authenticated

`api.github.com/robots.txt` → **403** `{"message":"API rate limit exceeded"}`
from a datacenter IP unauthenticated, and **404 JSON** with a token. So the
honest verdict is **404-ALLOWED**, but only reachable *with* the credential — the
unauthenticated read is a rate-limit artifact that a robots checker would
otherwise have to treat as AMBIGUOUS. The GraphQL and releases endpoints are
cleared on that basis; `github.com` itself (the HTML host, for article fetches)
serves a real `text/plain` file that allows the paths in question.

---

## Environment notes (so a re-run is not misread)

- `hnrss.org` failed the first fetch with a schannel TLS handshake error and
  returned a clean `text/plain` `Disallow:` (allow-all) on retry. **A transport
  error is not a verdict** — retry before recording.
- Three *apex-only* hosts never resolved and are recorded as unfetchable:
  `firebaseio.com` and `statuscode.com` (TLS handshake), `pocoo.org`
  (`SEC_E_CERT_EXPIRED`). None is a host Zis fetches — they were probed only as
  apex comparisons for `hacker-news.firebaseio.com`, `react.statuscode.com` and
  `lucumr.pocoo.org`, all three of which resolved on their own.
- `fasterthanli.me/robots.txt` is a **200 `text/plain` of zero bytes** — an empty
  ruleset, correctly ALLOWED, but a shape worth a test.
- Crawl-delays found: `news.ycombinator.com` 30, `devblogs.microsoft.com` 10,
  `hacks.mozilla.org` 10, `lwn.net` 10, `stripe.com` 2, `css-tricks.com` 1,
  `lobste.rs` 1.
- 13 `www.` variants were spot-checked against their bare-apex counterparts
  (`simonwillison.net`, `tldr.tech`, `pycoders.com`, `changelog.com`, `lobste.rs`,
  `techcrunch.com`, `thenewstack.io`, `lwn.net`, `openai.com`, `github.blog`,
  `deno.com`, `svelte.dev`): all identical bodies.
  `www.this-week-in-rust.org` does not resolve.

## How often this needs re-running

**Every one of the three casualties was added recently**, and the two new ones
are the sharpest evidence yet: Changelog flipped between **2025-09 and 2025-11**,
The Register between **2025-12 and 2026-06**. Neither host is one anyone would
have flagged as a risk. Combined with YouTube's rule appearing between 2023 and
2025, that is **four blanket blocks appearing on ordinary tech hosts inside three
years, two of them inside the last nine months.**

A `robots.txt` verdict is therefore **perishable state, not a one-time
qualification**. Re-check on a cadence — monthly is defensible given this rate —
and cache the verdict with a TTL that expires rather than a boolean that
persists. This is what the map already means by `robots_cache` being separate and
failing closed.

---

## Full table — one row per host

`verdict` is for the specific candidate path(s) on that host under
`User-agent: *`, not for the host in general. `apex check` records the separate
apex fetch where the apex differs from the fetched host.

</content>
</invoke>
| host | `robots.txt` status | content-type | verdict | disallowed path? | Content-Signal / Crawl-delay | apex check |
|---|---|---|---|---|---|---|
| `changelog.com` | 200 | `text/plain; charset=utf-8` | **DISALLOWED** | `/feed` <- `Disallow: /`; `/news/feed` <- `Disallow: /` | - | n/a |
| `lobste.rs` | 200 | `text/plain; charset=utf-8` | **DISALLOWED** | `/rss` <- `Disallow: /` | CS `ai-input=no, ai-train=no, search=yes`, Crawl-delay 1 | n/a |
| `www.theregister.com` | 200 | `text/plain;charset=UTF-8` | **DISALLOWED** | `/headlines.atom` <- `Disallow: /` | - | `theregister.com` **DISALLOWS** |
| `api.github.com` | 403 unauth / **404 authenticated** | `application/json; charset=utf-8` | **404-ALLOWED** | no | - | `github.com` allows |
| `feed.infoq.com` | 406 | `application/json;charset=UTF-8` | **AMBIGUOUS** | no | - | `infoq.com` 405 `text/html; charset=UTF-8` |
| `bair.berkeley.edu` | 404 | `text/html; charset=iso-8859-1` | **404-ALLOWED** | no | - | `berkeley.edu` allows |
| `blog.jim-nielsen.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `jim-nielsen.com` 404 `text/html; charset=utf-8` |
| `blog.python.org` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `python.org` allows |
| `blog.vuejs.org` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `vuejs.org` allows |
| `css-weekly.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `feeds.arstechnica.com` | 404 (soft-404 HTML, 518 KB) | `text/html` | **AMBIGUOUS** | no | - | `arstechnica.com` **202 + `x-amzn-waf-action: challenge`, 0 bytes - unverifiable** |
| `fly.io` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `hn.algolia.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `algolia.com` allows |
| `lea.verou.me` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `verou.me` 404 `text/html; charset=utf-8` |
| `lethain.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `lucumr.pocoo.org` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `pocoo.org` ERR `no ct` |
| `ollama.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `planet.postgresql.org` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `postgresql.org` allows |
| `remix.run` | 404 | `text/plain;charset=UTF-8` | **404-ALLOWED** | no | - | n/a |
| `tailwindcss.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `this-week-in-rust.org` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `vite.dev` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | n/a |
| `www.sophiebits.com` | 404 | `text/html; charset=utf-8` | **404-ALLOWED** | no | - | `sophiebits.com` 404 `text/html; charset=utf-8` |
| `ziglang.org` | 404 | `text/html` | **404-ALLOWED** | no | - | n/a |
| `antfu.me` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | n/a |
| `api.quantamagazine.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `quantamagazine.org` allows |
| `astro.build` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `aws.amazon.com` | 200 | `text/plain;charset=UTF-8` | **ALLOWED** | no | - | `amazon.com` allows |
| `blog.angular.dev` | 200 | `text/plain` | **ALLOWED** | no | - | `angular.dev` allows |
| `blog.cloudflare.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes` | `cloudflare.com` allows |
| `blog.pragmaticengineer.com` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `pragmaticengineer.com` 404 `text/html; charset=utf-8` |
| `blog.rust-lang.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `rust-lang.org` 404 `text/html; charset=utf-8` |
| `blog.sentry.io` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `sentry.io` allows |
| `blog.val.town` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `search=yes,ai-train=no,use=reference` | `val.town` allows |
| `bun.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `buttondown.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `chriscoyier.net` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `console.dev` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `css-tricks.com` | 200 | `text/plain` | **ALLOWED** | no | Crawl-delay 1 | n/a |
| `danluu.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `deepmind.google` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `deno.com` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | n/a |
| `dev.to` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `devblogs.microsoft.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | Crawl-delay 10 | `microsoft.com` allows |
| `developer.chrome.com` | 200 | `text/plain` | **ALLOWED** | no | - | `chrome.com` 200 `text/html; charset=UTF-8` |
| `discord.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `fasterthanli.me` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `frontendfoc.us` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `github.blog` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `go.dev` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `golangweekly.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `hacker-news.firebaseio.com` | 200 | `text/plain` | **ALLOWED** | no | - | `firebaseio.com` ERR `no ct` |
| `hacks.mozilla.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | Crawl-delay 10 | `mozilla.org` allows |
| `hnrss.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `huggingface.co` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `importai.substack.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `substack.com` allows |
| `jakearchibald.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `javascriptweekly.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `jvns.ca` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | n/a |
| `kentcdodds.com` | 200 | `text/plain` | **ALLOWED** | no | CS `ai-train=no, search=yes, ai-input=no` | n/a |
| `laravel-news.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `lilianweng.github.io` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `github.io` 200 `text/html; charset=utf-8` |
| `lwn.net` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | Crawl-delay 10, Crawl-delay 10 | n/a |
| `magazine.sebastianraschka.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `sebastianraschka.com` allows |
| `martinfowler.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `mistral.ai` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | n/a |
| `neon.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes` | n/a |
| `netflixtechblog.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `news.ycombinator.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | Crawl-delay 30 | `ycombinator.com` allows |
| `nextjs.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `search=yes, ai-input=yes, ai-train=yes` | n/a |
| `nodejs.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `nodeweekly.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `nolanlawson.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `nuxt.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `search=yes, ai-train=yes, ai-input=yes` | n/a |
| `openai.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `overreacted.io` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `oxide.computer` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `planetscale.com` | 200 | `text/plain` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes` | n/a |
| `postgresweekly.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `public.api.bsky.app` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `bsky.app` allows |
| `pycoders.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `pytorch.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes` | n/a |
| `rachelandrew.co.uk` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `react.dev` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `react.statuscode.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `statuscode.com` ERR `no ct` |
| `render.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes`, CS `ai-train=yes, search=yes, ai-input=yes` | n/a |
| `research.google` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `rubyonrails.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `rubyweekly.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `simonwillison.net` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `stackoverflow.blog` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | n/a |
| `stripe.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | Crawl-delay 2 | n/a |
| `supabase.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=yes, search=yes, ai-input=yes` | n/a |
| `svelte.dev` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `techcrunch.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `thegradient.pub` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `thenewstack.io` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `tldr.tech` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `v8.dev` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `vercel.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `search=yes, ai-input=yes, ai-train=no` | n/a |
| `web.dev` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `webkit.org` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | n/a |
| `webtoolsweekly.com` | 200 | `text/plain` | **ALLOWED** | no | - | n/a |
| `www.404media.co` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `404media.co` allows |
| `www.baldurbjarnason.com` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `baldurbjarnason.com` allows |
| `www.bram.us` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `bram.us` allows |
| `www.djangoproject.com` | 200 | `text/plain` | **ALLOWED** | no | - | `djangoproject.com` allows |
| `www.docker.com` | 200 | `text/plain` | **ALLOWED** | no | - | `docker.com` allows |
| `www.interconnects.ai` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `interconnects.ai` allows |
| `www.joshwcomeau.com` | 200 | `text/plain` | **ALLOWED** | no | - | `joshwcomeau.com` allows |
| `www.latent.space` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `latent.space` allows |
| `www.phoronix.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `search=yes,ai-train=no,use=reference` | `phoronix.com` allows |
| `www.postgresql.org` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `postgresql.org` allows |
| `www.smashingmagazine.com` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `smashingmagazine.com` allows |
| `www.stefanjudis.com` | 200 | `text/plain; charset=UTF-8` | **ALLOWED** | no | - | `stefanjudis.com` allows |
| `www.theverge.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `theverge.com` allows |
| `www.totaltypescript.com` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | - | `totaltypescript.com` allows |
| `xeiaso.net` | 200 | `text/plain; charset=utf-8` | **ALLOWED** | no | CS `ai-train=no, search=yes, ai-input=no` | n/a |
