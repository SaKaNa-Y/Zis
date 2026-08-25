# ADR-0018 — A gap cannot see a confident wrong answer

**Status**: Accepted
**Date**: 2026-08-25
**Ticket**: [Decide whether the gap floor is a mechanism or a fitted artifact](https://github.com/SaKaNa-Y/Zis/issues/54)
**Withdraws**: [ADR-0012](0012-a-flat-interest-ranking-has-no-explanation.md)'s
`GAP >= T_gap` conjunct on the interest route, and with it `T_gap`. Everything
else in ADR-0012 stands — the self-repair withdrawal, the coverage finding, the
latent no-right-answer defect, and the ban on rendering a margin.

## Context

ADR-0012 added a second condition to the interest route: a why-text is admissible
only if the ranking that produced it was not flat, `GAP >= T_gap`, with `T_gap`
provisional at **0.038** and explicitly fitted rather than sited. Its stated
reopening condition was a labelled holdout.

[#47](https://github.com/SaKaNa-Y/Zis/issues/47) re-ran the measurement against
the reader's own 20-statement profile and withdrew the ordering evidence: `GAP` no
longer orders the admitted set, and neither does the spread to 5th. It did not
remove the floor, on the ground that removing it needed the same holdout that
re-siting it needed. This ADR is that decision, taken.

## The decision

**`T_gap` is dropped. The interest route is `REL+(s,u) >= T+[text_basis(s)]`,
full stop.**

```
MATCHED(s,u)  =  REL+(s,u) >= T+[text_basis(s)]
```

`GAP` is still computed and still stored. It gates nothing.

## Why: the mechanism was two claims, and only one of them was true

ADR-0012's argument joined two claims, and the repo has been treating them as one.
Separating them is the whole of this decision.

- **(i) A generic text produces a flat ranking.** The reader's statements sit at a
  median pairwise cosine of **0.659** — nearly as similar to each other as a Signal
  is to its best match — so a text with no clear subject scores alike against all
  of them. **This survives untouched.** It is a true and useful statement about the
  profile's geometry.
- **(ii) Therefore a floor on the gap filters wrongness.** **This does not
  survive**, because it needs the *converse* of (i): a sharp gap has to mean a
  trustworthy winner. It does not.

The counterexample is a single admitted entry, and it is decisive:

```
REL+ 0.680  S=2  citing   GAP 0.081     text: "announced Grok 4.6"
   -> 0.680  #9  Version releases of developer libraries, frameworks and runtimes
      0.599  #11 Next.js App Router internals
      0.587  #10 Developer tooling and build systems
      0.585  #15 TypeScript language releases
      0.579  #12 React itself
```

`#1 Frontier model releases from the major AI labs` — the right answer, and present
in the profile — **is not in the top five**, scoring below 0.579 against a winner at
0.680. The ranking is not flat. It is sharply, confidently wrong: `#9` wins on the
word *announced* and a version number, and a 384-dimension English model reading
three words does not know that Grok is a frontier model.

Flatness is the profile **reporting** that it has no opinion. This is the profile
**having** an opinion that is wrong. A gap cannot tell the second from a confident
*right* answer, because in both cases one Interest pulls clear — which is what the
title of this ADR means, and why no value of `T_gap` could have helped. **No floor
in the swept range excludes this entry, and the tighter the floor the more it
dominates what survives**: at 0.050 and 0.060 the interest route is two entries,
one correct and this one.

### The fault is in the vectors, not in the ranking

Name it plainly, because ADR-0012's two named faults do not cover it: the
argmax-selection fault (flat ranking) and the no-right-answer-anywhere fault
(nothing to name, now latent at zero observed instances). This is a third, an
**embedding-knowledge fault** — the embedding lacks a fact about the world that the
reader has. Three of the four wrong winners are short texts (`announced Grok 4.6`,
`CodePen 2.0`, a changelog title plus *"(3 minute read)"*) where the model is
guessing from a handful of words.

Because the fault sits in the vectors, **no arithmetic over those vectors can
detect it**, and that closes the class rather than one member of it. Confirmed by
measurement rather than asserted: a third quantity, minimum text length, separates
the labelled set no better than the gap or the spread did —

| verdict | text | length |
|---|---|---|
| `missed` | `announced Grok 4.6` | 18 |
| `missed` | `CodePen 2.0` | 11 |
| `RIGHT` | `deepseek-ai/DeepSeek-V4-Flash-0731` | 34 |
| `RIGHT` | `LLMs reward expertise (5 minute read)` | 37 |
| `missed` | `AI is removing the middle class of software engineering (5 minute read)` | 71 |

**Three quantities have now been tried and three interleave the verdicts.** That is
the signature ADR-0012 itself named for fitting rather than measuring.

This term is deliberately **not** added to `CONTEXT.md`. The glossary names things
the product has and words it refuses; a diagnosis belongs where its evidence lives,
and a named fault in the ubiquitous language would start closing questions instead
of opening them.

## Accuracy is not measurable here, and neither side of it may be quoted

The re-run retires an argument **for** this decision as well as the one against it.

Over the 30-day replay at the settled bars, the six interest-route entries at no
floor are `near`, `missed`, `RIGHT`, `missed`, `missed`, `missed`; at 0.038 the
three survivors are `RIGHT`, `missed`, `missed`. So the floor reads as:

| denominator | unfiltered | at `T_gap` 0.038 |
|---|---|---|
| the **admitted set** (8 entries clearing `T+`) — #47's figures | 3 right of 8 (37.5%) | 1 of 3 (33%) |
| the **replay** (6 entries reaching a Brief) — what the reader sees | 1 right of 6 (17%) | 1 of 3 (33%) |

The two disagree on the sign. The gap between them is two `RIGHT` entries (*Bun in
Rust*, *DeepSeek-V4*) that the admitted set contains and no Brief ever shows,
dropped by eligibility and [ADR-0007](0007-a-signal-appears-in-at-most-one-brief.md)
rather than by any floor.

**So #47's finding that the floor "selects for wrongness" is retired.** It was true
of its own denominator and read as a claim about what the reader sees, which the
replay does not support. At n=6 and n=3 one entry moves the rate by 17 and 33
points; both accuracy claims are noise wearing a percentage. This is the same
defect as the evidence #47 withdrew — a real measurement carrying more weight than
its `n` supports — and this ADR has no standing to correct that in ADR-0012's
ordering claim while leaving it in #47's conclusion.

**Nothing in this decision rests on a rate.** It rests on the refutation above,
which is a single counterexample to a stated converse and holds under any
denominator. A future proposal to restore a floor must answer the Grok entry, not
a percentage.

## The holdout is not built inside Phase 0

ADR-0012's reopening condition was *a corpus with enough hand-labelled admitted
entries to hold one out*. Enlarging the labelled set means hand-judging the
remaining **19 of 27 eligible** entries. **Not done, and not ticketed.** Three
reasons:

1. A ~9-point holdout has no power to site a threshold whose candidate range is
   0.004–0.108.
2. The labels would be against a **single snapshot**, which `source-register.md`
   §8.1 shows understates its own older days, so they would want re-doing on
   forward-running data regardless.
3. **There is no longer a number to site.** With the floor dropped, a holdout would
   be built to evaluate a successor selector that does not yet exist. That is the
   wrong order.

**The reopening condition survives and re-attaches.** It is now a requirement on
[Decide whether a deterministic selector beats the argmax over cosine](https://github.com/SaKaNa-Y/Zis/issues/61),
not on a threshold — which is a cleaner statement than ADR-0012's, because it names
what the labels would be *for*. The requirement is **not waived**; it is
re-addressed.

## Consequences

- **The interest route returns to 6 entries over the 30-day replay**, Brief entries
  to **10**, trailing-14 median to **1**, empty days to **21/30**. Measured, not
  derived — `argmax-replay.mjs` re-run at `gapFloor 0.000`, the control that
  reproduces the settled model exactly. Under §9.1 these figures are **reported and
  justify nothing**: density is not why the floor was dropped, and had the numbers
  gone the other way the decision would be the same.
- **The price is 4 of 8 wrong why-texts, and it is accepted with the number
  written down.** [ADR-0011](0011-a-claimed-advantage-must-cost-a-competitor-something.md)
  makes *the reason each story appears is a sentence you wrote* one of exactly two
  structural claims Zis makes, so this is a **named Phase-0 defect**, not a nit. It
  is accepted because gating does not improve the claim — it makes the sample
  smaller while the reader still gets a wrong sentence more often than not — and
  because a defect with a number attached is fixable, whereas a floor believed to
  protect the claim is not. **The claim itself is not softened**: ADR-0011 requires a
  claimed advantage to cost a competitor something, and rewording a claim to survive
  its own measurement is how that ADR gets hollowed out.
- **`GAP` keeps being computed and stored, and is still never rendered.** It is a
  subtraction over two cosines already computed to find the argmax — free by
  ADR-0012's own accounting — and it is the one class of evidence a future selector
  needs that can only be accumulated by running, the same reasoning that keeps
  per-Source metric snapshots for a velocity term that is out of scope. Deleting the
  column costs nothing today and costs a year of history to whoever reopens this.
  `positioning.md` §8.2 is unchanged and unaffected: what it bans is **showing** a
  margin, and now nothing gates on one either.
- **There is still no third state.** Nothing in this decision creates a *"matched,
  weakly"*: [#10](https://github.com/SaKaNa-Y/Zis/issues/10)'s no-badge rule stands
  and the route is now a single condition, so there is less surface for one than
  before.
- **A model swap invalidates two numbers again, not three.** §10's fourth
  condition goes with `T_gap`. `T+` remains conditional on `(model, profile)`.
- **#49's hand-off is re-addressed.** `ranking-model.md` §4.1 found that
  composition reaches ADR-0012's flatness through the text — 42 of 168 co-admitted
  Signals name a different Interest per cap — and concluded that only *the gap floor
  and the pick* could fix a why-text. **The floor half of that is now gone, so the
  pick carries all of it.** The cap is unaffected: it remains a storage and compute
  number that may not be moved on relevance grounds.
- **`positioning.md` §7.1a's staleness is not cured by this ticket, and that is a
  finding.** §7.1a routed its re-measurement here on the ground that the `T_gap`
  replay produces current values as a by-product. It does not: `argmax-replay.mjs`
  reads the clustering prototype's **48-Publisher** cache, not the register's **73**.
  So every entry count in this file and in §7.1/§7.1a remains off the narrower
  corpus. Re-measuring against the register needs an interest-and-embedding pass over
  the supply prototype's data, which wants a running pipeline that this map's
  destination forbids — so it **travels with Phase 1**, alongside
  [ADR-0016](0016-brief-density-is-an-observation-not-a-target.md) §9.2's
  provisional alarm value, rather than becoming a ticket that could never reach the
  frontier.

## What would reopen this

**Not an argument, and not a rate.** A restored floor needs a mechanism that
survives the Grok entry — that is, a quantity computable from stored columns which
separates *confidently wrong* from *confidently right*, when the fault it must
detect is a missing fact in the embedding. If such a quantity existed it would be a
better **selector**, not a filter, which is why the successor question is
[Decide whether a deterministic selector beats the argmax over cosine](https://github.com/SaKaNa-Y/Zis/issues/61)
and not *re-site `T_gap`*.
