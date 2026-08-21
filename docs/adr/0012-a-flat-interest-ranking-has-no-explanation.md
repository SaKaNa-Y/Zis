# A flat Interest ranking has no explanation

Status: accepted

Settled by
[Decide whether the argmax Interest is a good enough explanation](https://github.com/SaKaNa-Y/Zis/issues/35),
which was routed out of
[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21)
§10 as the one thing that calibration measured and could not settle. Measurement:
[`.scratch/zis/prototype/PROTOTYPE-calibration/`](../../.scratch/zis/prototype/PROTOTYPE-calibration)
(`argmax-margin.mjs`, `argmax-spread.mjs`, `argmax-replay.mjs`).

ADR-0003 makes the **argmax Interest be the why-text**, rendered verbatim from a
stored column with no LLM call, and ADR-0011 makes that one of exactly two
structural differences Zis claims: *the reason each story appears is a sentence
you wrote*. `T+` was calibrated against the corpus and holds. **The argmax, over
the same cosine, does not.**

Of the 8 eligible Signals that clear `T+` per rung, **4 carry a why-text the
reader would not have written** — and the error does not fall as `REL+` rises. The
worst is a browser announcement explained by a database library:

```
blog.cloudflare.com/kitesurf                          REL+ 0.704  (own, bar 0.70)
  -> "Drizzle and other TypeScript ORMs — schema definition, migrations,
      query builder ergonomics"
```

## ADR-0003's feedback loop does not absorb this, and that clause is withdrawn

ADR-0003 accepted a wrong why-text as *self-repairing*: a vague Interest becomes
visible as the stated reason on a Signal that should not have surfaced, and the
reader sharpens it. That argument requires the wrong winners to be the **vague**
statements. Measured against the profile's own geometry — each statement's mean
cosine to the reader's other 17, the per-statement form of #21's 0.659 floor —
they are not:

| statement named | vagueness rank of 18 | loop can repair? |
|---|---|---|
| *Software design writing — module boundaries, API design* | 2nd (0.700) | yes |
| *Drizzle and other TypeScript ORMs* | 12th (0.666) | no |
| *RSS, feeds, and the open web* | **16th (0.633)** | no |

The loop reaches **one failure in four**. On the others the reader is shown a
tight, specific, correctly-written sentence attached to the wrong story, and there
is nothing to edit. **A wrong why-text is therefore a failure of the claim**, not a
quality nit absorbed by a mechanism already in the design.

## The decision

**A why-text is admissible only if the ranking that produced it was not flat.**

```
GAP(s) = REL+(1st Interest) − REL+(2nd Interest)

interest route requires:   REL+ ≥ T+[text_basis]   AND   GAP ≥ T_gap
```

`T_gap` is **provisional at 0.038** and explicitly **uncalibrated**, on the
`T+[slug]` precedent — a number sited on 8 labelled points with no holdout is the
class of error #21 exists to prevent. Re-siting condition: a corpus with enough
hand-labelled admitted entries to hold one out. Unlike `T+[slug]`, "uncalibrated"
**cannot** mean "fails the route" here: `slug` excluded 4% of the corpus, whereas
this would delete the entire relevance mechanism.

**Why a gap and not a better winner.** The mechanism is #21's floor, drawn out one
step further than #21 took it. The reader's statements sit at a median pairwise
cosine of **0.659** — nearly as similar to each other as a Signal is to its best
match. So when a Signal's text is generic or off-topic, *every* Interest scores
about the same and the winner is decided by rounding noise; when it is specific,
one Interest pulls clear. **Flatness is not a proxy for wrongness. It is the
profile stating that it has no opinion, in the only vocabulary it has.** On the
admitted set the three unambiguously correct why-texts are the three largest gaps,
with no overlap.

**Failing `T_gap` fails the interest route outright.** A Signal can still arrive by
`convergence` at Strength ≥3, which reads no text. There is no third state:
[#10](https://github.com/SaKaNa-Y/Zis/issues/10) puts **no badge anywhere in the
product** and makes the section heading the explanation, so "matched, weakly" has
nowhere to render, and inventing a section to house it is a badge under another
name.

**`GAP` is computed and stored. It is never rendered.** This is the constraint that
keeps the decision inside `positioning.md` §8.2, which refuses a relevance margin
on the Signal page because *Strength is countable and a cosine is not* — and a
difference of two cosines is doubly uncountable. §8.2 stands unamended: no
relevance number renders anywhere. What is refused is **showing** a margin, not
**gating** on one.

## What this does not fix, and cannot

Two of the four failures — an essay on the software job market, a GitHub product
changelog — have **no right answer anywhere in the 18 statements**. The argmax was
not choosing badly among candidates; there were no candidates, and naming the top
scorer is the only move available.

That fault is real, distinct, and **not detectable at runtime**. Both the gap to
2nd and the spread to 5th were tested as separators and both interleave the two
faults (near-miss gaps 0.035 / 0.022 against uncovered gaps 0.032 / 0.017 /
0.014). It is the judgement the cosine already failed at, so no arithmetic over
the same embeddings can recover it. `T_gap` suppresses both faults together, which
is sufficient to act on and insufficient to diagnose.

**Coverage was put to
[Decide whether the Interest Profile carries the why-text it is asked to](https://github.com/SaKaNa-Y/Zis/issues/41)
and came back undecidable rather than answered** — on a *draft* profile, which is
the only profile any of this was measured against. `interests.draft.md` disclaims
being the reader's in its own header, and it was never edited, so "two admissions
have no right answer in the profile" is a fact about a draft. Put to the reader
directly, **neither of the two was a coverage gap**: the software-job-market essay
is actively unwanted (which makes it an *admission* fault, not an explanation
fault) and the GitHub changelog is a matter of indifference. Nothing here is
withdrawn — the fault remains real, distinct, and undetectable at runtime, and
`T_gap` still suppresses it — but its *size* is unmeasured. It is re-asked against a
real profile by
[Decide whether a real Interest Profile carries the why-text it is asked to](https://github.com/SaKaNa-Y/Zis/issues/47),
blocked on
[Write the reader's actual Interest Profile and re-run the calibration measurement](https://github.com/SaKaNa-Y/Zis/issues/46).

#41 also closed the one surface this section might have licensed: surfacing the
**aggregate** of the undiagnosable fault is **refused full stop**, on grounds
independent of any profile — `positioning.md` §8.3. So the honest reading of this
section is unchanged and now load-bearing: **the system can never decline to name
an Interest on the grounds that nothing fits, and it will never tell the reader
that it couldn't.**

## Consequences

- **The interest route gets much smaller, and this is the price.** Over the 30-day
  replay at the settled bars, `T_gap` takes it from **6 entries to 1**; Brief
  entries fall 10 → 5, the trailing-14 median 1 → 0, empty days 21/30 → 25/30. No
  floor keeps more than one entry without also keeping a clearly-wrong one (the
  GitHub changelog clears a 0.030 floor at 0.032). This follows §9's standing rule:
  a bar that misses the density target is **reported** as miscalibrated, never
  lowered, because an adaptive bar is padding wearing a formula.
- **`positioning.md` §7.1's separability falsifier still does not fire, at any
  floor tested** — every surviving interest-route entry is Strength 2, so
  co-citation alone would not have surfaced it. But it now rests on **one entry per
  month**, with four fifths of the Brief arriving by `convergence` and no Interest
  named. A claim can hollow out without tripping a test written as a binary, and
  that is the condition to watch rather than the falsifier.
- **ADR-0003 survives; one clause of it does not.** The Interest Profile is still a
  set of separately-embedded statements, the argmax is still the why-text, and it is
  still rendered verbatim from a stored column with no LLM call. What is withdrawn
  is the claim that wrong why-texts are self-correcting through reader editing.
- **One more stored column, no new call and no new fetch.** `GAP` is a subtraction
  over two cosines already computed to find the argmax. Sealing is unaffected — a
  cut `BriefEntry`'s why-text is frozen, so a re-embed on rung improvement cannot
  disturb a Brief already cut.
- **A model swap now invalidates three numbers, not two.** §10 already made `T+`
  conditional on `(model, profile)`. `T_gap` is conditional on the same pair and
  more tightly, since it reads the profile's internal separation directly.
- **The reopening condition is a labelled corpus, not an argument.** `T_gap` was
  fitted, and two different quantities separated the data equally well, which is
  the signature of fitting rather than measuring. The direction is mechanism-backed;
  the value is a placeholder that must be re-sited before anyone quotes it as
  evidence of anything.
