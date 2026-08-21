# PROTOTYPE-vehicle-rss — Zis issue #39

Throwaway. Answers: should `vehicle-post->sole-target` extend to RSS link-blog
feeds, and does the `targets.length !== 1` guard survive contact with RSS?

Rides [`PROTOTYPE-clustering`](../PROTOTYPE-clustering/)'s corpus and its on-disk
`cache/` — **no new network traffic**. `node measure.mjs` writes `findings.txt` and
`findings.json`.

The canonical home for the answer is
[`docs/clustering-model.md`](../../../../docs/clustering-model.md) §4. Where this
file and the doc disagree, the doc wins.

## What was changed in `PROTOTYPE-clustering` to make the rule measurable

All three are additive, and the defaults reproduce #6 byte-for-byte.

- `ingest.mjs` — RSS Items carry `bodyChars`, the plain-text length of the feed
  body, so a "this Item is a vehicle, not a story" test can be measured.
- `cluster.mjs` — `vehicleTransports`, `vehicleGuard` (`'links' | 'signals'`),
  `vehicleMaxBodyChars`, `vehicleFromCitations`; and `buildCorpus` returns
  `vehicleMergeDetail`, every fold with its Item, body length, targets and root,
  for hand-classification.

## The answer

**Refused, full stop.** RSS does not enter `VEHICLE_TRANSPORTS`.

| variant | signals | s≥2 | s≥3 | folds | of which RSS |
|---|---|---|---|---|---|
| A baseline (#6 as shipped) | 4,986 | 27 | 5 | 170 | 0 |
| B guard=signals, hn+bsky | 4,986 | 27 | 5 | 170 | 0 |
| C +rss, guard=links | 4,925 | 27 | 5 | 233 | 63 |
| D +rss, guard=signals | 4,925 | 27 | 5 | 233 | 63 |
| E +rss, body ≤400 | 4,985 | 27 | 5 | 172 | 2 |
| F +rss, body ≤1000 | 4,969 | 27 | 5 | 189 | 19 |
| **H hn+bsky, from-citations** | **5,007** | **26** | **5** | **149** | **0** |
| I +rss, from-citations | 4,943 | 27 | 5 | 217 | 68 |
| J +rss, from-citations, ≤400 | 5,006 | 26 | 5 | 153 | 4 |

**H is the shipped configuration after the correction below.** Every other row is
refused.

### 1. Zero votes recovered, one false merge

`s≥2` 27→27 and `s≥3` 5→5 across every RSS variant. A count is not a ledger, so the
comparison that matters is the **multiset of admitted voter-sets**, which changes in
exactly one place:

```
- 4 | emollick, interconnects, simonwillison, vercel
+ 5 | emollick, interconnects, simonwillison, tldr, vercel
```

The Signal is `youtube.com/watch?v=87DyyMV0kCY`. The new voter is **TLDR, voting for
Vercel's essay** *"Everything hackable will get hacked"* (7,765 chars), relocated onto
a video the essay embeds. The merged Signal carries `origin=vercel` **and** `vercel`
among its voters. Negative-control false positives 3 → 4.

### 2. #6's third true miss is real and worth zero votes

The naive extension does join Willison's link-blog entry to HN thread
`item?id=49220609` — Strength **3 before, 3 after**, because `simonwillison` was
already a voter there. #20 §1 exactly: a split vote is self-suppressing.

### 3. The guard question dissolves

Counting distinct **Signals** instead of distinct Links unlocks **0** additional
folds. #39 predicted a link-blog cites the article *plus* its HN thread; measured,
**11 of 845** RSS items cite an HN thread at all, and of the **49** citing exactly two
surviving targets, **0** are already one Signal. Surviving-target distribution:
495 items at 0, 68 at 1, 49 at 2, and a long tail to 146.

### 4. Length does not separate a link post from a story

| population | plain-text body chars |
|---|---|
| Willison link posts (the only true link-blog in the corpus) | 102 – 2,135 |
| Ars Technica news teasers | 780 – 1,182 |
| LWN briefs | 519 – 599 |
| Vercel changelog entries | 487 – 1,691 |

At ≤1,000 chars, 19 folds fire and the Ars, LWN and Vercel ones are all false.

### 5. A per-Publisher `is_vehicle` flag is refused too

Of the 63 folds, ~11 are link-post-shaped and **all 11 are one Publisher**. They
recover zero votes, and two fold into `github.com/simonw/…` release tags — that
Publisher voting on its own release. The other ~52 are stories folded into an
incidental citation:

```
webkit      Safari Technology Preview 246–250  ->  developer.apple.com/safari/resources   (x5, a footer link)
arstechnica Ukraine strikes rocket factory     ->  x.com/ZelenskyyUa/status/…
juliaevans  How to add a directory to your PATH -> blog.flowblok.id.au/…/shell-startup-scripts
cloudflare  Secure all your internal vibe-coded… -> github.com/cloudflare/templates/…
```

## The defect this exposed in the shipped rule

**The guard read raw `outbound` hrefs, not surviving Citations.** A link dropped by
citation-worthiness — intra-publisher navigation, reference-only — still counted as
the sole target whenever *some other* Publisher had created that Link. **21 of the 170
shipped `hn`+`bluesky` folds are leak-driven** (10 of the 63 RSS ones), and one
manufactures a false Strength-2 Signal:

```
A  bsky.app/profile/simonwillison.net/post/3mr5ucqec2s24   strength=2  voters=simonwillison,tldr
     member  bsky.app/profile/simonwillison.net/post/3mr5ucqec2s24
     member  simonwillison.net/2026/Jul/21/cat-and-thariq
H  same probe                                              strength=1  voters=simonwillison
```

Corrected: 149 folds, and vehicle folding now moves `s≥2` by **zero** (26 with and
without the false Signal it used to buy). Written into §4.

## Handed on

The two leak-driven own-votes are instances of a wider gap — the self-citation guard
is keyed on a **host registry**, and `bsky.app` (a transport host) and
`cloudflare.net` (an unregistered second host) are both outside it. That is
[#44](https://github.com/SaKaNa-Y/Zis/issues/44), not settled here.
