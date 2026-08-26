# PROTOTYPE-self-citation — Zis issue #44

Throwaway. Answers: **what does the self-citation guard key on**, given that
`docs/clustering-model.md` §4 keys it on a host registry and #39 found two live
cases outside that registry.

Rides [`PROTOTYPE-clustering`](../PROTOTYPE-clustering/)'s corpus and its on-disk
`cache/` — **no new network traffic**. `node measure.mjs` writes `findings.txt`
and `findings.json`. The clustering is held constant at #39's shipped row H
(`vehicleFromCitations: true`); only the guard moves.

The canonical home for the answer is
[`docs/clustering-model.md`](../../../../docs/clustering-model.md) §4. Where this
file and the doc disagree, the doc wins.

## The seven candidate keys

`isOwn` is factored into two independent axes, which the shipped guard fuses:

- **What it keys on** — a host registry (`hosts[]`), the registry completed from
  the corpus's own evidence, or **authorship**, which needs no list at all: pass 1
  already writes a `self` Citation for every Item's own address, so
  Link → authoring Publisher is a fact the corpus carries.
- **What it is scoped to** — the **Citation** (as shipped) or the **Publisher**.
  Scoped to the Citation, a Publisher can be *both* origin and voter on one
  Signal: its own-host citation is caught, and a second citation of a *different*
  member link still counts as a vote.

| key | keys on | scope |
|---|---|---|
| K0 | host registry | Citation (**shipped**) |
| K1 | registry completed from corpus evidence | Citation |
| K2 | registry + authorship of **any member** | Citation |
| K3 | authorship of any member, no registry | Citation |
| K4 | registry, applied to the **target** | Publisher |
| K5 | registry + authorship, applied to the target | Publisher |
| K6 | completed registry + authorship, target | Publisher |

The **target** is the Signal's union-find root. Both directional alias rules
merge *into* the thing — `merge(target, thread)` and `merge(into, self)` — so the
root is the story and every tombstone is a vehicle pointing at it. Verified on
the one Signal that moves.

## Results

| key | s≥2 | s≥3 | max | control FPs | admission changes vs shipped |
|---|---|---|---|---|---|
| K0 shipped | 26 | 5 | 4 | 3 | — |
| K1 registry completed | 26 | 5 | 4 | 3 | **none** |
| K2 registry + member authorship | 19 | 3 | 3 | 1 | −10 / +3 |
| K3 member authorship only | 19 | 3 | 3 | 1 | −10 / +3 |
| **K4 target, registry only** | **26** | **4** | **4** | **3** | **−1 / +1** |
| K5 target, registry + authorship | 26 | 4 | 4 | 3 | −1 / +1 |
| K6 target, completed + authorship | 26 | 4 | 4 | 3 | −1 / +1 |

### 1. The registry has exactly one hole, and it is unfixable by completing it

Measured without asking anyone: for every Publisher, the hosts its own Items are
published on, minus the hosts it is registered as owning.

**10 of 48 Publishers, one distinct host: `bsky.app`.** No RSS Publisher and no
feed address is off-registry. And `bsky.app` is **shared by all 10** — so
registering it is precisely the `github.blog` failure §4 already records, and the
`host → publisher_id` UNIQUE rule forbids it outright.

K1 confirms the arithmetic: completing the registry moves **57** Signals and
**0** at Strength ≥2. The `cloudflare.net` case is invisible to this detector
because Cloudflare publishes nothing there — it is a *cited* host only, so no
evidence-based test can find it, and the register is the only thing that can
assert it.

### 2. Authorship of a *member* inverts the vehicle rule

Authorship covers `1,379` Links, but only **29 of 3,986 cited Links (0.7%)** are
authored inside the corpus. Worse, applied to any member it is 30% precise: of
the 10 admission changes it makes, **7 destroy a legitimate vote**.

The reason is structural. An alias merge deliberately folds a *pointer* into the
*thing*, so after the merge the vehicle's author is the **voter**, by design. HN
authors the thread it submitted; suppressing that removes HN's vote from 4 of the
corpus's Signals, and HN is its highest-yield Source. Emollick citing someone
else's video from his own Bluesky post is a vote, not provenance.

Hand-classified, the 10:

| Signal | verdict |
|---|---|
| `simonwillison.net/…/openai-timeline` (3→2) | **true own-vote** |
| `youtube.com/watch?v=Xs-U7SY2uNE` (2→1, kentcdodds) | **true own-vote** — "New Better with Kent", his own video |
| `youtube.com/watch?v=uT7MVcCQ4rw` (2→1, una) | **arguable** — Chrome for Developers' video, una.im is a person |
| 4 × HN thread folds | false — HN's submission is the vote |
| `youtube.com/watch?v=87DyyMV0kCY` (emollick), `noahpinion.blog` (emollick), `huggingface.co/blog/…` (simonwillison) | false — citing someone else's story from one's own post |

### 3. The defect at admission is the guard's SCOPE, not its key

K4 keys on the same registry §4 already has, and changes **exactly one** admitted
voter-set:

```
- 3 | interconnects, simonwillison, tldr
+ 2 | interconnects, tldr
  target  simonwillison.net/2026/Aug/7/openai-timeline   [owned by simonwillison]
  member  news.ycombinator.com/item?id=49220609
```

Willison is the registered owner of the target host. The shipped guard catches his
`self` Citation and marks him `origin` — **and still counts his outbound Citation
of the HN thread as a vote**, because the test is per-Citation. Strength 3 from two
independent voices, and 3 is the `convergence` route's threshold, so that entry
enters a Brief with no Interest match on a number the reader cannot count.

Zero legitimate votes are lost, and `s≥3` 5 → 4 is a removed false Strength-3, not
a lost one — the same reading #39 gave `27 → 26`.

K5 and K6 are identical to K4 at admission: authorship of the *target* and
completing the registry each add **nothing** above it.

### 4. Two shapes no key reaches

- **Ownership on a shared platform is path-keyed.** Kent's own YouTube video is
  Strength 2 from one voice plus JavaScript Weekly. `youtube.com` cannot be
  registered to him, and the video was never ingested as an Item, so neither the
  registry nor authorship can see it. This is ADR-0015's own rule pointing the
  other way: a path on a shared platform cannot be registered.
- **An unregistered second host** (`cloudflare.net`) is an ownership assertion, and
  ADR-0015 already settled that shared ownership is asserted by the register, never
  detected. Nothing in the corpus can find it.

### 5. The registry's second consumer is unaffected

§3's citation-worthiness `dropIntraPublisherLinks` keys on the same registry —
**2,312** drops. A completed registry makes **0** additional drops and authorship
makes **0**. The registry gap is a guard problem only.
