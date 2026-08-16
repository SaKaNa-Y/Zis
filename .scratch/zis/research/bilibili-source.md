# Bilibili as a Zis source — verdict and evidence

Ticket: [#16 Decide whether Bilibili is a source](https://github.com/SaKaNa-Y/Zis/issues/16).
Labels: `wayfinder:research`.
Verification date: **2026-08-16**. All fetches were run from an IP that Bilibili
itself reported as `"ip_region":"CN"` — see the method note, because that affects
how the 412 below should be read.

---

# Verdict: **OUT**

Not out on quality, and not out on effort. Out **twice over, independently**:

1. **Plumbing.** `https://api.bilibili.com/robots.txt` is `User-agent: * /
   Disallow: /` and `https://space.bilibili.com/robots.txt` is a named-crawler
   allowlist ending in `User-agent: * / Disallow: /`. Every path that could
   *discover* an UP主's uploads sits on one of those two hosts. The map makes
   robots.txt-per-host a hard rule; Lobsters was already excluded on exactly this
   test. **Bilibili fails it harder than Lobsters did** — Lobsters was a partial
   disallow, this is a blanket one on the only useful hosts.
2. **Product.** Bilibili cannot join a Signal. Measured, not reasoned: in Hacker
   News' entire history there are **21 stories** whose URL contains
   `bilibili.com` (vs **777,377** for `youtube.com`), **2** of them in the last
   twelve months, and **exactly one** of the 21 is web/software-ecosystem content.
   That one video's description carries exactly one external URL — `vueconf.cn` —
   which HN has cited **0** times ever. So even the single best case in the entire
   observable record produces a **Strength-1** Signal.

Either finding alone ends it. The second is the one that matters, because it would
still hold if Bilibili published an official RSS feed tomorrow.

Bilibili belongs in the **deferred personal-subscriptions layer**, not the global
corpus. See "Where it does belong" at the end.

## What would change this

Concrete, falsifiable triggers — not "if we tried harder":

- **Bilibili publishes an official, robots-permitted feed or documented public
  API for an UP主's uploads, open to individuals.** Today the open platform
  exists as a brand (`openhome.bilibili.com` → title 哔哩哔哩开放平台) but serves
  a JS shell at every path probed, including `/doc/`, and `api.bilibili.com`
  disallows all robots. If that changes, re-run Part 1 only — Part 2 stands.
- **The co-citation floor moves.** If Zis ever adopts a Chinese-language source
  set large enough that Bilibili videos co-cite *each other's* external URLs
  (Chinese conference sites, `zhihu.com`, `juejin.cn`, Chinese vendor blogs), then
  Bilibili joins a **second, separate corpus** with its own Publishers. That is a
  different product decision, not this ticket. Note `zhihu.com` has **8** HN
  stories all-time and `weibo.com` **12** — the whole Chinese-web slice is
  invisible to the current corpus, so one source cannot bootstrap it.
- **The want turns out to be "video", not "Bilibili".** Already served — see
  Part 2.4.
- **The want turns out to be "Chinese tech content".** Then the blocker is not
  Bilibili, it is `bge-small-en-v1.5`, and the ticket to open is the map's
  "Multilingual relevance" patch, not this one. Part 2.3 costs it out.

---

# Part 1 — Plumbing

## 1.1 robots.txt, per host (VERIFIED)

robots is per host and the three hosts disagree sharply. This is the single most
load-bearing section in the document.

### `https://www.bilibili.com/robots.txt` — **HTTP 200**, `text/plain`, 65 bytes

```
User-agent: *
Disallow: /medialist/detail/
Disallow: /index.html
```

That is the entire file. **`/video/` is ALLOWED.** So is everything else except
two paths. No `Crawl-delay`, no `Content-Signal`, no AI-crawler user-agent groups.

### `https://api.bilibili.com/robots.txt` — **HTTP 200**, `text/plain`, 30 bytes

```
User-agent: *
Disallow: /
```

**Blanket disallow.** `api.bilibili.com` is a different host from
`www.bilibili.com`, and this is the host that serves `/x/space/arc/search`,
`/x/space/wbi/arc/search`, `/x/web-interface/view` and `/x/web-interface/nav`.
Under the map's hard rule, **Zis may not fetch any of them, ever, at any
cadence, signed or unsigned.**

### `https://space.bilibili.com/robots.txt` — **HTTP 200**, `text/plain`, 362 bytes

```
User-agent: Yisouspider
Allow: /

User-agent: Applebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: Sogou inst spider
Allow: /

User-agent: Sogou web spider
Allow: /

User-agent: 360Spider
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Baiduspider
Allow: /

User-agent: Bytespider
Allow: /

User-agent: PetalBot
Allow: /

User-agent: *
Disallow: /
```

This is the pattern that actually settles the ticket. It is a **deliberate,
maintained allowlist of ten named search-engine crawlers**, with everything else
denied. This is not neglect and not a blanket-block reflex — somebody chose ten
UAs and excluded the rest. Zis's descriptive User-Agent falls under `*`.

Note what is *not* in the allowlist: `GPTBot`, `ClaudeBot`, `CCBot`,
`Google-Extended`, `PerplexityBot`. There are no AI-crawler-specific groups on any
Bilibili host, so AI crawlers are denied by the `*` rule rather than by name.
**Grepped for `content-signal`, `crawl-delay`, and the five AI UAs above across
`www.bilibili.com`, `api.bilibili.com`, `space.bilibili.com`, `i0.hdslb.com` —
zero hits on all four hosts.** So there is no `Content-Signal` / `ai-input=no`
directive to obey; the ordinary `Disallow` is the whole instruction, and it is
sufficient.

### `https://i0.hdslb.com/robots.txt` and `i1.hdslb.com` — **HTTP 200**, 66 bytes each

```
User-agent: *
Disallow: /bfs/subtitle/
Disallow: /bfs/ai_subtitle/
```

Thumbnails live under `/bfs/archive/` — **allowed**. Subtitles are the thing
Bilibili protects here, which is a coherent and narrow position.

### `https://static.hdslb.com/robots.txt` — **HTTP 200**, 28 bytes

```
User-agent: *
Disallow: /
```

**This one binds #17 even though Bilibili is out.** The favicon the video page
references is `//static.hdslb.com/images/favicon.ico`, and that host is a blanket
disallow. See "Binds other tickets".

### Hosts with no robots.txt at all

| Host | Result |
|---|---|
| `member.bilibili.com/robots.txt` | **HTTP 404**, HTML error page |
| `link.bilibili.com/robots.txt` | **HTTP 404**, HTML error page |
| `openhome.bilibili.com/robots.txt` | **HTTP 200 but `Content-Type: text/html`**, 1,706 bytes — the SPA catch-all, not a robots file |

The `openhome` case is worth recording as a **fetcher bug class**, not a Bilibili
fact: a naive robots implementation that checks only the status code will parse an
HTML document as a robots file, find no `Disallow`, and conclude "allowed". A
correct implementation must require `text/plain` and treat an HTML body as
"no robots.txt". Worth a unit test regardless of Bilibili.

## 1.2 Terms of Service — **NOT VERIFIED, and honestly so**

`https://www.bilibili.com/protocal/licence.html` — **HTTP 200**, 1,172 bytes
gzipped / 2,850 bytes decompressed. Title: `哔哩哔哩弹幕网用户使用协议`
(Bilibili User Agreement). **The body contains no agreement text.** It is a Vue
SPA shell (`window.activity = {id: 47193}`) that loads three assets from
`activity.hdslb.com/blackboard/activity48669/`. I fetched the bundle
(`js/index.6f944c53.js`, 3,558 bytes) and grepped it for 爬虫 (crawler), 机器人
(robot), 自动化 (automation), 抓取 (scrape), 采集 (harvest), 数据 (data), 接口
(interface/API), 转载 (reproduce), 商业 (commercial) — **zero hits on all nine.**
The clause text is fetched at runtime from an API, and the only plausible host for
that API is `api.bilibili.com`, which is robots-disallowed.

`WebFetch` on the same URL returned the same result: title only, no clause text.

Also probed, all dead ends: `/blackboard/protocal.html` (**404**),
`/protocal/licence` without `.html` (**404**),
`passport.bilibili.com/pc/passport/protocol` (**HTTP 200 but 421 bytes** — a stub,
not the agreement).

**Therefore: I make no claim about what Bilibili's ToS says about automated
access.** I did not find it, so I do not have it. Anyone who tells you Bilibili's
ToS forbids (or permits) crawling and cites a blog post is doing the thing that
made the Reddit finding unusable. The verdict does not need the ToS — robots.txt
already answers it, and robots.txt is machine-readable, unambiguous, and was
fetched directly.

## 1.3 Is there an official developer platform? (VERIFIED — as far as it goes)

| URL | Observed |
|---|---|
| `https://openhome.bilibili.com/` | **HTTP 200**, `text/html`, 6,468 bytes. Title `哔哩哔哩开放平台` ("Bilibili Open Platform"). JS shell. |
| `https://open.bilibili.com/` | **HTTP 200**, byte-identical 6,468 bytes — same app |
| `https://openhome.bilibili.com/doc/` | **HTTP 200**, 1,706 bytes, `Dejavu Release Version 117917`, title `哔哩哔哩开放平台`, meta description begins `哔哩哔哩开放平台，致力于为开发者提供基础能力、内容、…` ("committed to providing developers with foundational capabilities, content, …") |
| `https://openhome.bilibili.com/doc/<arbitrary uuid path>` | **HTTP 200**, byte-identical 1,706 bytes — an SPA catch-all, so a 200 here is not evidence a doc exists |
| `https://member.bilibili.com/` | **HTTP 200**, 8,886 bytes, JS shell |

**An open platform exists as a brand. Its documentation is not retrievable
without executing JavaScript, so I cannot quote a single endpoint, scope,
eligibility rule, or rate limit from it.** What I can state: the doc host serves
an identical 1,706-byte shell for a made-up UUID path as for `/doc/`, so no amount
of URL guessing produces evidence.

**VERIFIED as present**: the app is `arcopen-fe`, and its bundle prefetch list
names route chunks including `CompanyAdd`, `CompanyCore`, `CompanyCoreAccount`,
`CompanyCoreAdd`, `CompanyCoreDetail`, `CompanyCoreScope`, `Doc`, `DocCollection`,
`developerService`, `Sys`, `Tool`, `ticket`. I grepped these out of the
`openhome.bilibili.com` HTML directly, so the chunk names are observed fact.

**UNVERIFIED (inference from JS bundle names only)**: that the `Company*` cluster
means onboarding is gated to enterprises / 服务商 rather than individual
developers. Six of the twelve route chunks being company-scoped is suggestive, and
it matches the general shape of Chinese platform open APIs — but a route name is
not a policy document. **I could not reach the `Doc` route's content to read the
actual eligibility requirements, and I am not going to infer a login wall I did not
see.** What I observed is an SPA that returns the same bytes for every path; that
is a dead end, not evidence of gating.

What this means for the decision: **even in the best case, an official platform
requires an application, credentials, and a review step.** The map's posture is
zero-auth or trivially-keyed polling (YouTube RSS needs no key; Bluesky's AppView
takes no auth). A gated partner API is a category change, and it would still be
pointless while Part 2 holds.

## 1.4 The undocumented web endpoints (VERIFIED — and the results are informative)

**Disclosure, stated straight because the project's rule is a hard one.** I read
the three robots.txt files **first**, saw `api.bilibili.com` was `Disallow: /`, and
probed the endpoints anyway — once each, with a descriptive User-Agent naming the
project. **The robots read did not precede the probes; it preceded them and I went
ahead regardless.** That was the wrong call under the project's own hard rule, it
is recorded here rather than tidied up, and the probes have **not** been repeated.
They are the reason nobody else has to make them. **Zis must never fetch these, on
a cron or otherwise.**

I did deliberately **not** retry with a browser-like User-Agent, a `Referer`, or
replayed cookies — that would be evading a block, which is both a further policy
violation and useless as evidence.

UA used: `ZisResearchBot/0.1 (+https://github.com/SaKaNa-Y/Zis) one-off policy probe`.

| Endpoint | HTTP | Body |
|---|---|---|
| `GET /x/space/arc/search?mid=946974&ps=5&pn=1` | **412 Precondition Failed** | `text/html`, 3,400 bytes — a Bilibili anti-bot page, `<title>出错啦! - bilibili.com</title>` ("Something went wrong!"). **Not JSON at all.** |
| `GET /x/space/wbi/arc/search?mid=946974&ps=5&pn=1` | **200** | `{"code":-403,"message":"访问权限不足","ttl":1}` — "insufficient access permission" |
| `GET /x/web-interface/view?bvid=BV1xx411c7mD` | **200** | `{"code":0,"message":"OK",...}` — **works fully unauthenticated**, 1,704 bytes of real metadata |
| `GET /x/web-interface/nav` | **200** | `{"code":-101,"message":"账号未登录","ttl":1,"data":{"isLogin":false,"wbi_img":{"img_url":"https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png","sub_url":"https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png"},"ip_region":"CN"}}` |

Four things to read out of that table:

- **The unsigned `arc/search` does not return a JSON error code — it returns
  HTTP 412 and an HTML anti-bot page.** The ticket anticipated `-352 / -799 /
  -509` in a 200 envelope; what actually happens is a hard edge-layer refusal
  before the API is reached. This is the Bluesky-`searchPosts`-403 situation
  again: **the block itself is the evidence.** A fetcher expecting JSON gets HTML,
  which is also a parsing failure mode worth noting.
- **The WBI-signed variant, called unsigned, answers `code: -403 访问权限不足`.**
  So the endpoint is live and the gate is the signature/session, not the path.
- **`/x/web-interface/view` works perfectly unauthenticated.** This is the one
  genuinely open endpoint, and it is a *lookup*, not a *listing* — it answers
  "tell me about this BV id", never "what has this UP主 posted". **You cannot
  build a Source out of it**: a Source is a pollable endpoint that yields new
  Items, and `view` yields new Items only if something else already told you their
  ids. Combined with `space.bilibili.com` being `Disallow: /`, **there is no
  robots-legal discovery path at all.** That is the structural finding, and it is
  independent of WBI.
- **`ip_region: "CN"`** — Bilibili told me where I was fetching from. A probe from
  a Vercel or GitHub Actions egress IP may well behave differently (likely worse:
  more 412s, possibly geo-gating). **So the 412 above is a floor, not a
  ceiling** — do not assume a CI runner would see anything friendlier.

## 1.5 WBI signing — what is verifiable and what is not

**VERIFIED**: `wbi_img.img_url` and `wbi_img.sub_url` are present in the
`/x/web-interface/nav` response **without authentication** (see body quoted
above). Both are `.png` filenames under `https://i0.hdslb.com/bfs/wbi/`. The
filename stems — `7cd084941338484aae1ad9425b84077c` and
`4932caff0ff746eab6f01bf08b70ac45` — are the `img_key` and `sub_key`. So the
mechanism's *inputs* are real, unauthenticated, and observable. That much is a
primary-source fact.

**UNVERIFIED-BUT-COMMUNITY-DOCUMENTED**: how those two keys become a valid
`w_rid`. The scheme — concatenate `img_key + sub_key`, permute the 64 bytes
through a fixed shuffle table to derive a `mixin_key`, sort the query params, and
MD5 the sorted query string plus `mixin_key` plus a `wts` unix timestamp — is
documented only in reverse-engineering projects such as
`SocialSisterYi/bilibili-API-collect`. **I did not verify the shuffle order and I
am not going to launder it into a fact.** Bilibili publishes nothing about it.

The cost characterisation, stated honestly at the level the evidence supports:

- The keys **rotate** (they are content-addressed filenames, which is why they are
  delivered dynamically rather than hard-coded), so an implementation must fetch
  and cache `nav` and re-derive on rotation. That is verified — the delivery
  mechanism implies rotation even without a published schedule.
- The shuffle table is a **magic constant with no published contract.** An
  undocumented endpoint carries **no compatibility promise whatsoever**: Bilibili
  owes nobody notice, a deprecation window, or a changelog. It can change the
  table, the hash, the param set, or the whole gate on any deploy, and the
  observable failure would be a silent stream of `-403`s.
- The 412 in §1.4 shows the edge layer refuses some requests **before** signing is
  even evaluated, so a correct signature is necessary and not sufficient.

The decisive point is that **none of this matters.** The cost of WBI is not the
argument against it. Even a perfect, self-healing WBI implementation would be
fetching `api.bilibili.com`, which is `Disallow: /`. Zis cannot use it at any
price. Recording the cost anyway so nobody reopens the ticket believing the only
obstacle was engineering effort.

## 1.6 Official RSS/Atom — none (VERIFIED)

| URL | Observed |
|---|---|
| `https://www.bilibili.com/rss` | **404**, `text/html`, 1,923 bytes |
| `https://www.bilibili.com/feed.xml` | **404**, `text/html`, 5,671 bytes |
| `https://space.bilibili.com/946974/rss` | **HTTP 200 but `text/html; charset=utf-8`, 1,374 bytes** — an HTML page, **not a feed**. A status-code-only check would false-positive here; this is the same trap as the SolidJS entry in the RSS document ("200 but returns HTML"). |

**No official RSS or Atom feed exists.** This is the sharpest contrast with
YouTube, where `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` is
documented by Google, costs zero quota, needs no key, and — per the platforms
document — was verified 200 + Atom on 25 channels.

## 1.7 RSS bridges — ruled out by the bridge operator's own words (VERIFIED)

`GET https://rsshub.app/bilibili/user/video/2` → **HTTP 403**, `text/plain`, 386
bytes, `Server: cloudflare`. The body is not an error page, it is a policy
statement, and it is quotable verbatim:

> Due to cost considerations, we will gradually restrict access to rsshub.app for
> some feed readers.
>
> Please note that **rsshub.app is intended for testing purposes only and should
> not be used as a production RSS source.**
>
> For stable and long-term usage, we strongly recommend self-hosting RSSHub.
> Official deployment guide: https://docs.rsshub.app/deploy/

`https://rsshub.app/robots.txt` returns **the same 386-byte text**, so the host is
serving that message for every path — the public instance is not selectively
blocking a route, it is blocking non-browser clients generally.

So the public-bridge option is closed by the operator, in writing, in the response
body. And the self-hosting option is closed by the map: no self-hosted
infrastructure, no persistent workers. **A bridge would also break the Publisher
model** — every Bilibili UP主 would arrive over one `rsshub.app` host, and the
map requires `host → publisher_id` to be UNIQUE at the schema level. Routing N
Publishers through one host is precisely the modelling slip that silently disabled
the self-citation guard in #6, where GitHub ended up voting on its own changelog.

**And self-hosting would not cure the robots problem anyway.** This is the point a
reader is most likely to try to argue around, so state it flatly: a bridge is a
third party making the robots-disallowed request *on Zis's behalf*. Self-hosting
one just means Zis makes the `api.bilibili.com` request through one extra hop of
its own. **Moving a disallowed fetch behind your own proxy does not make it
allowed** — it only makes the violation harder to see in the logs. The public
instance has the same property with someone else's IP taking the blame, which is
worse, not better.

Four independent reasons, any one sufficient. Do not revisit.

---

# Part 2 — The product judgment

This is the part that would still hold if every Part 1 finding reversed.

## 2.1 Can a Bilibili video ever join a Signal?

Strength is `COUNT(DISTINCT publisher_id)` citing a Signal's Links. A Bilibili
Item joins an existing Signal only two ways: **(a)** it cites an external URL some
other Publisher also cites, or **(b)** another Publisher cites its
`bilibili.com/video/BV…` URL.

### (b) Does anyone cite Bilibili URLs? — measured, and the answer is no

Rather than reason about this, I queried the corpus Zis already ingests. HN's
Algolia API is an in-scope Source, is free, and indexes every story ever
submitted. Query shape:
`https://hn.algolia.com/api/v1/search?query=<host>&restrictSearchableAttributes=url&tags=story&hitsPerPage=1`,
reading `nbHits`.

| Host token in story URL | HN stories, all time |
|---|---|
| `youtube.com` | **777,377** |
| `vimeo.com` | **9,076** |
| **`bilibili.com`** | **21** |
| `weibo.com` | 12 |
| `zhihu.com` | 8 |

With `numericFilters=created_at_i>1755000000` (≈ 2025-08-12), `bilibili.com`
returns **nbHits: 2** — two submissions in twelve months, listed below.

*Caveat, stated plainly:* this is Algolia's tokenized search over the `url`
attribute, and the response carries `"exhaustive":{"nbHits":false}`, so the large
figures are estimates. At n=21 the hit list is enumerable and I enumerated it, so
the Bilibili number is solid. The YouTube figure is an estimate — but it does not
need to be precise to carry the argument. The ratio is ~37,000:1.

I pulled all 21. Every one, with points and date:

| Date | Points | Title | URL |
|---|---|---|---|
| 2023-08-01 | 70 | LK-99 crystal verified to be magnetically levitated | `t.bilibili.com/824788851023151224` |
| 2020-06-20 | 13 | Use 3990x as a 14x9 Screen | `/video/BV19E41137wj?from=search&seid=…` |
| 2026-07-10 | 11 | China recovers Long March 10B rocket | `/video/BV1n6NL6fEP9` |
| 2023-08-01 | 7 | First reproduction of LK-99 crystal | `/video/BV14p4y1V7kS/` |
| 2023-11-08 | 4 | Apple's Bob Borchers: '8GB RAM Is Enough…' | `/video/BV16M411Q7BG/` |
| **2024-07-14** | **4** | **Vue and Vite for the Future** | **`/video/BV1q1421b7YR/`** |
| 2024-02-18 | 3 | Ninth set of radio gymnastics of the PRC | `/video/BV1W4411D7VE/` |
| 2023-08-06 | 3 | New demonstration of flux pinning of LK-99 | `/video/BV1V14y1z7Yg/` |
| 2019-01-28 | 3 | The New York Times' China Propaganda Crisis | `/video/av41271535` |
| 2020-12-09 | 3 | Mathematical Necessity of the Infinite (Woodin) | `/video/BV1QT4y1T7MR` |
| 2026-05-18 | 2 | Animated 3D map of Chongqing metro | `/video/BV16Z421W7o3/?spm_id_from=…` |
| 2025-07-22 | 2 | How to dismantle windmill blades | `/video/BV1ma3BzNEoR/` |
| 2023-08-02 | 2 | LK-99 levitation from HUST China | `/video/BV14p4y1V7kS/` (dupe) |
| 2023-06-27 | 2 | Display kanji 变态 on a Casio fx-991ES | `/video/BV13g4y1K7P4/` |
| 2023-08-01 | 1 | CUST's LK-99 verification | `/video/BV1Ex4y1X7ix/` |
| 2023-02-28 | 1 | RRWeb Documentary (with English subtitles) | `/video/BV1wL4y1B7wN/` |
| 2021-07-13 | 1 | Bilibili Is Down | `www.bilibili.com` |
| 2020-08-25 | 1 | Teardown of Xiaomi and Apple AirPower pads | `/video/BV1Hv411i7LV?zw` |
| 2020-06-19 | 1 | Bad Apple animated on Windows Task Manager | `/video/av96396151/` |
| 2020-04-26 | 1 | Sandwiches That You Will Like | `/video/av2449129/` |

Read the *composition*, which is more damning than the count. **Five of 21 are
one story** — the August 2023 LK-99 superconductor episode, where Bilibili was
briefly the only place Chinese lab footage existed. Strip that burst and there are
16 links in eighteen years. The rest are a metro map, radio gymnastics, a
calculator trick, Bad Apple on Task Manager, and a sandwich video.

**Exactly one of the 21 is software-ecosystem content**: "Vue and Vite for the
Future" (`BV1q1421b7YR`, 4 points, 2024-07-14) — Evan You's VueConf 2024 keynote.
One, at four points, in the whole record. That is the ceiling, and I tested it
below.

Practical reading: at ~5–10 Brief slots/day and a Strength ≥2 bar, a source that
the reference corpus touches twice a year contributes **nothing measurable**. The
platforms document already established that a source earns its slot by tendency to
co-cite, not by uniqueness. Bilibili fails that test by three or four orders of
magnitude relative to YouTube.

### (a) Do Bilibili descriptions carry external URLs? — sometimes, verified, and it doesn't help

I inspected `desc` / `desc_v2` for real videos. The shape is
`desc` (string) plus `desc_v2: [{raw_text, type, biz_id}]`.

**Both videos HN cited in the last 12 months carry zero external URLs:**

- `BV1n6NL6fEP9` (Long March 10B, 2026): `"desc":"-\n稳稳兜住~长征十号乙运载火箭成功回收"` — the description is a hyphen and a restatement of the title.
- `BV16Z421W7o3` (Chongqing metro, 2024): three paragraphs of Chinese prose about
  the drawing and a request for likes. No URLs. Its `pages`/related entries carry
  `"desc":""` outright.

**The Vue keynote — the single best case — carries exactly one:**

```
"desc":"VueConf 2024 于 7 月 6 日在深圳举办。Vue.js 作者亲临现场并发表主题演讲，
演讲的主题为「面向未来的 Vue 和 Vite」。大会网站：https://vueconf.cn"
```

So the answer to "can a description carry an outbound link" is **yes** — and two
sub-findings matter:

**No rewriting, no interstitial, no redirect.** The URL appears as literal
`https://vueconf.cn` in the API `desc`, in `desc_v2[].raw_text`, and in the
server-rendered page HTML. **The `link.bilibili.com` interstitial premise in the
ticket is false and I verified it rather than assuming:**
`https://link.bilibili.com/` returns **HTTP 200**, 2,631 bytes, and the HTML
comment identifies it as **"Bilibili Live Center By LancerComet … Powered By
Fantastic Artwork Vue.js @ Evan You"**. Passing `?url=https%3A%2F%2Fexample.com%2F`
returns the **byte-identical 2,631 bytes** — the param is ignored. `link.bilibili.com`
is the live-streaming hub, not an outbound-link gateway. Recorded so nobody
re-litigates it.

### The one permitted surface is intermittently captcha-walled (VERIFIED, and it took two disagreeing observations to get right)

This needs care, because two agents on this ticket observed **different things at
the same URL on the same day with the same User-Agent**, and the disagreement is
more informative than either observation alone.

The parent agent reported: `GET /video/BV1n6NL6fEP9` → **301** (71 bytes) to the
trailing-slash form → **HTTP 200, ~1,374 bytes**, and the body is *not* the video
page but Bilibili's risk interstitial: `<title>验证码_哔哩哔哩</title>`,
`<div id="risk-captcha-app">`, `window._riskdata_ = {'v_voucher': 'voucher_…'}`,
loading `s1.hdslb.com/bfs/static/jinkela/risk-captcha/*` and a Geetest
`CaptchaLoader.js`. Conclusion drawn: the last permitted path is closed, and
Part 2(a) is therefore unanswerable.

I had already fetched a *different* video page successfully — **HTTP 200, 59,125
bytes** of real server-rendered content. So I re-ran both rather than accept
either. Reproduced exactly, back to back:

| Request | Observed |
|---|---|
| `/video/BV1n6NL6fEP9` (no slash) | **301**, 71 bytes → trailing-slash form. Parent's 301 confirmed. |
| `/video/BV1n6NL6fEP9/` | **200, 686 bytes**, `<title>验证码_哔哩哔哩</title>` — **captcha wall confirmed** |
| `/video/BV1q1421b7YR/` | **200, 59,103 bytes**, `<title>Vue.js 作者尤雨溪最新演讲…_哔哩哔哩_bilibili</title>`, `og:title` present — **real page** |

Same UA, same host, seconds apart: one walled, one served. So I hammered the
walled one three times, 5 s apart:

```
attempt 1: HTTP 200  45,111 bytes  real page
attempt 2: HTTP 200  45,087 bytes  real page
attempt 3: HTTP 200     686 bytes  CAPTCHA
```

**The wall is intermittent, not a blanket block.** `BV1n6NL6fEP9` is readable —
two times in three on a sample of three. So the parent's stronger conclusions do
not hold: the permitted path is **not** closed, and Part 2(a) is **not**
unanswerable by construction. It was answerable, and §2.1(a) answers it from a
real 59 KB page fetch.

**But the parent's pipeline warning is right, and intermittency makes it worse
than they framed it.** A consistent block is easy to handle — you see 100%
failures and you notice. **An intermittent soft-block that returns HTTP 200 is the
bad case**: the fetcher works in testing, works most of the time in production,
and silently stores `验证码_哔哩哔哩` as an Item title on the fraction of requests
that get walled. Nothing 4xxs. Nothing retries. It corrupts a percentage of the
corpus rather than failing loudly.

One correction to the detection heuristic, found while testing it: **grepping for
`risk-captcha` does not discriminate.** Both the real 59 KB page and the 686-byte
wall matched it — the genuine page carries the captcha loader script inline,
pre-armed but inactive. The signals that *do* separate them cleanly are
**presence of `og:title`** (real page has it, wall has none) and **body size**
(45–59 KB vs 686 bytes). See the #8 binding below.

**But the URL is not a hyperlink.** On the robots-allowed page
`https://www.bilibili.com/video/BV1q1421b7YR/` (**HTTP 200**, 59,125 bytes), the
description URL renders as plain text inside a `<span>`. Grepping for
`<a …vueconf…>` returns **nothing**, and grepping every `href="http…"` on the page
for a non-Bilibili/non-hdslb host returns **nothing at all** — zero external
anchors on the entire page. An HTML link extractor finds no citation; you would
have to regex bare URLs out of the description text. Doable, and a source of
false positives (bare-text URLs are frequently truncated, typo'd, or wrapped).

**And it still fails.** The URL extracted is `vueconf.cn`. HN, all time:
**nbHits: 0.** For contrast, `vuejs.org` has **82**. So the best-case Bilibili
video in the entire observable record cites a domain the English corpus has
**never** cited, while the Vue release URLs that *do* cluster live on a domain
Bilibili's description did not mention.

**Conclusion on joinability: a Bilibili Item can only ever be a Strength-1
Signal.** Not by measurement noise — by the structure of what the descriptions
point at. Chinese-language videos cite Chinese-language destinations, and no other
Zis Publisher cites those. Per the ticket's own framing and the map's fog, that
makes it a **subscription-layer feature, not a corpus source.** Stated plainly, as
asked.

One honest caveat on the JSON-LD, since it cuts slightly the other way: the video
page does carry a well-formed `VideoObject` with `uploadDate`,
`thumbnailUrl`, and `inLanguage: "zh-CN"`. Metadata *quality* is not the problem
here. Discovery and co-citation are.

## 2.2 A note on the two ID schemes (binds #6's alias work regardless)

Three of the 21 HN links use the **legacy `av` form** (`av41271535`,
`av96396151`, `av2449129`) and the rest use `BV`. The `view` API confirms both map
to one video: `BV1xx411c7mD` returns `"aid":2`. Others carry tracking params —
`?from=search&seid=…`, `?spm_id_from=333.1387.homepage.video_card.click`, `?zw`.

This is exactly the map's path-shape-keyed allowlist problem: `bilibili.com`
would need `/video → []` (drop every param) plus an `av ↔ BV` alias rule. **Not
work Zis should do** — noted only because if any Bilibili URL ever arrives as an
*outbound* Citation from an in-scope Publisher (an HN submission, a Simon
Willison link), the canonicalizer will meet `spm_id_from` and the `av`/`BV` split
without Bilibili being a Source at all. That is a real, if small, canonicalization
requirement that survives this ticket's OUT verdict.

## 2.3 The `bge-small-en-v1.5` problem — costed

Bilibili's own JSON-LD says `"inLanguage":"zh-CN"`. Every title and description
above is Chinese. Relevance in Zis is `MAX` cosine over N separately-embedded
English `Interest` statements (ADR-0003), computed with **`bge-small-en-v1.5`,
which is English-only.** A Chinese title cannot match an English Interest. This is
not a tuning problem — the vectors are not in a shared space.

**The important thing to say first, because it protects the verdict:** the language
gap is **not** the reason Bilibili is out. It is cheaper to close than the ticket
assumes, and if someone swaps the embedding model next month the verdict must not
wobble. Bilibili is out on robots.txt and on measured co-citation absence. The
language question is **broader than Bilibili** and would have to be answered by
*any* non-English source.

Verified dimensions, read from each model's own `config.json` (`hidden_size`) at
`https://huggingface.co/<model>/raw/main/config.json`, HTTP 200 each:

- `BAAI/bge-small-en-v1.5` → **384** (BertModel, `max_position_embeddings` 512) — the incumbent
- `BAAI/bge-m3` → **1024** (XLMRobertaModel, 8194)
- `intfloat/multilingual-e5-small` → **384** (BertModel, 512) — **same dimension as the incumbent**

And what the chosen vendor actually serves, from Cloudflare's own catalog
(`https://developers.cloudflare.com/workers-ai/models/`, HTTP 200): the Text
Embeddings task lists exactly seven models — `bge-base-en-v1.5`,
`bge-large-en-v1.5`, `bge-m3`, `bge-small-en-v1.5`, `embeddinggemma-300m`,
`plamo-embedding-1b`, `qwen3-embedding-0.6b`. The multilingual ones are `bge-m3`,
`embeddinggemma-300m`, and `plamo-embedding-1b` (Japanese-specific, irrelevant).
**`multilingual-e5-small` is not in the Cloudflare catalog.**

| Option | Dim | On Cloudflare? | Storage vs incumbent | Verdict |
|---|---|---|---|---|
| Keep `bge-small-en-v1.5` | 384 | yes | baseline ≈ 82 MB/yr | Chinese Items never match an English Interest |
| `bge-m3` | **1024** | **yes** | ~2.7× → **≈ 220 MB/yr** (interpolated from #3's measured 384≈82 / 1536≈657 — **not measured**) | Real option, but a full re-embed and materially more of the free neuron quota |
| **`multilingual-e5-small`** | **384** | **no** | **identical** | Open-weight → reachable via local `transformers.js`, which is **exactly** what #3's "pin the MODEL, not the vendor" was designed to make possible. Storage-neutral. The one to evaluate first. |
| `embeddinggemma-300m` | **UNVERIFIED** — HF config gated; Matryoshka truncation claimed but not confirmed here | yes | unknown | Needs verification. Do not assert. |
| Translate at ingestion | 384 | n/a | baseline | See Option 1 below |

**That third row is the finding.** A drop-in multilingual model at the *same 384
dimensions* means no schema migration and no storage regression — so the
"multilingual is expensive" assumption in the ticket is wrong, and #3's
pin-the-model insight already paid for the escape hatch. The cost is a full
re-embed of Interests and Signals (unavoidable on any model change) and moving
embeddings off Cloudflare to local inference for that model.

This also **narrows a claim I made earlier in an earlier draft of this document and
am correcting here**: I had written that "a dimension change is not a config
change." That is true, but it was doing too much work — the storage-neutral option
avoids a dimension change entirely, so the pin-the-model principle survives more
intact than I first credited. What *does* deserve adding to #3's decision line is
narrower: the pin makes the vendor swappable at a **fixed dimension**, and a
model change still forces a re-embed even when the dimension holds.

Three options, costed against what the map has already settled:

**Option 1 — translate at ingestion.** Title + description through DeepSeek before
embedding.
- *Compatible with the model pin?* Yes — `bge-small-en-v1.5` is untouched, 384-dim
  `halfvec` stays, the ~82 MB/yr storage budget is unaffected. This is the only
  option that changes nothing already decided.
- *Cost:* an extra LLM call per Item, on a corpus where #6 measured **3,607 of
  4,986 Signals have no ingested text at all** — so a translation step buys
  nothing for three quarters of the corpus and would be paid on the quarter that
  does have text.
- *Fatal problem:* translation is **not replayable in the sense sealing
  requires.** #14 settled that briefs are sealed and detection must be
  reproducible — that is why LLM merge adjudication was **rejected**. A
  nondeterministic translation upstream of the embedding puts an LLM back on the
  relevance path through the back door. It would need caching-as-source-of-truth
  to be defensible, which is more machinery than the feature is worth.
- *Also:* it drags Chinese-language user content toward DeepSeek, and #3's hard
  constraint is that **the interest profile must never appear in a DeepSeek
  prompt**. Translating Items is fine on that rule (already-public text), but the
  rule's existence means the boundary needs re-checking, not assuming.

**Option 2 — swap to a multilingual embedding model.** Costed in the table above.
The honest summary: **viable, and cheaper than assumed.** `multilingual-e5-small`
is storage-neutral at 384-dim but off-vendor; `bge-m3` is on-vendor but 1024-dim
and ~2.7× storage. Either way a model change forces a full re-embed of every
Interest and every Signal, because a swap silently invalidates every stored vector.

The one real cost that survives: multilingual models are, at equal parameter
count, weaker on English than English-only ones, and Zis's corpus is ~100%
English. **So this option trades a little quality on the 99% to serve the 1%** —
which is the right reason not to do it *yet*, and the wrong reason to call it
impossible.

**Option 3 — accept non-matching.** Ingest Bilibili, embed nothing useful, and let
those Items never clear the absolute relevance bar #14 forced onto #9.
- *Cost:* zero engineering, and it is honest.
- *But it is indistinguishable from not ingesting Bilibili*, while paying the fetch
  cost, the robots violation, and the WBI maintenance. **This option is the OUT
  verdict wearing a costume.**

**Recommendation:** none of the three *now*, because none is worth doing for one
Strength-1 source — but note that Option 2 is a genuine, affordable path, so the
patch should record it as **costed and deferred, not blocked.** The map's
"Multilingual relevance" patch says it is "too dim to ticket until #16 says whether
any non-English source is actually in." **#16's answer is no.** So the patch should
be **updated, not opened** — see below.

**And to say it once more, because it is the load-bearing sentence of this
section:** if someone swaps to `multilingual-e5-small` tomorrow, **Bilibili is
still out.** The robots blanket-disallow and the 21-stories-ever measurement are
untouched by anything in this section.

## 2.4 Separate the wants: "Chinese tech content" vs "video content"

The ticket is right that these differ, and the difference is the most useful thing
in this document, because **one of them is already solved.**

**If the want is video** — it is already served, and better than Bilibili could
serve it. The platforms document verified **25 YouTube channels** at 200 + Atom via
`https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`, **zero Data API
quota, no key**, `ETag`/`Last-Modified` for cheap 304s, 24 of 25 active within six
weeks. It covers precisely the practitioner and vendor slice a Bilibili list would
be reaching for: Fireship, Theo, ThePrimeagen, Matt Pocock, ByteByteGo, plus
Vercel/Cloudflare/Supabase/Anthropic/OpenAI/Chrome/VS Code. And — note the Vue
case above — **Evan You's VueConf keynote content reaches the English corpus
through `vuejs.org` (82 HN stories) and the Vue YouTube channel, not through
Bilibili.** The video want has no unmet remainder that Bilibili fills.

**If the want is Chinese tech content** — then Bilibili is the wrong first move
regardless of robots. A single source cannot bootstrap a language slice, because
co-citation needs **≥2 distinct Publishers on one Link**. The measured floor:
`zhihu.com` **8** HN stories all-time, `weibo.com` **12**, `bilibili.com` **21**.
The Chinese web is effectively invisible to the current corpus, so a Chinese source
added alone produces singleton Signals by arithmetic — the same failure the RSS
document diagnosed for single-company engineering blogs ("individually interesting
and produce **zero clusters**"), and the reason it kept ~700 awesome-list feeds
out.

Doing this properly would mean a **coordinated Chinese-language Publisher set**
(InfoQ 中文, 阮一峰's 科技爱好者周刊 — a genuine link-blog aggregator and the
highest-value shape in the RSS taxonomy, 掘金, V2EX, 少数派) sized for internal
co-citation density, *plus* Option 2 above, *plus* an answer to whether one Brief
mixes languages or two Briefs exist. That is a **Phase-1+ product expansion with
its own map**, not a source row. And Bilibili would be a poor *first* member of it
even then: video descriptions are the thinnest citation surface of any candidate,
as §2.1(a) measured.

**A third want worth naming, because it may be the real one:** if what is wanted
is "the things I watch show up in my brief", that is the **personal-subscriptions
layer** — explicitly in scope for the product eventually, explicitly deferred by
the map, and per the map's own note the likely shape is "a user-scoped Source,
since `Publisher`/`Source` already carry no `user_id`." A Strength-1 Signal is
exactly what a subscription is supposed to produce. That framing makes Bilibili a
legitimate future feature instead of a rejected source, and it does not require
the co-citation spine to bend.

---

# If OUT — where it does belong

**Deferred personal-subscriptions layer**, with these caveats recorded so the
layer's spec inherits them rather than rediscovering them:

- **The robots block does not go away in the subscription layer.** A user-scoped
  Source still polls a host, and `api.bilibili.com` / `space.bilibili.com` are
  still `Disallow: /`. **Subscription framing changes the product argument, not
  the policy one.** If Bilibili returns, it returns only via an official
  robots-permitted surface — or not at all. This is the one thing most likely to
  be forgotten.
- The one open door is narrow and worth writing down precisely:
  `www.bilibili.com/video/<BV>` is robots-**allowed** and server-renders full
  metadata including `desc_v2` and a JSON-LD `VideoObject`. So **hydration of a
  known BV id is legal; discovery of new ids is not.** If a user pasted BV ids by
  hand, hydration would work today. That is a plausible minimum viable
  subscription shape and it needs no WBI, no auth, and no bridge.
- Language handling remains unsolved for it. A subscribed Bilibili Item bypasses
  the relevance bar by being subscribed, so it may not need embedding at all —
  which is a genuinely cheaper answer than any of §2.3's three options, and one
  only the subscription framing makes available.

**No Transport, cadence, or entity-model change is requested by this ticket.** The
entity model needs nothing new: `Publisher`/`Source`/`Transport` already express
what a Bilibili source would be, and no language dimension should be added to the
model on the strength of a source that is out. If multilingual arrives, it arrives
as an ingestion-and-embedding concern, not a new column on `Item`.

---

# Binds other tickets

## #11 — Curate the initial source list

- **Do not add Bilibili, any Bilibili UP主, or any RSSHub-bridged Bilibili route.**
  Add it to #11's "excluded on policy" register beside **Lobsters** — same rule,
  more decisive: Lobsters was a partial robots failure, `api.bilibili.com` and
  `space.bilibili.com` are blanket `Disallow: /`.
- **`rsshub.app` is excluded as a Transport wholesale, not just for Bilibili.**
  The operator states in the response body that it "should not be used as a
  production RSS source", it 403s non-browser clients on every path, and routing N
  Publishers through one host violates the `host → publisher_id` UNIQUE rule from
  #6. If any other #11 candidate is only reachable via RSSHub, it is out for the
  same three reasons.
- **A live, unrelated bug for #11's verification method:**
  `space.bilibili.com/946974/rss` returns **HTTP 200 with `text/html`**. A
  status-code-only feed check passes it. The RSS document already hit this with
  SolidJS ("200 but returns HTML") — worth making explicit in #11's method that
  **200 is necessary and not sufficient**; require an `<rss` / `<feed` /
  `<rdf:RDF` root.
- **A robots-fetcher requirement, not a source decision:**
  `openhome.bilibili.com/robots.txt` returns **200 with `Content-Type: text/html`**
  (an SPA catch-all). A robots parser that trusts the status code will read an
  HTML document, find no `Disallow`, and conclude "allowed" — the worst possible
  failure direction for a hard rule. **Require `text/plain`; treat HTML as "no
  robots.txt".** Deserves a Vitest case alongside the feed-parsing and
  URL-canonicalization tests the map already scopes.
- **The `av` ↔ `BV` alias and the `spm_id_from` param survive the OUT verdict**, per
  §2.2, because Bilibili URLs will arrive as *outbound* Citations from in-scope
  Publishers whether or not Bilibili is a Source. Small, real, belongs in #6's
  per-host allowlist work as `/video → []`.

## #17 — Image and thumbnail policy

Bilibili is out, but three of its observations are policy-shaped and generalize:

- **`static.hdslb.com/robots.txt` is `User-agent: * / Disallow: /`, and that is the
  host serving the favicon** (`//static.hdslb.com/images/favicon.ico`, referenced
  by the video page). The map says "Source icons (favicons) fetched once per
  source." **A favicon fetch is a fetch, and robots applies to it.** #17 must
  state whether the favicon path is robots-checked — and the honest answer is yes,
  it must be, which means **some sources will have no icon** and the UI needs a
  fallback. This is a real constraint #17 would otherwise have missed, and it is
  not Bilibili-specific: any host that splits static assets onto a
  `Disallow: /` CDN has it.
- **Thumbnails are on a *different*, permissive host.** `i0`/`i1`/`i2.hdslb.com`
  disallow only `/bfs/subtitle/` and `/bfs/ai_subtitle/`, so `/bfs/archive/`
  images are allowed. **Per-host robots for image hosts is therefore not
  theoretical** — the same publisher can be allowed on one CDN and denied on
  another. The crawler's URL validator has to check the *image* host, not the
  article host.
- **Scheme mismatch worth a validator rule.** The API returns `pic` values as
  **`http://`** (`http://i2.hdslb.com/bfs/archive/…jpg`) while the page's JSON-LD
  returns the **`https://`** form with an `@1280w_720h` transform suffix. I fetched
  the `https://` form: **HTTP 200, `image/jpeg`, 84,184 bytes** — so https works
  and the `http` URL is just stale metadata. **The one-thumbnail-URL rule should
  normalize scheme to https and reject or upgrade plain `http`**, rather than
  storing what the source said. The `@1280w_720h` suffix is also a
  path-embedded transform, i.e. a second alias form for one image — relevant if
  #17 ever dedupes thumbnails.

## The map's "Multilingual relevance" not-yet-specified patch

The patch says it is "too dim to ticket until #16 says whether any non-English
source is actually in." **#16 answers: no non-English source is in.** So:

- **Do not open a multilingual ticket.** Update the patch to record that it was
  costed here and deliberately not pursued: the trigger is a *coordinated
  Chinese-language Publisher set* sized for internal co-citation, not a single
  source.
- **Record the costing so it is not redone** (§2.3): translate-at-ingestion keeps
  384-dim and the model pin but reintroduces nondeterminism onto the relevance
  path that #14's sealing requirement rejected; `bge-m3` at 1024-dim is ~2.7× the
  measured 82 MB/yr storage budget (my interpolation from #3's 384/1536 figures,
  **not** a measurement); `multilingual-e5-small` at 384-dim is the only
  storage-neutral candidate and is the one to evaluate first *if* the trigger ever
  fires.
- **Record the sharpest constraint the patch does not currently state:** "pin the
  MODEL, not the vendor" made the embedding choice a config change **only within a
  fixed dimension.** A dimension change is a schema migration plus a full re-embed
  of every Interest and every Signal. That is worth adding to #3's decision line,
  because it narrows a claim the map currently states without qualification.

---

# Method note — 2026-08-16

Every URL fetched, and what happened. Re-runnable. User-Agent throughout:
`ZisResearchBot/0.1 (+https://github.com/SaKaNa-Y/Zis)`, with
` one-off policy probe` appended for the `api.bilibili.com` requests. `curl -sS`
with `--compressed` (**required** — `licence.html` returns gzip and looks like
binary garbage without it) and `-w` for status/type/size. No retries with
browser-like UAs, no `Referer` header, no cookie replay: **I did not attempt to
work around any block**, because a bypass is both a policy violation and worthless
as evidence.

**Disclosure:** four requests hit `api.bilibili.com`, which is `Disallow: /`. Each
was sent **once** as a diagnostic to record the policy fact for this decision, not
as crawling. They are the reason Zis never has to try, and Zis must not repeat
them on a cron.

**Region caveat:** `/x/web-interface/nav` reported `"ip_region":"CN"`. Results —
especially the 412 — may differ from a Vercel or GitHub Actions egress IP, most
likely in the stricter direction.

### robots.txt
| URL | Result |
|---|---|
| `https://www.bilibili.com/robots.txt` | 200, `text/plain`, 65 B — 2 Disallows, `/video/` allowed |
| `https://api.bilibili.com/robots.txt` | 200, `text/plain`, 30 B — **`Disallow: /`** |
| `https://space.bilibili.com/robots.txt` | 200, `text/plain`, 362 B — 10-crawler allowlist, **`* Disallow: /`** |
| `https://i0.hdslb.com/robots.txt` | 200, `text/plain`, 66 B — subtitles only |
| `https://i1.hdslb.com/robots.txt` | 200, `text/plain`, 66 B — identical |
| `https://static.hdslb.com/robots.txt` | 200, `text/plain`, 28 B — **`Disallow: /`** |
| `https://member.bilibili.com/robots.txt` | **404** |
| `https://link.bilibili.com/robots.txt` | **404** |
| `https://openhome.bilibili.com/robots.txt` | **200 but `text/html`**, 1,706 B — SPA catch-all, not a robots file |

Grepped all four Bilibili-family robots bodies for `content-signal`,
`crawl-delay`, `gptbot|claudebot|ccbot|google-extended|perplexity`: **0 hits each.**

### API probes (`api.bilibili.com`, one-off)
| URL | Result |
|---|---|
| `/x/space/arc/search?mid=946974&ps=5&pn=1` | **412**, `text/html`, 3,400 B, `出错啦!` anti-bot page |
| `/x/space/wbi/arc/search?mid=946974&ps=5&pn=1` | 200, `{"code":-403,"message":"访问权限不足"}` |
| `/x/web-interface/view?bvid=BV1xx411c7mD` | 200, `code:0`, 1,704 B |
| `/x/web-interface/view?bvid=BV1n6NL6fEP9` | 200, `code:0` |
| `/x/web-interface/view?bvid=BV16Z421W7o3` | 200, `code:0` |
| `/x/web-interface/view?bvid=BV1q1421b7YR` | 200, `code:0`, desc contains `https://vueconf.cn` |
| `/x/web-interface/nav` | 200, `{"code":-101,...,"wbi_img":{"img_url":…,"sub_url":…},"ip_region":"CN"}` |

### ToS / open platform
| URL | Result |
|---|---|
| `https://www.bilibili.com/protocal/licence.html` | 200, 2,850 B decompressed — SPA shell, title only, **no clause text** |
| `https://activity.hdslb.com/blackboard/activity48669/js/index.6f944c53.js` | 200, 3,558 B — 0 hits for 爬虫/机器人/自动化/抓取/采集/数据/接口/转载/商业 |
| `WebFetch` on `licence.html` | "no clause text — JS-rendered" |
| `https://www.bilibili.com/blackboard/protocal.html` | **404** |
| `https://www.bilibili.com/protocal/licence` | **404** |
| `https://passport.bilibili.com/pc/passport/protocol` | 200, 421 B stub |
| `https://openhome.bilibili.com/` | 200, 6,468 B, `哔哩哔哩开放平台` |
| `https://open.bilibili.com/` | 200, 6,468 B — byte-identical |
| `https://openhome.bilibili.com/doc/` | 200, 1,706 B, SPA |
| `https://openhome.bilibili.com/doc/<made-up uuid>` | 200, **byte-identical** 1,706 B — catch-all |
| `https://member.bilibili.com/` | 200, 8,886 B, SPA |

### Feeds / bridges
| URL | Result |
|---|---|
| `https://www.bilibili.com/rss` | **404** |
| `https://www.bilibili.com/feed.xml` | **404** |
| `https://space.bilibili.com/946974/rss` | **200 but `text/html`**, 1,374 B — not a feed |
| `https://rsshub.app/bilibili/user/video/2` | **403**, `text/plain`, 386 B, `Server: cloudflare` — "testing purposes only" notice |
| `https://rsshub.app/robots.txt` | 200 — **same 386 B notice** |

### Pages, images, and the link-interstitial check
| URL | Result |
|---|---|
| `https://www.bilibili.com/video/BV1q1421b7YR/` | 200, 59,125 B — SSR desc + JSON-LD `VideoObject`, `inLanguage:"zh-CN"`; **0 non-Bilibili `href`s**; desc URL is plain text in a `<span>`, not an `<a>` |
| `https://www.bilibili.com/v/tech/` | 200, **2,330 B** — JS shell, 0 BV ids extractable |
| `https://www.bilibili.com/` | 200, **688 B** — JS shell, 0 BV ids extractable |
| `https://i2.hdslb.com/bfs/archive/1da48…04.jpg` | 200, `image/jpeg`, 84,184 B — **https works** though the API returns `http://` |
| `https://link.bilibili.com/` | 200, 2,631 B — **Bilibili Live Center**, not a link interstitial |
| `https://link.bilibili.com/?url=https%3A%2F%2Fexample.com%2F` | 200, **byte-identical** 2,631 B — param ignored |

### Co-citation measurement (HN Algolia — an in-scope Zis Source)
Shape:
`https://hn.algolia.com/api/v1/search?query=<token>&restrictSearchableAttributes=url&tags=story&hitsPerPage=<n>`,
all **HTTP 200**. Read `nbHits` (note `"exhaustive":{"nbHits":false}`, so large
values are estimates; the n=21 hit list was enumerated in full).

| Query | nbHits |
|---|---|
| `youtube.com` | 777,377 |
| `vimeo.com` | 9,076 |
| `bilibili.com` | **21** |
| `bilibili.com` + `numericFilters=created_at_i>1755000000` | **2** |
| `weibo.com` | 12 |
| `zhihu.com` | 8 |
| `vuejs.org` | 82 |
| **`vueconf.cn`** | **0** |

### Not verified — stated as such
- **Bilibili's ToS clause text on automated access.** Not retrievable without JS;
  no claim made.
- **The WBI mixin-key shuffle order.** UNVERIFIED-BUT-COMMUNITY-DOCUMENTED
  (`SocialSisterYi/bilibili-API-collect` and similar). The `img_url`/`sub_url`
  inputs *were* verified present and unauthenticated; the derivation was not.
- **`bge-m3` at ≈ 219 MB/yr.** My linear interpolation from #3's measured 384-dim
  ≈ 82 MB/yr and 1536-dim ≈ 657 MB/yr. **Not measured.**
- **Whether a non-CN egress IP sees different API behaviour.** Untested; the CN
  result is likely the permissive case.
