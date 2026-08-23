# A flat Interest ranking has no explanation

Status: accepted, amended by
[#47](https://github.com/SaKaNa-Y/Zis/issues/47) — see
[Amendment (#47)](#amendment-47-the-readers-own-profile) at the foot. **No decision
below moves.** Two pieces of *evidence* do: the coverage fault in
[What this does not fix, and cannot](#what-this-does-not-fix-and-cannot) is **not
observed** on the reader's own profile, and the gap-ordering claim closing
[Why a gap and not a better winner](#the-decision) is **withdrawn**. Read the
amendment before quoting any number from this file.

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

> **Superseded evidence, same conclusion** ([#47](https://github.com/SaKaNa-Y/Zis/issues/47)).
> The table above is the *draft* profile. On the reader's own 20 statements the
> inversion it reports does **not** recur — and neither does its opposite. Sharpness
> and correctness are simply **uncorrelated**: the profile's *vaguest* statement
> produces a correct why-text, its third-*sharpest* produces a wrong one, and the
> mean centrality of the wrong set (0.6755) sits *below* the right set's (0.687).
> **The withdrawal stands and is stronger for it** — narrowing a statement is not
> counter-productive, it is **inert**, and a lever uncorrelated with the outcome is
> worse than a weak one because the reader would be editing in the dark. Full table
> in the amendment.

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

> **That last sentence is withdrawn** ([#47](https://github.com/SaKaNa-Y/Zis/issues/47)).
> On the reader's own profile the gaps run 0.108 `RIGHT`, **0.081 `missed`**, 0.060
> `RIGHT`, 0.041 `missed`, 0.035 `near`, 0.026 `RIGHT`, 0.014 `missed`, 0.004
> `missed` — a wrong winner is the *second*-largest gap, above a correct entry, and
> the overlap is total. **`GAP` no longer orders the admitted set, and neither does
> the spread to 5th.** The mechanism argument in the paragraph above is unaffected
> in *form* and unsupported in *fact*; the decision stands because removing
> `T_gap` needs the same holdout that re-siting it needs. This is the amendment's
> central finding.

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

> **#47 has answered it: the fault is not observed on the reader's own profile.**
> All **8 of 8** admitted entries have a correct statement present in the 20 — the
> four wrong winners passed over #1, #10, #8 and #9 respectively. `uncovered`
> **stopped describing anything** and left the label vocabulary. So the section
> above describes a **draft artifact**, and the size #41 recorded as unmeasured is
> now measured at **zero**. What survives is narrower and is about capability rather
> than incidence: the system still cannot *detect* a no-right-answer-anywhere
> condition, so it can never decline to name an Interest on those grounds. **That
> defect is latent rather than live** — a real limitation with no observed instances
> — and the difference matters, because #41's load-bearing sentence reads as though
> the fault were being seen.

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
  **Re-measured on the reader's own profile** ([#47](https://github.com/SaKaNa-Y/Zis/issues/47)):
  the interest route goes **3 entries, not 1**; Brief entries **7 not 5**; empty days
  **24/30 not 25/30**; 12 suppressed by the floor, not 17. **Density roughly tripled
  and accuracy did not follow** — the three survivors are 1 right in 3, worse than
  the unfiltered 3 in 8, so on this profile the floor selects *for* wrongness. The
  price is therefore smaller than recorded here and bought less than claimed.
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
  evidence of anything. **#47 sharpens this**: on the reader's profile the two
  quantities no longer separate the data *at all*, so the reopening question is no
  longer "what is the right value" but **"is there a mechanism here or only a fit"** —
  put to
  [Decide whether the gap floor is a mechanism or a fitted artifact](https://github.com/SaKaNa-Y/Zis/issues/54).
  The holdout requirement is **not** waived; that ticket's first job is to decide
  whether building one is justified inside Phase 0.

## Amendment (#47): the reader's own profile

[Decide whether a real Interest Profile carries the why-text it is asked to](https://github.com/SaKaNa-Y/Zis/issues/47)
re-read this ADR's measurement against the profile
[#46](https://github.com/SaKaNa-Y/Zis/issues/46) elicited from the reader — 20
statements, no negatives — which is the profile #41 found the original numbers were
missing. **Every decision above stands. Three pieces of evidence do not.**
Measurement: the same
[`.scratch/zis/prototype/PROTOTYPE-calibration/`](../../.scratch/zis/prototype/PROTOTYPE-calibration)
scripts, re-run; `argmax-margin.txt` is the file the table below comes from.

### The admitted set, with the centrality of the statement each entry named

Centrality is each statement's mean cosine to the reader's other 19 — the vagueness
proxy, and the per-statement form of #21's floor. Rank 1 is the **vaguest**.

| verdict | story | names | centrality | rank of 20 | `GAP` |
|---|---|---|---|---|---|
| `RIGHT` | Rewriting Bun in Rust | #18 Rust for tooling and systems work | 0.709 | **1st** | 0.060 |
| `RIGHT` | LLMs reward expertise | #4 Practical LLM application engineering | 0.677 | 11th | 0.108 |
| `RIGHT` | DeepSeek-V4-Flash-0731 | #1 Frontier model releases | 0.675 | 12th | 0.026 |
| `near` | Anatomy of a Frontier Lab Agent Intrusion | #3 AI research from the frontier labs | 0.683 | 8th | 0.035 |
| `missed` | CodePen 2.0 | #20 Software design writing | 0.701 | **2nd** | 0.014 |
| `missed` | AI is removing the middle class | #2 AI provider platform and API changes | 0.697 | 4th | 0.004 |
| `missed` | announced Grok 4.6 | #9 Version releases of libraries/runtimes | 0.679 | 10th | 0.081 |
| `missed` | Stacked pull requests in public preview | #19 RSS, feeds, and the open web | 0.625 | **18th** | 0.041 |

### The three findings

**1. Coverage is not the fault, and never was — it was the draft.** `uncovered` is
**0 of 8**. Every wrong winner passed over a statement that was sitting in the
profile: Grok 4.6 over #1, Stacked PRs over #10, the job-market essay over #8, and
CodePen 2.0 over #9 — the last decided by the reader in this ticket, since #46 left
it unlabelled. **ADR-0012's fault is an argmax-*selection* fault, full stop.**
Consequently **ADR-0003 gains no minimum-coverage requirement** and none will be
added: there is nothing for it to prevent, and it would be a constraint on *reader
data*. Refused with its reasoning at `positioning.md` **§8.4**, with **no reopening
condition** — a floor on statement count is the very constraint being refused, and
`T+` already turns a thin profile into a thin Brief without a separate rule.

**2. Sharpness predicts nothing, so "write narrower Interests" is inert.** #35
dismissed narrowing as *guidance, not a mechanism*, and #41 could not overturn that
because the case against it was draft-measured. It is now upheld on stronger and
different ground. Wrong winners span rank **2 to 18**; right winners span rank **1
to 12**; the mean centrality of the missed set (**0.6755**) is *lower* than the
right set's (**0.687**). The two near-ties contradict each other inside one run —
*Stacked PRs* has the sharp #19 (0.625) beat the vaguer, correct #10 (0.697), while
the *job-market essay* has the vaguer #2 (0.697) beat the sharper, correct #8
(0.636) by 0.004. And the decisive point is finding 1: the sentence the reader
needed was **already written**, so no edit to their phrasing was ever the fix.
Guidance would also point at the wrong statements — it would ask the reader to
narrow #18 Rust, their vaguest, which is producing a *correct* why-text. **No
guidance surface is added**, and `ui-and-ia.md` §7 is not reopened for one: §7
reports a *fact* about a statement, and *"try narrowing this"* is advice with no
evidence behind it.

**3. The 0.897 near-duplicate pair is left alone, deliberately.** #1 Frontier model
releases ↔ #3 AI research from the frontier labs are the tightest of the 190 pairs
by a wide margin, and both appear in the table. Neither merging them nor a spec rule
capping pairwise similarity is adopted. A tight pair means the two candidates are
interchangeable **to the reader too** — which is exactly why the entry it produced
is labelled `near` and not `missed`, so the harm is close to zero. A
max-similarity rule is worse than the coverage constraint it resembles: it would
have refused #1 *or* #3, deleting a statement that produced one of only three
correct why-texts. **Recorded so it is not re-proposed**, not deferred.

### What #47 deliberately did not do

**`T+` and `T_gap` are not re-sited, and `T_gap` is not removed.** Both are
invalidated by the profile change — §10 already makes them conditional on
`(model, profile)` — but the reopening condition above is a *labelled holdout*, and
eight labelled points cannot be split into a fit set and a holdout. Removing the
floor needs the same evidence as re-siting it. The sharp question that replaces
both goes to
[Decide whether the gap floor is a mechanism or a fitted artifact](https://github.com/SaKaNa-Y/Zis/issues/54),
whose opening evidence is the *job-market essay naming #2 by 0.004 over #8, which
was the right answer* — the strongest single indication that the fix is **pick
better**, not **suppress**.
