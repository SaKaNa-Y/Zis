# Ranking model — what earns a place in a Brief

Settled by
[Specify the ranking and interest model](https://github.com/SaKaNa-Y/Zis/issues/9).
Read [`CONTEXT.md`](../CONTEXT.md) first; this document uses its terms without
redefining them.

Every number marked **provisional** is a placeholder awaiting
[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21).
Nothing else here is provisional.

---

## 0. The one thing this model does not have

**There is no score.** No weighted sum, no blended rank, no tunable constant
turning Strength and relevance into a single number. Admission to a Brief is a
conjunction of absolute tests, each of which a reader could check by hand.

This is a constraint, not an aesthetic (ADR-0006): the explanation *is* the
mechanism, so a term that cannot be rendered into the why-text sentence from
stored columns alone is disqualified from the decision. Three proposals died on
that rule rather than on three separate arguments — Publisher trust weights, a
combined importance/relevance score, and subtractive negative Interests.

## 1. The quantities

Computed for a reader `u` and a Signal `s` at cut time `t`.

| quantity | definition |
|---|---|
| `STRENGTH(s)` | `COUNT(DISTINCT publisher_id)` over `s`'s citation-worthy Citations, origin-excluded, self-citation guarded — exactly as the [clustering spec](https://github.com/SaKaNa-Y/Zis/issues/6) defines it |
| `AGE(s)` | `t − first_citation_at(s)` |
| `FRESH(s)` | `t − last_citation_at(s)` |
| `DECAY(s)` | `0.5 ^ (FRESH(s) / H)`, `H` = **36h provisional** |
| `REL+(s,u)` | `MAX` over the reader's **positive** Interests of `cos(vec(s), vec(i))` (ADR-0003) |
| `REL−(s,u)` | `MAX` over the reader's **negative** Interests of the same |
| `T+[basis]` | positive relevance bar, **one value per `text_basis` rung** — provisional |
| `T−` | negative suppression bar, deliberately **lower** than `T+` — provisional |

`vec(s)` is the embedding of whatever text the Signal actually has — see §4.

**No velocity term exists.** It is cut from v1 (ADR-0006): velocity needs
history the system does not have, HN publishes a current score rather than a
rate, and GitHub is narrowing per-star timestamp access (July 2026). Per-Source
metric snapshots are recorded from day one so the term can be added later against
measured data rather than a guessed baseline.

## 2. Eligibility

A Signal is eligible for reader `u`'s Brief when **all** hold:

```
E1  STRENGTH(s) >= 2                  convergence floor — the Brief is never
                                      about a single voice
E2  AGE(s) <= 7 days                  hard cutoff, overrides every other test
E3  no BriefEntry exists for (u, s)   a Signal appears in at most one Brief, ever
E4  REL-(s,u) < T-                    negative Interest suppression
E5  no ReadState(u, s)                already met via Bookmarks or the archive
```

`E1` is the product's thesis in one line. Without it the Brief is a
relevance-filtered river of single-source Items — 4,910 of the 4,937 Signals in
the measured corpus are Strength 1 — which is the anxiety inbox Zis exists to
delete, and it would leave the relevance bar discriminating over 4,937 candidates
instead of 27, making its value arbitrary.

`E4` applies to **both** admission routes (§3). A negative Interest that only
filtered the interest route would fail precisely when the unwanted story is
widely covered — the moment the reader would be angriest.

## 3. Admission — two routes, nested, not orthogonal

An eligible Signal is admitted by exactly one route, recorded on the
`BriefEntry` as its **Admission**:

```
interest      REL+(s,u) >= T+[text_basis(s)]

convergence   STRENGTH(s) >= 3  AND  REL+(s,u) < T+[text_basis(s)]

not admitted  STRENGTH(s) == 2  AND  REL+(s,u) < T+[text_basis(s)]
```

The `convergence` route is the filter-bubble puncture: *many independent voices
converged on this and you never asked for it*. Its bar is **≥3, and ≥2 would be
degenerate** — with a ≥2 floor on both routes the two are exhaustive, every
eligible Signal is admitted, and the relevance bar decays into a caption on the
card rather than a gate. That would reverse
[#14](https://github.com/SaKaNa-Y/Zis/issues/14)'s absolute-relevance-bar ruling
by accident.

**The `convergence` route is expected to fire rarely — weekly, not daily.** On the
measured corpus only 5 Signals reach Strength ≥3 across a multi-year backfill
window. That is correct: a route that fires often is a route routinely overriding
the reader's stated interests. Rarity is the feature.

**There is no quota and no reserved slot count.** The ticket proposed ~7 relevance
+ ~3 importance slots; a reserved count is a top-N cut wearing a different hat,
and #14 banned top-N. Each route self-limits because each is an absolute test.

**`Strength == 2` with no Interest match is the largest rejected class, and it is
invisible** — the reader never learns those Signals existed. That is the correct
consequence of never padding, and it is also the population a chronically short
Brief would have to draw from, so both
[Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11) and
the calibration prototype must count it.

### Where decay actually acts

Because admission is tested against **integer** Strength bars, `DECAY(s)` has
nothing to multiply in the admission decision. Its whole surviving job is
**ordering inside the `convergence` route**. This narrows ADR-0004's "a half-life
multiplier on its score" to its only weight-free realisation, and it means `H` is
a much smaller decision than the clustering prototype's config implied — it
reorders a handful of entries and gates nothing.

Its clock is the **most recent** Citation, not the first: a story that breaks
Tuesday and gets its third Publisher on Friday is news on Friday, which is what
#14 requires and what a first-citation clock would have buried. `E2`'s cutoff on
`AGE` is the necessary guard on that, and it stands on its own ground — a week is
the longest span "what happened recently" can honestly mean, and it bounds the
revival window §4 opens.

## 4. `text_basis` — what `vec(s)` embeds

**3,607 of 4,937 Signals in the measured corpus have no ingested Item at all.**
The C6 shape — a Link cited by several Publishers that Zis never fetched — is the
*common* case, not the adversarial one, and it includes the flagship Strength-3
result (`anthropic.com/research/riemann-zeta`). A model that requires a Signal's
own text to compute relevance forfeits three quarters of the corpus,
disproportionately at the high-Strength end.

So a Signal is embedded from the best text available, and **which rung was used is
stored** as `text_basis`:

| rung | text |
|---|---|
| `own` | the ingested Item's title + extracted summary |
| `citing` | the concatenated titles of the Items citing it |
| `slug` | the canonical URL's path, tokenised |

`T+` is keyed by this rung, because cosine similarity is not portable across text
lengths — a three-word slug and a 200-word summary do not sit on the same scale,
and one global threshold would be wrong for at least two of the three rungs.

**A Signal is re-embedded when its rung improves** (`slug → citing → own`), with
`text_basis` and an `embedding_version` stored alongside the vector. The
consequence, stated rather than discovered later: a Signal that failed the
relevance bar yesterday can pass today because its *text* improved rather than
its Strength. That is correct, it is bounded by `E2`, and it cannot disturb
sealing — a cut `BriefEntry`'s why-text is frozen, so re-embedding never alters a
Brief already cut.

## 5. Ordering

`BriefEntry.position` is frozen at cut time (ADR-0002 / #5) and is a pure
function of stored columns:

1. All `interest` admissions, by `REL+` descending.
2. All `convergence` admissions, by `DECAY(s) × STRENGTH(s)` descending.

Interest-route entries come **first**. Putting convergence first is Techmeme's
ordering and inverts the product's claim by placing a story the reader never asked
for above one they did. Interleaving the two routes would need the cross-route
comparison §0 rejects.

Ordering inside the interest route is by `REL+` alone, with no freshness term,
because any blend of similarity and decay reintroduces a weight. `E2` and `E3`
bound the resulting staleness.

Whether the two routes render as a visible section break is
[Design the information architecture and UI](https://github.com/SaKaNa-Y/Zis/issues/10)'s
call. `admitted_by` is stored precisely so that stays open.

## 6. The explanation

`BriefEntry.why_text` is a pure function of three stored columns —
`interest_id`, the distinct Publisher list, and `admitted_by` — with no LLM call
(ADR-0003), so a sealed Brief is reproducible from rows alone.

```
interest      3 Publishers converged · Hacker News, Simon Willison, The New Stack
              · origin: anthropic.com · matched: "LLM inference infra"

convergence   4 Publishers converged · Hacker News, JavaScript Weekly, Svelte, +1
              · origin: devblogs.microsoft.com
              · no Interest matched — surfacing on convergence alone
```

**The count shown is `STRENGTH` — origin-excluded — and the origin is listed
separately and labelled.** This is the one place the model is easy to get
silently wrong: the clustering research targets counted the origin Publisher and
`STRENGTH` does not, so every displayed figure can be one too high. An
explanation that reports 4 for a Signal admitted at 3 explains a different
decision than the one made, and the first time a reader counts the names the line
stops being evidence.

Publisher names are capped at 3 plus `+N`. Only the **argmax** Interest is named,
and only its `interest_id` is stored: ADR-0003's feedback loop works by making a
vague Interest *visible* as the stated reason on Signals that should not have
surfaced, and listing three matches lets the vague one hide in the crowd.

## 7. Cut time

One Brief per reader per local day, cut at a fixed hour in a stored
`User.timezone`, on the 15-minute cron tick that crosses it, with a uniqueness
guard on `(user_id, local_date)` so the cut is idempotent and safely retryable.

Cutting lazily on first page view would make a Brief's content depend on when the
reader looked, which is the exact property sealing exists to remove. A fixed UTC
hour cuts mid-afternoon for anyone not on UTC, so "today" stops matching the
reader's day.

## 8. Cold start

Three cold starts were conflated in the ticket. Two dissolve.

- **Velocity's** cold start does not exist, because velocity does not ship (§1).
- **The Interest Profile's** is already answered by ADR-0003: the profile must be
  non-empty before the first Brief is cut, and the why-text is the loop that
  sharpens it.
- **The corpus's** is the real one. On day one there are no Citations, so no
  Signal reaches Strength ≥2 and `E1` empties every Brief.

**The corpus is seeded by a backfill**: every Source's full available retention
window is fetched, with newsletter issue-page hydration, before the first Brief is
cut. This is not a new mechanism — it is exactly how the clustering prototype
obtained the only real numbers this project has (1,395 Items / 6,468 Citations /
4,986 Signals from 47 Sources, including 820 links recovered from 24 newsletter
issues).

Two clauses that are easy to lose:

- The backfill runs under the **same** `safeFetch`, robots and polite-fetch rules
  as steady state. No exemption — an exemption list is the shape a bypass takes
  ([security model](./security-model.md)).
- **`E2` applies to backfilled Signals.** A years-deep window fills the corpus and
  the Citation graph without dumping a year of stories into Brief #1.

**The backfill/steady-state distinction matters beyond day one.** The measured
`27 Signals at Strength ≥2 / 5 at ≥3` is a *backfill* yield over feed windows
spanning one day to several years, not a daily rate. Steady-state daily supply is
materially lower, and any capacity claim quoting 27 as a per-day figure is wrong.

## 9. Brief density is a target on the bar, not an input to it

[#14](https://github.com/SaKaNa-Y/Zis/issues/14) settled that Briefs may be
honestly short and say so. #9's amendment adds that a bar set so high that Briefs
are *routinely* near-empty is a failure even though each individual short Brief is
honest. Both hold, as follows.

**Target**: over a trailing 14 days, the median Brief holds **≥5 entries**.

**Mechanism when the target is missed**: the system reports the bar as
miscalibrated to the operator. It does **not** move the bar.

An adaptive bar that lowered itself when recent Briefs ran short is padding
wearing a formula — on a quiet day it descends until the Brief fills, which is
precisely what #14 banned — and it breaks sealing's reproducibility guarantee,
because the bar would then depend on other days' data, so replaying one Brief
would require replaying its neighbours.

A chronically short Brief is therefore a **bug report about the bar and the
source list**. Its escalation path is
[Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11) —
more distinct Publishers means more Signals at Strength ≥2 — and then an explicit
edit to `T+`. **Not** available as a lever, per the map's standing constraint:
shortening full-text retention, which is irreversible under ADR-0005, costs
Interest-matching text, and frees storage rather than the compute that actually
binds.

## 10. What is provisional, and how it gets settled

`T+` per rung, `T−`, and `H` are the only unsettled values, and they are not
settleable by argument. This follows the clustering ticket's precedent: it killed
the embedding second pass **because it measured it**, and a threshold guessed
here would be the same class of error.

[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21)
embeds the existing corpus against a handwritten Interest Profile and measures:

- the `REL+` distribution **per `text_basis` rung**, to site `T+` per rung;
- the `REL−` distribution, to site `T−` below it;
- the **per-day** counts of eligible, `interest`-admitted, `convergence`-admitted,
  and the invisible `Strength == 2, no match` rejected class — the numbers §9's
  target is judged against;
- the inter-citation gap distribution, to site `H`.

It is cheap: the corpus exists on `prototype/clustering-spike`, and `bge-small` is
384-dim open-weight, so it runs locally under #3's pin-the-model finding without
a provider call.
