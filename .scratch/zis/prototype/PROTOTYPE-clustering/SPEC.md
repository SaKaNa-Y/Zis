# Clustering spec — canonicalization rules and cluster-formation conditions

Drafted from the prototype in this directory, run against a real corpus of
**1,395 Items / 6,404 Citations / 4,937 Signals** fetched from 47 Sources across
RSS/Atom, the HN Firebase+Algolia pair, Bluesky `getAuthorFeed`, and GitHub
releases. Every number below is measured, not estimated. Ticket:
[Specify the clustering algorithm](https://github.com/SaKaNa-Y/Zis/issues/6).

---

## 0. The one distinction the whole spec rests on

Three operations look alike in code and are different claims. Conflating any two
of them is where the prototype's real bugs came from.

| operation | claim | expires? | result |
|---|---|---|---|
| **Canonicalize** | "this is the address that defines the record" | no | one `Link` row; the other form never existed |
| **Alias** | "these two distinct Links are one event" | **no** | a merge edge between two `Signal`s |
| **Accrue** | "this new Citation belongs to that story" | **yes** | `Strength` rises; no merge at all |

The prototype originally gated alias merges on the temporal window. That refused
**160 of 399 merges** on one day's corpus. An identity claim does not age.

---

## 1. Canonicalization cascade

Five layers, applied in order. L1–L3 are pure and idempotent; **L1–L3 re-run
after every network hop** in L4, because nested shorteners are real. 28/28
executable cases in `cases.mjs` pass.

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
produces a visible thin duplicate instead. Denylist covers `utm_*`, `ref`,
`fbclid`, `gclid`, `msclkid`, `mc_cid`, `mkt_tok`, `igshid`, `guce_referrer*`,
`sc_*`, `__s`, `cmp`, `spm`, and ~30 more.

**`?page=2` is KEPT.** So are `sort`, `q`, `p`, `offset`, `cursor`, `tab`,
`lang`, `version` — anything that can change the rendered document.

**Per-host overrides are allowlists, and they must be keyed by PATH SHAPE, not
by host.** This is the sharpest lesson in the whole cascade, and it cost a
strength-3 phantom Signal to learn:

```
youtube.com  /watch     -> allow ['v']
youtube.com  /playlist  -> allow ['list']
```

A flat per-host `['v']` collapsed *every playlist in the corpus* into one Link
`youtube.com/playlist`, which then accumulated citations from three publishers
and presented as a real cluster. A flat `['v','list']` has the opposite bug —
one video splits into as many Links as playlists embed it. Any host whose
identity lives in a param needs every identifying param enumerated **per path
shape**.

Remaining params are **sorted** — so two orderings are one Link, and so 304s
fire (required by [#2](https://github.com/SaKaNa-Y/Zis/issues/2)'s
byte-identical-query-params finding).

### L3 — shape aliases (resolved into ONE Link, not a merge)

- `youtu.be/<id>`, `youtube.com/{shorts,embed,live,v}/<id>` → `youtube.com/watch?v=<id>`
- AMP: `amp.` host, `/amp` suffix, `/amp/` prefix, `?amp=1`
- `github.com`: owner/repo lowercased, `.git` stripped, `/tree/<branch>` → repo
  root, `/releases/latest` → `/releases` (`latest` is not a stable address)

### L4 — redirect / shortener unwrap

- **Only for known shortener hosts** (37 listed). Never speculatively for
  arbitrary URLs — that would be a fetch per Link.
- **Bounded at 3 hops**, and `canonicalizeSync` re-runs after each hop.
- **Every hop is re-validated** by [#7](https://github.com/SaKaNa-Y/Zis/issues/7)'s
  SSRF validator, not just the URL the feed handed us. A `t.co` that 302s to
  `169.254.169.254` is a one-hop SSRF. Redirect loops and 3-hop exhaustion both
  stop cleanly and keep the last valid URL.
- Measured: 6 shortener Links in the corpus, 6 hops, 0 hit the wall.

### L5 — publisher-declared canonical

The cascade layer the ticket's plan skipped. Prefer what the publisher declares
over local normalization.

- **Check the HTTP `Link: <…>; rel="canonical"` header FIRST**, then the
  `<link rel=canonical>` tag. Measured: 20 rewrites via tag, 0 via header on this
  corpus — header-form publishers exist but are rare, so this ordering costs
  nothing and the parser must handle both.
- **Reject cross-site canonicals.** A cross-domain `rel=canonical` is a
  syndication claim (Medium mirrors, dev.to crossposts); following it collapses
  two publishers' rows into one and destroys provenance. Measured: **7 rejected**
  — this guard fires on real data.
- **Gated** at ≥2 citations per Link, capped at 120 fetches/run. Ungated this is
  one HTTP request per Link (5,274 of them).

### The two operations canonicalization must NOT do

- **Never delete a duplicate.** A superseded raw address remains as a Citation
  row (`raw_url`), because the provenance rows *are* the why-this-surfaced
  explanation.
- **Never bridge two different addresses.** That is an alias (§3), and it belongs
  at the Signal layer where it can be audited and undone.

---

## 2. Citation-worthiness — the layer that wasn't in the plan

**A reference is not a citation.** This was the largest false-positive class
found, and neither the map's cascade nor the ticket's plan had a slot for it.

Two filters, both applied to `outbound` Citations before Strength is counted:

1. **Reference-only URLs.** MDN, W3C/WHATWG/IETF specs, caniuse, Wikipedia, npm
   package pages, Stack Overflow questions, bug trackers, `github.com/*/{pull,
   issues,commit,compare,blob,discussions}`, and `*/docs|api|reference|guide/*`
   paths. **arXiv is deliberately excluded from this list** — in the AI slice a
   paper genuinely *is* the story.
2. **Intra-publisher outbound links.** A Publisher linking a host it owns is
   internal navigation, not a citation of someone else's story. Release notes and
   changelogs are almost entirely this.

Measured effect: **1,589 + 2,274 = 3,863 Citations dropped, 33% fewer Links**,
and the only two multi-publisher Signals destroyed were both false:

```
s=3  nodejs.org/api/packages.html                       (typescript, svelte, juliaevans)
s=2  developer.mozilla.org/…/Document_Object_Model      (typescript, cloudflare)
```

Three unrelated posts linking the Node docs in passing is not three voices
saying "this is today's story". **2 false positives removed, 0 true clusters
lost.**

---

## 3. Cluster formation

### Signals are created eagerly, 1:1 with Links (ADR-0002)

The clusterer never creates a Signal. Size-1 is normal by construction. Merges
leave tombstones (a parent chain) that every read path resolves.

### The merge window is a non-question

This is the answer to the ticket's "do citations 3 days apart cluster? rolling
window or daily batch?" — **neither, because co-citation does not merge
anything.** A second Publisher citing an existing Link raises that Signal's
Strength; no merge occurs, so there is nothing for a window to gate.

Measured, after separating alias from accrual: at **12h, 24h, 48h, 72h and 168h
the corpus is byte-identical** — 4,937 Signals, 27 at Strength ≥2, 5 at ≥3, 0
merges refused. Every merge on real data is an alias merge.

**Therefore temporal decay lives entirely in ranking, not in the clusterer.** A
`0.5 ^ (age_hours / 36)` multiplier on the ranking score, and nothing in
detection. This also removes the tension with
[#14](https://github.com/SaKaNa-Y/Zis/issues/14)'s ruling that a Signal which
grows on day 2 competes for day 2's Brief — under a closing window it could not.

### Alias merge rules (deterministic, never time-gated)

| rule | claim | measured yield |
|---|---|---|
| `hn-thread->target` | an HN thread is a *discussion of* a URL | 229 |
| `hn-item-cited-by-other` | someone else citing `news.ycombinator.com/item?id=N` means the story, not the thread | (in the 229) |
| `vehicle-post->sole-target` | a post existing to link one article is not its own story | **170** |
| `release<->declared-announcement` | a release and the announcement its body declares | **0 — see §5** |
| github owner rename | `facebook/react` → `react/react` | 0 on this corpus |

**`vehicle-post->sole-target` generalizes the HN rule** and is the highest-yield
rule after HN itself. A Bluesky post that carries exactly one external link is
the same shape as an HN submission; leaving its own address as a Signal means
every such post competes for a Brief slot against the article it points at. The
**"exactly one" guard is load-bearing**: a post citing three URLs is a roundup
and genuinely is its own Item.

### Strength

`COUNT(DISTINCT publisher_id)` over the Signal's Citations, with the
**self-citation guard**: a Citation whose Link's host is owned by the citing
Publisher is *origin provenance*, not a vote. Burst suppression is then
structural — five posts from one voice is one vote, and a vendor's GitHub release
+ YouTube video + Bluesky post is one vote, because all three hang off one
`Publisher`.

**Two counts must be reported, because the research doc and `CONTEXT.md`
disagree**: the C1–C10 target counts include the origin ("Cited by: react.dev
(origin) · React Status · …"); `Strength` excludes it. Every Strength figure is
systematically one lower than the research targets.

---

## 4. Results against the acceptance criteria

### The four memeorandum failure modes

1. **Unmerged duplicates.** Deterministic rules catch the structural cases (HN
   thread/target, vehicle posts, AMP, shortener, `rel=canonical`, owner rename).
   They **miss** two classes found on real data: one publisher using two slugs
   for one article (`thenewstack.io/cpus-matter-ai-agents` vs
   `…/why-cpus-still-matter-in-the-age-of-ai-agents`), and the same story
   submitted to HN twice (`Asus Bike Booster`, ids 49268580 and 49317864). The
   first is reachable by dropping L5's ≥2-citation gate; the second needs
   same-target detection across HN submissions. Whatever remains is the job of
   the one-click user merge from #14.
2. **Stale items at the top.** Answered by the ranking decay multiplier, now
   correctly located outside detection (§3).
3. **Thin clusters from correlated bursts.** Structural, via distinct-`Publisher`
   Strength — see §3. Verified by the `github` registry fix below.
4. **Headline spin.** Untouched here; it is the naming pass's job. Note **3,607
   of 4,937 Signals have no title of their own** — the naming pass mostly has
   only the citing Items' framing to work from, which makes the anti-spin
   requirement harder than it looks.

### C1–C10 and the negative controls

| | verdict |
|---|---|
| **C6 (adversarial) — Anthropic** | **PASSES the design test.** `anthropic.com/research/riemann-zeta` formed at Strength 3 with **zero origin citations** — Anthropic publishes no feed and was never ingested. Clustering keys on the *cited* URL, exactly as ADR-0001 requires. This was the one that had to work. |
| C1–C5, C7, C9, C10 | present but **THIN** — 0–3 voters against targets of 4–9 |
| C8 (Postgres) | **ABSENT** — no Postgres source in the 30-feed list at all |
| Negative controls | AWS **0**, Vercel **0**, Hugging Face **3** — and on inspection all three HF hits are legitimate co-citations (a DeepSeek model release cited by Simon Willison + Interconnects), so the control's premise was wrong for those items, not the algorithm. **No topic-similarity false merges. The deterministic spine did not detect anything it shouldn't.** |

**The gap between "present" and "at target" is corpus depth, not algorithm.** The
targets assume every 30 feeds retains a week of items and every newsletter's full
link list is available. In reality Cooper Press feeds retain **4 issues**,
`react.dev` has 23 items ever, and feed windows span from one day to several
years. Issue-page hydration recovered **820 links from 24 newsletter issues** and
JavaScript Weekly appears as a voter in 5 of the top clusters — confirming the
research doc's warning that this is a **prerequisite, not an enhancement**.

**27 Signals at Strength ≥2 and 5 at ≥3, from one day's corpus, is enough to
fill a 5–10 slot Brief.** The absolute-relevance-bar requirement from #14 is what
turns that into a Brief, not a top-N cut.

---

## 5. Where the plan was wrong

- **The release↔announcement bridge found nothing — 0 on real data.** The ticket
  framed this as the alias rule with "two cases that want opposite answers", and
  proposed *does a release exist* as the discriminator. Real GitHub release
  bodies do not link the announcement blog post; **the blog post links the
  release**. So the bridge is pointing the wrong way: the discriminator should be
  **"an announcement Item cites a `releases/tag/…` URL"**, not "a release body
  declares an announcement". Note this collides with §2, which classifies
  `releases/tag/…` as reference-only — that exclusion must be lifted for this
  rule to have anything to work with. **Unresolved; needs a decision.**
- **GitHub owner renames: 0 rewrites.** The rule is right (the platforms research
  documents three moved slugs), the corpus just contained no stale slug this
  week. Keep it; it costs one cached API call per repo.
- **A Publisher sharing a host with another Publisher silently disables the
  self-citation guard.** `github` and `ghchangelog` were modelled as two
  Publishers both owning `github.blog`; the host→Publisher map is a Map, the
  second registration won, and **GitHub appeared as an independent voter on its
  own changelog**. That is the vendor-manufactures-its-own-cluster failure
  arriving through a data-modelling slip rather than a rule. `CONTEXT.md` already
  forbids it — one owning voice, many Sources — so the fix is a **uniqueness
  constraint on host → publisher_id**, enforced at the schema level.

---

## 6. Part 3 — the embedding second pass

**Recommendation: cut embeddings from v1.**

Measured with a deterministic token-Jaccard over titles as a *proxy* — an upper
bound on same-story pairs sharing no URL, not a stand-in for `bge-small` quality.
**278 candidate pairs at Jaccard ≥0.45, out of 404,550 pairs.** Hand-classifying
the high-scoring ones:

**True misses (3):** the two-slug `thenewstack.io` article, the duplicate HN
submission, and Simon Willison's link-blog entry sitting apart from the HN thread
on the same story.

**False merges a similarity pass would make (many):**

```
0.75  "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber"
   vs "Introducing Gemini 3.5 Flash Cyber"                    <- different releases
0.80  "Wednesday afternoon session in Belfast"  x N            <- adactio's daily notes
0.70  "Sunday afternoon session in Belfast" vs "Sunday session in Belfast"
```

At any threshold low enough to catch the three true misses, the pass also merges
distinct model releases and a writer's daily notes. **Precision is worse than
1:2.** And every true miss has a cheaper deterministic fix: drop L5's
≥2-citation gate, extend vehicle-folding to link-blog feeds, detect duplicate HN
submissions on a shared target URL.

Three further arguments against:

- **3,607 of 4,937 Signals have no ingested Item at all** — the C6 shape is the
  *common* case. An embedding pass can only compare text it has, so it is blind
  to three quarters of the corpus by construction.
- A similarity threshold cannot be tuned without a labelled dataset, and there
  isn't one. #14 also makes detection reproducibility a correctness property, so
  a threshold that drifts with a model version is a correctness risk.
- The negative controls produced **zero** topic-similarity false merges under the
  deterministic spine. Adding embeddings to detection is the one change that
  could break that.

**This voids the embeddings half of
[Choose AI providers for generation and embeddings](https://github.com/SaKaNa-Y/Zis/issues/3)** for detection.
It does **not** void it for relevance: ADR-0003 makes the Interest Profile N
separately-embedded statements with `MAX` similarity, so `bge-small` is still
needed — for matching Signals to Interests, never for detecting Signals.
