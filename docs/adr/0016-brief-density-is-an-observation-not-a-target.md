# ADR-0016 — Brief density is an observation; only supply carries an alarm

**Status**: Accepted
**Date**: 2026-08-25
**Ticket**: [Decide whether a trailing-14-day median of ≥5 is the right density target](https://github.com/SaKaNa-Y/Zis/issues/56)
**Supersedes**: the "Brief density is a target on the bar" clause of
[ADR-0006](0006-admission-is-absolute-bars-not-a-score.md), and
[`ranking-model.md`](../ranking-model.md) §9's target and its reporting mechanism.
**Amends**: [ADR-0012](0012-a-flat-interest-ranking-has-no-explanation.md)'s
appeal to that mechanism (the appeal's conclusion stands; its authority moves here).

## Context

[Specify the ranking and interest model](https://github.com/SaKaNa-Y/Zis/issues/9)
set a **target: over a trailing 14 days, the median Brief holds ≥5 entries**, with
the mechanism that a miss is *reported* to the operator and the bar is never moved.
It was recorded without being derived — no reading-time budget, no reader study,
nothing it was computed from.

Two years of measurement have now closed every branch of its escalation path.

| lever | status |
|---|---|
| more distinct Publishers | **closed.** #11 measured the slope: 66% more Publishers bought 50% more ceiling. A ceiling that yields 5 needs several hundred, which ADR-0008's compute budget forbids |
| lower `T+` | **closed.** `ranking-model.md` §9: the trailing-14 median is **1 at every bar tested, including one low enough to admit every eligible Signal** |
| an adaptive bar | **banned** by ADR-0006 — padding wearing a formula, and it breaks sealing's reproducibility |
| shorten retention | **banned** by #8 on three counts, irreversible under ADR-0005 |
| raise the 3–12 ceiling | **banned** by #14, upheld twice |

The measured position at the register as shipped (73 Publishers / 96 Sources):
**163 Signals at Strength ≥2, a trailing-14-day median of 3 eligible per day** —
and that 3 is a *ceiling*, before any Interest match and before `T+`. The Brief
lands under it, at a median of 1, or 0 once `T_gap` applies.

So the target is missed by a factor of five, every branch of its escalation
resolves onto nothing, and the honest reading of #9's own mechanism is that it
reports *miscalibrated* every morning forever. That is the failure ADR-0012 found
in a binary falsifier that reports *healthy* all the way down, arriving from the
opposite direction.

### Three things were fused into one number

Asked directly, the reader confirmed ≥5 was an intuition about *feel* rather than
a requirement, and named **3** as what a morning needs to hold. Unpacking what the
number was actually doing separates three objects with three different jobs:

1. **A rule** — nobody may lower the bar to make Briefs look fuller. This job the
   number did successfully, twice, with nothing enforcing it: #9 reported rather
   than lowered, and §9 accepted `T_gap` cutting the interest route to one entry
   per month rather than trading the floor away.
2. **An alarm** — something should fire if supply *regresses*, which is a real and
   currently unwatched failure (#6 shipped three broken adapters and 25
   robots-disallowed feeds, and nothing noticed).
3. **An observation** — how full the Brief actually is, which the reader
   experiences and nobody should promise.

Fused, they defeat each other. The decisive objection is that **the number was
denominated in the one quantity that lowering the bar inflates.** Re-siting
`T_gap` from 0.038 to 0.02 — a live option under
[#54](https://github.com/SaKaNa-Y/Zis/issues/54) — would raise measured density
without a single new Publisher being read. A metric whose job is to catch a
retreat pays out *for* that retreat. Meanwhile ten Publishers of genuine curation
can leave Brief entries unchanged, so the only lever anyone still has reads as
zero progress.

## Decision

**The ≥5 target is retired.** No number is promised about Brief size, and no
mechanism reports a Brief as too short. In its place:

**1. The rule (no number).** *No change to `E1`, `T+` or `T_gap` may be justified
by brief density.* It has no threshold and no median, and it fires on a
*justification* rather than on a count — it is caught in review, not in CI, on the
evidence that the documentary version has already held the line twice with nothing
enforcing it. Its first live customer is [#54](https://github.com/SaKaNa-Y/Zis/issues/54):
the gap floor may be decided on whether it is a mechanism or a fitted artifact,
**never** on how many entries removing it would add.

> **That customer has been through, and the rule held**
> ([ADR-0018](0018-a-gap-cannot-see-a-confident-wrong-answer.md)). `T_gap` was
> dropped on the mechanism question alone — and note the direction: removing it
> *adds* entries, so the rule bound against the temptation that actually existed.
> Two wording consequences. The rule now reads *"`E1`, `T+` or the interest route's
> selector"*, since `T_gap` no longer exists and the rule must still reach whatever
> replaces it ([#61](https://github.com/SaKaNa-Y/Zis/issues/61)); and this ADR's
> §9.4-derived figure *"0 once `T_gap` applies"* reverts to the control's **1**.
> `ranking-model.md` §9.1 is the live text.

**2. The alarm, on supply, shaped as a run.** The watched quantity is the
**longest run of consecutive days with zero eligible Signals at Strength ≥2** —
supply, not Brief entries, so no threshold can inflate it; a run rather than a
median, because a median of 3 is compatible with a week of nothing followed by a
week of fives, and a *streak* of blank mornings is what stops a daily habit
forming. Its value is **provisional 2**, the longest run in the 30-day replay
(`PROTOTYPE-supply/rep-FINAL.log`), and **it may not fire until re-sited on 30
days of forward-running data** — see the measurement caveat below.

**3. The observation, promising nothing.** Brief size is reported because it is
what the reader sees. Alongside it, recorded as context and explicitly
non-binding: **the reader states that 3 entries make a morning worth opening.** It
triggers nothing. A 2-entry Tuesday is Tuesday, not a miss.

### The measurement caveat that makes the alarm's value provisional

**A single-snapshot replay understates its own older days, and the bias is
structural.** An older day can only be reconstructed from Items still present in a
current feed; publisher-side retention has already deleted the rest. In the 30-day
window ending 2026-08-22, fetched in one pass on 2026-08-23, the first 16 days
hold **33** eligible Signals and **5 of the 6** blanks; the last 14 hold **60**
and **one**.

So `#21`'s *"18 of 30 days empty"* and `source-register.md` §8's *"6 of 30"* are
both partly measuring feed retention rather than supply. Neither is a steady-state
figure, and an alarm sited on a biased window buys either false alarms or silence.
This is the same discipline as `ranking-model.md` §10's "these cosines are
conditional", applied to counts instead of scores.

## Consequences

- **Nothing in Phase 0 can report a density miss**, because there is no target to
  miss. `ranking-model.md` §9 is rewritten around the rule, the alarm and the
  observation.
- **The alarm's value travels with Phase 1's first build ticket**, alongside
  "public before the cron is enabled" (ADR-0010): 30 days of forward-running
  supply data must be collected and the run length re-sited before the alarm may
  fire. It is deliberately *not* a ticket on the Phase-0 map, which would be a
  ticket blocked on something the destination forbids.
- **Design work justified by ≥5 keeps its justification, restated.**
  `ui-and-ia.md` §5 built the short and empty states first *because* they are
  among the most-rendered faces of the product. That was right, and it is *more*
  right now: the reason is the measured supply, not a target nobody derived.
- **No density figure may be quoted as a steady-state property.** This retires
  the last authority behind treating entry counts as settled facts about the
  product — including `positioning.md` §7.1a's "one entry per month", whose
  figures come off #6's 44-Publisher corpus and are stale by register besides.
- **What this does not license.** It is not a reason to weaken `E1` — a Strength-1
  floor admits 4,910 of 4,937 Signals, the anxiety inbox the product exists to
  delete. It is not a reason to move the 3–12 ceiling (#14, upheld). It does not
  make an adaptive bar available: rule 1 is *stronger* than the target it
  replaces, because it bites on the justification rather than waiting for a count
  to fall. And it is not a verdict that the corpus is too thin — a short Brief is
  honest by construction (#14), and what changed is only that nobody promised
  otherwise.
