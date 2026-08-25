# Clustering model — how one story becomes one Signal

Settled by
[Specify the clustering algorithm](https://github.com/SaKaNa-Y/Zis/issues/6) and
extended by
[Decide the two unreachable duplicate classes](https://github.com/SaKaNa-Y/Zis/issues/20).
Read [`CONTEXT.md`](../CONTEXT.md) first; this document uses its terms without
redefining them.

Every number below is **measured**, not estimated, against a real corpus of
**1,395 Items / 6,468 Citations / 4,986 Signals** fetched from 47 Sources across
RSS/Atom, the HN Firebase+Algolia pair, Bluesky `getAuthorFeed`, and GitHub
releases. The prototype that produced them is at
[`.scratch/zis/prototype/PROTOTYPE-clustering/`](../.scratch/zis/prototype/PROTOTYPE-clustering).

**This document is the canonical home for the cascade.** It previously lived only
in that prototype directory's `SPEC.md` — the one settled area of the product
whose spec sat in a directory named for disposability, while every other settled
area had a document here. #20 promoted it. The prototype's `SPEC.md` remains as
the record of that run; where the two disagree, **this document wins**.

---

## 0. The one distinction the whole model rests on

Three operations look alike in code and are different claims. Conflating any two
of them is where the prototype's real bugs came from.

| operation | claim | expires? | result |
|---|---|---|---|
| **Canonicalize** | "this is the address that defines the record" | no | one `Link` row; the other form never existed |
| **Alias** | "these two distinct Links are one event" | **no** | a merge edge between two `Signal`s |
| **Accrue** | "this new Citation belongs to that story" | **yes** | `Strength` rises; no merge at all |

The prototype originally gated alias merges on the temporal window. That refused
**160 of 399 merges** on one day's corpus. **An identity claim does not age**
(ADR-0004, which supersedes two clauses of ADR-0002).

---

## 1. What a merge rule is *for*

Settled by #20, and it inverts the premise this model was built under.

The premise inherited from the prior-art study was **quality defence**: memeorandum
is the unedited control for co-citation and it produces unmerged duplicates, so at
5–10 slots/day one duplicate is a 10–20% quality regression. Every candidate merge
rule was therefore judged by how often it prevents a wasted slot.

**That premise does not survive the admission rules.** Duplication is
**self-suppressing at admission**:

> A story split across two Links splits its citing Publishers. For the duplicate
> to occupy two Brief slots, *both* halves must independently clear Strength ≥2
> with an Interest match, or ≥3 without one — and splitting makes each half
> strictly *less* likely to clear. So the failure mode is not two slots for one
> story. It is **the story missing the Brief entirely because its votes were
> split**.

Measured: the two duplicate pairs #6 found on real data sit at Strength **1/0**
and **0/0**, against an admission floor of 2. Neither is within one distinct
Publisher of rendering at all, let alone twice. Corpus max Strength ever observed
is **4**, so the only shape that could cost two slots is the single biggest story
in the corpus splitting exactly 2-and-2 with an Interest match on both halves. It
has never happened.

**Therefore a merge rule is judged on the supply ledger, not the quality ledger.**
It earns its place by *recovering split votes* — turning a 2-and-1 back into a 3
and putting an entry on a day that would otherwise be blank — not by preventing
duplicates. This is the ledger
[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21)
showed is the scarce one: **18 of the last 30 days carry no eligible Signal at
all**, and the trailing-14-day median Brief size is **1** — *with the relevance bar
switched off entirely*. (This line used to read that median "against
`ranking-model.md` §9's ≥5 target". **There is no target**:
[ADR-0016](adr/0016-brief-density-is-an-observation-not-a-target.md) retired it,
and `source-register.md` §8.1 adds that the 18-of-30 figure is partly measuring
publisher-side feed retention rather than supply. Neither correction touches the
argument here — a merge rule still earns its place by recovering split votes — but
do not re-quote either number as a current value.)

Two consequences for anyone proposing a cascade layer:

- **The question is "how much supply does this buy, per unit of cost", not "how
  often does this hurt us".** A rule whose merges join two Signals that neither
  could ever render buys nothing, however cheap it is.
- **Quality defence is answered, not deferred.** Do not re-derive it from the
  memeorandum comparison; the comparison is sound and the admission rules make it
  inapplicable.

---

## 2. Canonicalization cascade

Five layers, applied in order. L1–L3 are pure and idempotent, and **re-run after
every network hop** in L4, because nested shorteners are real. 28/28 executable
cases in the prototype's `cases.mjs` pass.

### L1 — syntactic

- `http:` → `https:`. Any other scheme (`mailto:`, `javascript:`, `feed:`) is
  **not a Link** and is dropped.
- Host lowercased, trailing dot removed, default port removed, userinfo removed.
- Strip leading `www.`, `www2.`, `m.`, `mobile.`, `amp.`.
- Collapse `//` runs in the path; drop `index.html|htm|php`; drop the trailing
  slash except on the root path.
- **Fragment dropped**, except a hashbang (`#!`), which is routing state.

### L2 — query params: DENYLIST, with per-host allowlist overrides

**Denylist, not allowlist.** Stripping an unknown param can change what the URL
points at, and that failure is silent and unrecoverable; keeping a junk param
produces a visible thin duplicate instead. The denylist covers `utm_*`, `ref`,
`fbclid`, `gclid`, `msclkid`, `mc_cid`, `mkt_tok`, `igshid`, `guce_referrer*`,
`sc_*`, `__s`, `cmp`, `spm`, and ~30 more.

**`?page=2` is KEPT.** So are `sort`, `q`, `p`, `offset`, `cursor`, `tab`, `lang`,
`version` — anything that can change the rendered document.

**Per-host overrides are allowlists, and they must be keyed by PATH SHAPE, not by
host.** This is the sharpest lesson in the cascade, and it cost a Strength-3
phantom Signal to learn:

```
youtube.com  /watch     -> allow ['v']
youtube.com  /playlist  -> allow ['list']
```

A flat per-host `['v']` collapsed *every playlist in the corpus* into one Link
`youtube.com/playlist`, which then accumulated citations from three Publishers and
presented as a real cluster. A flat `['v','list']` has the opposite bug — one video
splits into as many Links as playlists embed it. **Any host whose identity lives in
a param needs every identifying param enumerated per path shape.**

Remaining params are **sorted**, so two orderings are one Link and 304s actually
fire (required by
[Verify source API limits against official docs](https://github.com/SaKaNa-Y/Zis/issues/2)'s
byte-identical-query-params finding).

### L3 — shape aliases (resolved into ONE Link, not a merge)

- `youtu.be/<id>`, `youtube.com/{shorts,embed,live,v}/<id>` → `youtube.com/watch?v=<id>`
- AMP: `amp.` host, `/amp` suffix, `/amp/` prefix, `?amp=1`
- `github.com`: owner/repo lowercased, `.git` stripped, `/tree/<branch>` → repo
  root, `/releases/latest` → `/releases` (`latest` is not a stable address)
- Bilibili, which still arrives as an outbound Citation even though it is not a
  Source ([Decide whether Bilibili is a source](https://github.com/SaKaNa-Y/Zis/issues/16)):
  the `av` ↔ `BV` alias, the `spm_id_from` param, and `/video → []` in the
  path-shape allowlist.

### L4 — redirect / shortener unwrap

- **Only for known shortener hosts** (37 listed). Never speculatively for
  arbitrary URLs — that would be a fetch per Link.
- **Bounded at 3 hops**, with L1–L3 re-run after each hop.
- **Every hop is re-validated** by
  [`security-model.md`](./security-model.md)'s SSRF validator, not just the URL
  the feed handed us. A `t.co` that 302s to `169.254.169.254` is a one-hop SSRF.
  Redirect loops and 3-hop exhaustion both stop cleanly and keep the last valid
  URL.
- Measured: 6 shortener Links, 6 hops, 0 hit the wall, 0 SSRF rejections.

### L5 — publisher-declared canonical

Prefer what the publisher declares over local normalization.

- **Check the HTTP `Link: <…>; rel="canonical"` header FIRST**, then the
  `<link rel=canonical>` tag. Measured: **20 rewrites via tag, 0 via header** —
  header-form publishers exist but are rare, so this ordering costs nothing and the
  parser must handle both.
- **Reject cross-site canonicals.** A cross-domain `rel=canonical` is a syndication
  claim (Medium mirrors, dev.to crossposts); following it collapses two Publishers'
  rows into one and destroys provenance. Measured: **7 rejected** — this guard
  fires on real data.
- **Gated at ≥2 Citations per Link.** #20 settled that **this gate stays**, and
  restated what it is: a **fetch budget**, not a quality filter. See §6.
- **`rel=canonical` is publisher-mutable**, so L5 is the one cascade layer whose
  replay can change when nothing in Zis changed. At ≥2 Citations that exposure is
  ~120 fetches/run and accepted. It is a reason not to grow the layer, recorded
  here because cost alone is the kind of objection a faster runner appears to
  answer, and this one it does not.

### The two operations canonicalization must NOT do

- **Never delete a duplicate.** A superseded raw address remains as a Citation row
  (`raw_url`), because the provenance rows *are* the why-this-surfaced explanation.
  The clustering table and the explainability feature are the same table.
- **Never bridge two different addresses.** That is an alias (§4), and it belongs
  at the Signal layer where it can be audited and undone.

---

## 3. Citation-worthiness — a reference is not a citation

The largest false-positive class found, and neither the prior-art cascade nor #6's
plan had a slot for it. Two filters, both applied to `outbound` Citations **before
Strength is counted**:

1. **Reference-only URLs.** MDN, W3C/WHATWG/IETF specs, caniuse, Wikipedia, npm
   package pages, Stack Overflow questions, bug trackers,
   `github.com/*/{pull,issues,commit,compare,blob,discussions}`, and
   `*/docs|api|reference|guide/*` paths. **arXiv is deliberately excluded from this
   list** — in the AI slice a paper genuinely *is* the story. So is
   `releases/tag/…`, which §5 depends on.
2. **Intra-publisher outbound links.** A Publisher linking a host it owns is
   internal navigation, not a citation of someone else's story. Release notes and
   changelogs are almost entirely this.

Measured: **1,525 + 2,312 = 3,837 Citations dropped, 33% fewer Links**, and the
only two multi-publisher Signals destroyed were both false:

```
s=3  nodejs.org/api/packages.html                   (typescript, svelte, juliaevans)
s=2  developer.mozilla.org/…/Document_Object_Model  (typescript, cloudflare)
```

Three unrelated posts linking the Node docs in passing is not three voices saying
"this is today's story". **2 false clusters removed, 0 true clusters lost.**

---

## 4. Cluster formation

### Signals are created eagerly, 1:1 with Links (ADR-0002)

The clusterer never creates a Signal. **Size-1 is normal by construction**, not by
discipline. Merges leave tombstones (a parent chain) that every read path resolves.

### The merge window is a non-question

The answer to "do citations 3 days apart cluster? rolling window or daily batch?"
is **neither, because co-citation does not merge anything.** A second Publisher
citing an existing Link raises that Signal's Strength; no merge occurs, so there is
nothing for a window to gate.

Measured after separating alias from accrual: at **12h, 24h, 48h, 72h and 168h the
corpus is byte-identical** — 0 merges refused. Every merge on real data is an alias
merge. **Therefore temporal decay lives entirely in ranking, not in the clusterer**
(ADR-0004), and its scope there is narrower still — see
[`ranking-model.md`](./ranking-model.md).

### Alias merge rules (deterministic, never time-gated)

| rule | claim | measured yield |
|---|---|---|
| `hn-thread->target` | an HN thread is a *discussion of* a URL | 229 |
| `hn-item-cited-by-other` | someone else citing `news.ycombinator.com/item?id=N` means the story, not the thread | (within the 229) |
| `hn-comment->story-target` | a cited HN **comment** permalink means the story it sits under | **added by #20** — see §5 |
| `vehicle-post->sole-target` | a post existing to link one article is not its own story | **149** (170 before #39 corrected the guard) |
| `announcement->cited-release-tag` | an announcement Item citing a `releases/tag/…` URL declares them one event | **15** (0 before the rule was reversed) |
| github owner rename | `facebook/react` → `react/react` | 0 on this corpus; keep it, one cached API call per repo |

**`vehicle-post->sole-target` generalizes the HN rule** and is the highest-yield
rule after HN itself. A Bluesky post carrying exactly one external link is the same
shape as an HN submission; leaving its own address as a Signal means every such
post competes for a Brief slot against the article it points at. The **"exactly
one" guard is load-bearing**: a post citing three URLs is a roundup and genuinely
is its own Item.

**The guard counts this Item's surviving outbound _Citations_, never its raw
outbound links** — corrected by
[Extend vehicle folding to RSS link-blog feeds](https://github.com/SaKaNa-Y/Zis/issues/39).
As first written it read the raw hrefs, so a link dropped by §3's
citation-worthiness — intra-publisher navigation, a reference-only URL — still
counted as the sole target whenever *some other* Publisher had created that Link.
**21 of the 170 folds were leak-driven**, and one of them manufactured a false
Strength-2 Signal (§4's own-vote case, below). A drop that still steers a merge is
the filter being overruled by the rule downstream of it. Corrected yield **149**,
and it moves `s≥2` by **zero** — the rule's value is the ~150 singleton Signals it
takes out of the pool, the same shape as §9's reading of the whole cascade.

**Vehicle folding covers `hn` and `bluesky`, and that is now a decision rather
than a gap.** Extending it to RSS link-blog feeds is **refused, full stop** (#39,
measured over #6's corpus): adding `rss` fires **63 folds and recovers zero
votes** — `s≥2` 27→27, `s≥3` 5→5 — while the single admission change it produces
is a **false merge**, Vercel's essay *"Everything hackable will get hacked"* folded
into a YouTube video it embeds, carrying TLDR's vote for the essay onto the video
and taking the negative-control false-positive count from 3 to 4. Judged on §1's
supply ledger the rule earns nothing and costs a control. Four things are settled
with it, so they are not re-derived:

- **#6's third true miss is real and worth zero votes.** The extension does join
  Willison's link-blog entry to HN thread `item?id=49220609` — at Strength **3
  before and 3 after**. §1 again: a split vote is self-suppressing, and this split
  had nothing to recover.
- **The `targets.length !== 1` guard needs no RSS variant.** #39 expected a
  link-blog to cite the article *plus* its HN thread, defeating the guard. Counting
  distinct *Signals* instead of distinct Links unlocks **0** additional folds
  corpus-wide: only **11 of 845** RSS items cite an HN thread at all, and of the 49
  citing exactly two surviving targets, **0** are already one Signal. The shape
  never reaches the guard.
- **A body-length test cannot separate a link post from a story.** True link posts
  run 102–2,135 plain-text chars; Ars Technica's news teasers run 780–1,182 and
  LWN's 519–599. The bands overlap almost entirely, and at ≤1,000 chars 19 folds
  fire of which the Ars, LWN and Vercel-changelog ones are all false.
- **A per-Publisher `is_vehicle` flag is refused too.** Of the 63 folds only ~11
  are link-post-shaped and **all 11 are one Publisher**; they still recover zero
  votes, and two of them fold into `github.com/simonw/…` release tags, letting that
  Publisher vote on its own release. The other ~52 are stories folded into an
  incidental citation — WebKit's Safari Technology Preview release notes into
  `developer.apple.com/safari/resources`, a footer link, five times over.

### Strength

`COUNT(DISTINCT publisher_id)` over the Signal's Citations, with the
**self-citation guard**: a Citation whose Link's host is owned by the citing
Publisher is *origin provenance*, not a vote. Burst suppression is then structural
— five posts from one voice is one vote, and a vendor's GitHub release + YouTube
video + Bluesky post is one vote, because all three hang off one `Publisher`.

**`host → publisher_id` must be UNIQUE, enforced at the schema level.** Two
Publishers sharing a host silently disables the self-citation guard. `github` and
`ghchangelog` were both modelled as owning `github.blog`; the host→Publisher map is
a Map, the second registration won, and **GitHub appeared as an independent voter on
its own changelog**. That is the vendor-manufactures-its-own-cluster failure arriving
through a data-modelling slip rather than a rule.

**The guard is keyed on a host registry, so it misses hosts a Publisher owns in
fact but is not registered as owning — and a vehicle fold is the shape that
weaponizes the gap.** Found by #39 while auditing the guard-leak folds above, on
two live cases. Willison's Bluesky post citing his own article: `bsky.app` is not
one of that Publisher's `hosts`, so his citation of his *own* vehicle post reads as
a vote, and folding the vehicle into his article lands that vote on his own story —
Strength 2 from one voice plus TLDR. And Cloudflare's blog post folded into its own
investor-relations release on `cloudflare.net`, an unregistered second host,
producing Strength 2 with Cloudflare as both `origin` and a voter. The
Citations-not-hrefs correction above removes both instances, which is the strongest
argument for it. **Whether the registry itself is the wrong shape is
[Decide what the self-citation guard keys on when a Publisher's hosts are
unregistered](https://github.com/SaKaNa-Y/Zis/issues/44)**, not settled here — the
two cases measured are narrower than the class.

**Two counts must be reported**, because the prior-art targets include the origin
("Cited by: react.dev (origin) · React Status · …") while `Strength` excludes it.
Every Strength figure is systematically one lower than those targets. The why-text
shows origin-excluded Strength with the origin labelled separately.

---

## 5. The two duplicate classes deterministic rules could not reach

#6 found two classes it could not catch and routed them to #20. #20 measured both
and **neither was what it was described as.**

### Class 1 — one Publisher, two slugs: **no rule. This is what the user merge is for.**

The case: `thenewstack.io/cpus-matter-ai-agents` and
`thenewstack.io/why-cpus-still-matter-in-the-age-of-ai-agents` are one article at
two addresses, at Strength **0/0**.

Three candidate fixes, all refused:

- **Ungate L5** (fetch the publisher-declared canonical for every Link, not just
  those with ≥2 Citations). Refused on cost *and* on yield. Cost: ~5,400 page
  fetches per run instead of ~120, against arbitrary open-web hosts rather than
  curated Sources, each of which needs its own `robots.txt` fetched and parsed
  **first** — so closer to ~10,000 requests hourly. Under ADR-0008 run duration is
  itself a compute variable, and
  [`repo-and-ci.md`](./repo-and-ci.md) found the pipeline's ≤2-minute run budget is
  a **billing cliff one second wide** on Actions minutes. Yield: the ablation table
  shows removing L5 entirely moves Signals at Strength ≥2 and ≥3 by **zero**, and
  ungating can only reach Links with <2 Citations — structurally the ones that
  cannot be admitted. **~10,000 requests an hour to merge two Signals that neither
  could ever render.**
- **Same-host + byte-identical-title alias** (free, no fetch — Zis already has both
  titles from the feeds). Clean on this corpus: `webkit.org`'s Safari Technology
  Preview **247/248/249/250** don't fire because their titles differ by a version
  number, the DeepMind pair doesn't fire for the same reason, and the 51 `bsky.app`
  pairs that *would* misfire — Adactio posting `Wednesday afternoon session in
  Belfast` on many different Wednesdays — are all on a vehicle transport that
  folding already handles. **Zero false positives, one true positive, and the true
  positive is worth zero.** Refused on #6's own precedent that a rule earns its
  place by measurement: one pair at 0/0 is an anecdote. It is also a
  content-similarity rule, the family §7 cut, keyed on a **publisher-mutable**
  title.
- **A same-target HN detector**, which was class 2 as stated. See below.

**Settled: class 1 is the residue
[Decide the brief's boundary and refinement layer](https://github.com/SaKaNa-Y/Zis/issues/14)'s
one-click user merge exists to absorb.** The reader sees two entries, clicks once,
and it costs the system nothing to have been wrong. Recording this as a decision
matters because "just ungate L5" is the obvious proposal and its cost is invisible
from the rule's description.

### Class 2 — the HN duplicate that was never a duplicate: **a comment-permalink alias**

Class 2 was recorded as "the same story submitted to HN twice", ids `49268580` and
`49317864`. **It is not.** The cached Algolia record for the second id reads:

```json
{ "id": 49317864, "type": "comment", "story_id": 49268580,
  "title": null, "url": null, "parent_id": 49316056 }
```

It is a **comment inside** story `49268580` — someone asking whether the Asus Bike
Booster works on mountain bikes. #6's detector was a token-Jaccard proxy over
titles, the comment had inherited the story's title, and two rows both reading
`Asus Bike Booster` looked like two submissions. **There is no HN
double-submission anywhere in the corpus**, and a same-target detector would have
been a rule for a category with no members.

The real gap is in an existing rule. `hn-item-cited-by-other` handles someone else
citing `news.ycombinator.com/item?id=N` by asking Algolia for that item and folding
the Link into its `url`. For a comment, `url` is `null`, so the rule gives up and
the comment permalink **stays its own Signal** — and the citing Publisher's vote,
which was a vote for the story, is discarded.

**Settled: add `hn-comment->story-target`.** Three cases to tell apart, not two:

| Algolia `type` | `url` | action |
|---|---|---|
| `story` | present | fold the Link into that target (existing behaviour) |
| `comment` | `null` | **follow `story_id`, resolve that story's target, fold into it** |
| `story` | `null` | **leave alone** — an Ask HN / Show HN thread genuinely *is* the thing |

Measured on the 18 cited `item?id=N` Links in the corpus: **2 are comments**
(`49317864 → 49268580` and `49190321 → 49185430`), and **5 are Ask/Show HN with no
`url`**, which the third row correctly leaves alone.

Why this one earns its place where class 1's did not:

- **It is free.** The Algolia fetch already happens on exactly this path. The
  marginal cost is a branch, not an egress class, not a host, not a `robots.txt`
  surface.
- **It is supply-side** (§1). The fold moves the citing Publisher's Citation onto
  the story's target Link, so that target's Strength rises. Excluding comment
  permalinks via citation-worthiness instead would have been cheaper still and is
  **wrong on this ledger**: it *discards* the vote where the alias *preserves* it.
- **It is a true alias, replayable with no clock** (ADR-0004). A comment
  permanently belongs to its story; `story_id` is immutable. Unlike L5, nothing a
  publisher edits later can change the replay.
- **It rides this model's own stated reasoning.** §4 says leaving a vehicle's own
  Link as a Signal means it "competes for a Brief slot against the article it is
  pointing at". An HN comment permalink is precisely that shape.

**No ADR for either half**, on the precedent of
[Decide the image and thumbnail policy](https://github.com/SaKaNa-Y/Zis/issues/17),
#21 and
[Decide whether Zis ships in both Chinese and English](https://github.com/SaKaNa-Y/Zis/issues/24):
a merge rule is code and a refusal is a paragraph, sealing means no past Brief ever
changes so nothing is expensive to reverse, and no test is retired by adopting
either. §1's self-suppression finding is the durable part, and it is stated here.

---

## 6. Where #6's plan was wrong

Kept because each of these is a proposal that will otherwise return.

- **The release↔announcement bridge pointed the wrong way — 0 matches on real
  data.** The plan proposed *does a release exist* as the discriminator, reading the
  GitHub release body for a declared announcement URL. Real release notes do not
  link the blog post; **the blog post links the release.** Reversed, the
  discriminator is "an announcement Item cites exactly one `releases/tag/…` URL" —
  still publisher-declared rather than inferred from co-occurrence, and it gives the
  framework-release and trending-breakout cases the opposite answers they needed,
  because a repo-root citation never bridges. This required lifting `releases/tag/…`
  out of §3's reference-only list, which had severed the only edge the rule can
  travel on. **Measured after the reversal: 15 bridges, up from 0.**
- **Temporal decay was placed in detection.** It belongs in ranking (ADR-0004).
  Stale clusters absorbing new arrivals is not a failure; it is how a growing story
  works.
- **`rel=canonical`'s ≥2-Citation gate was read as a quality filter.** It is a fetch
  budget. #20 settled that it stays, and §5 records what ungating costs.

---

## 7. Embeddings are cut from v1 detection

Measured with a deterministic token-Jaccard over titles as a *proxy* — an upper
bound on same-story pairs sharing no URL, not a stand-in for `bge-small` quality.
**278 candidate pairs at Jaccard ≥0.45, out of 404,550.**

**True misses (3):** the two-slug `thenewstack.io` article (§5, class 1), the HN
comment permalink (§5, class 2 — recorded at the time as a duplicate submission,
which #20 disproved), and a link-blog entry sitting apart from the HN thread on the
same story — **answered by
[Extend vehicle folding to RSS link-blog feeds](https://github.com/SaKaNa-Y/Zis/issues/39):
the third miss is real, joinable, and worth zero votes** (Strength 3 before the join
and 3 after), so **all three true misses are now known to cost nothing at
Admission**. That is the strongest form of §1 — a second pass that caught every one
of them would move the Brief by zero entries while making the false merges above.

**False merges a similarity pass would make (many):**

```
0.75  "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber"
   vs "Introducing Gemini 3.5 Flash Cyber"                    <- different releases
0.80  "Wednesday afternoon session in Belfast"  x N            <- adactio's daily notes
0.70  "Sunday afternoon session in Belfast" vs "Sunday session in Belfast"
```

At any threshold low enough to catch the three true misses, the pass also merges
distinct model releases and one writer's daily notes. **Precision is worse than
1:2.** Three further arguments:

- **3,607 of 4,986 Signals have no ingested Item at all** — the C6 shape is the
  *common* case, so an embedding pass is blind to three quarters of the corpus by
  construction.
- A similarity threshold cannot be tuned without a labelled dataset, and there
  isn't one. #14 makes detection reproducibility a **correctness** property, so a
  threshold that drifts with a model version is a correctness risk.
- The negative controls produced **zero** topic-similarity false merges under the
  deterministic spine. Adding embeddings to detection is the one change that could
  break that.

This voids the embeddings half of
[Choose AI providers for generation and embeddings](https://github.com/SaKaNa-Y/Zis/issues/3)
**for detection only**. ADR-0003 still needs `bge-small` for matching Signals to
Interests.

---

## 8. Results against the acceptance criteria

### The four memeorandum failure modes

1. **Unmerged duplicates.** Deterministic rules catch the structural cases (HN
   thread/target, HN comment permalinks, vehicle posts, AMP, shortener,
   `rel=canonical`, owner rename). What remains — one Publisher using two slugs —
   is **#14's one-click user merge by decision, not by omission** (§5).
2. **Stale items at the top.** The ranking decay multiplier, correctly located
   outside detection (§4).
3. **Thin clusters from correlated bursts.** Structural, via distinct-`Publisher`
   Strength (§4). Verified the hard way by the `github.blog` registry bug.
4. **Headline spin.** The naming pass's job, and harder than it looks: **3,607 of
   4,986 Signals have no title of their own**, so the naming pass mostly has only
   the citing Items' framing to work from.

### C1–C10 and the negative controls

| | verdict |
|---|---|
| **C6 (adversarial) — Anthropic** | **PASSES the design test.** `anthropic.com/research/riemann-zeta` formed at Strength 3 with **zero origin citations** — Anthropic publishes no feed and was never ingested. Detection keys on the *cited* URL, exactly as ADR-0001 requires. This is the one that had to work. |
| C1–C5, C7, C9, C10 | present but **THIN** — 0–3 voters against targets of 4–9 |
| C8 (Postgres) | **ABSENT** — no Postgres Source in the feed list at all |
| Negative controls | AWS **0**, Vercel **0**, Hugging Face **3** — and on inspection all three HF hits are legitimate co-citations (a DeepSeek model release cited by Simon Willison + Interconnects), so the control's premise was wrong for those items, not the algorithm. **No topic-similarity false merges.** |

**This yield is accepted, and the gap between "present" and "at target" is corpus
depth, not algorithm.** Cooper Press feeds retain 4 issues, `react.dev` has 23 items
ever, and feed windows span one day to several years. Issue-page hydration recovered
820 links and JavaScript Weekly appears as a voter in 5 of the top clusters — a
**prerequisite, not an enhancement**. The source-list gaps belong to
[Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11).

**One figure here is a backfill yield and must not be read as a daily rate.** "27
Signals at Strength ≥2 and 5 at ≥3" comes from feed windows spanning up to 2,064
days. Replayed per-day from Citation timestamps, #21 found **18 of the last 30 days
carry no eligible Signal at all**. Any per-day claim quoting 27 is wrong, and §1
depends on the corrected reading.

---

## 9. The ablation table

Each row removes one layer and re-runs. `s≥2` / `s≥3` are the counts that matter,
because they are what Admission can reach.

| configuration | links | signals | s≥2 | s≥3 |
|---|---|---|---|---|
| all layers | 5,400 | 4,986 | **27** | **5** |
| no shortener unwrap | 5,394 | 4,980 | 27 | 5 |
| no HN discussion alias | 5,362 | 5,177 | 26 | 5 |
| no `rel=canonical` | 5,382 | 4,968 | **27** | **5** |
| no github rename | 5,400 | 4,986 | 27 | 5 |
| no release bridge | 5,400 | 5,001 | 27 | 5 |
| no reference filter | 6,387 | 5,969 | 29 | 6 |
| no intra-publisher filter | 6,860 | 6,349 | 27 | 5 |
| no citation-worthiness at all | 7,969 | 7,458 | 29 | 6 |
| no vehicle folding | 5,400 | 5,156 | 26 | 5 |
| pure syntactic only | 5,338 | 5,338 | 25 | 4 |

Rows added by #39. The first is the shipped configuration **after** §4's
Citations-not-hrefs correction and is the one to compare against; the rest are the
refused RSS variants, kept so the extension is not re-proposed.

| configuration | links | signals | s≥2 | s≥3 |
|---|---|---|---|---|
| all layers, corrected guard | 5,400 | 5,007 | **26** | **5** |
| + `rss`, raw hrefs | 5,400 | 4,925 | 27 | 5 |
| + `rss`, corrected guard | 5,400 | 4,943 | 27 | 5 |
| + `rss`, corrected guard, body ≤400 chars | 5,400 | 5,006 | 26 | 5 |

**The 27 in the two `+ rss` rows is not a gain**, which is why a `s≥2` column alone
misreads them: comparing the *multiset of admitted voter-sets* rather than the count,
the only change is `4|emollick,interconnects,simonwillison,vercel` →
`5|emollick,interconnects,simonwillison,tldr,vercel` — one false merge, and the extra
voter is TLDR's vote for a Vercel essay relocated onto an embedded video. The 27→26 on
the corrected guard is the removal of a false Signal, not a lost one. **A count is not
a ledger; check which Publishers moved.**

Two things to read off the first table before proposing a layer:

- **The whole cascade moves s≥2 from 25 to 27 and s≥3 from 4 to 5** — **26, not 27,
  once #39 corrected the vehicle guard**, since one of the two was the false Signal
  that correction removes. Its value is in the ~350 junk Links it removes from the
  pool, not in admitted Signals.
- **`no rel=canonical` costs nothing measurable.** That is the yield half of §5's
  refusal, and it is why growing L5 is the wrong place to spend a fetch budget.
