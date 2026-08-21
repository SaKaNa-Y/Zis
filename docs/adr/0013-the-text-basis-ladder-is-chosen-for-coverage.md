# The `text_basis` ladder is chosen for coverage, and rung choice is not a quality lever

Status: accepted

Settled by
[Re-decide which text_basis rung is chosen when more than one is available](https://github.com/SaKaNa-Y/Zis/issues/42),
which was routed out of
[Decide whether the argmax Interest is a good enough explanation](https://github.com/SaKaNa-Y/Zis/issues/35)
as the sharp half of a defect ADR-0012 recorded and deliberately did not fix.
Measurement:
[`.scratch/zis/prototype/PROTOTYPE-calibration/`](../../.scratch/zis/prototype/PROTOTYPE-calibration)
(`rung-precedence.mjs`, `rung-length.mjs`, `rung-title.mjs`).

`ranking-model.md` §4 embeds a Signal from the best text available — `own` ≻
`citing` ≻ `slug` — and §4 chose that order for **coverage**: 83.0% of Signals
embed from something other than their own text, so a model requiring a Signal's
own text forfeits three quarters of the corpus. #35 then found that on two of the
four `own`-rung eligible Signals the *losing* rung both scored higher and named
better, and §4 has carried the precedence as **"a measured open defect"** since.

**That accusation is withdrawn. It was measured on four points, and at whole-rung
scale the defect is not at this address.**

## The population is 44 Signals, not 849

The precedence can only fire on an `own` Signal that *also* has a `citing` text
available. Re-running the measurement with #35's Strength ≥2 filter dropped:

| | count | share of corpus |
|---|---|---|
| `own` rung | 849 | 17.0% |
| ...of which a `citing` text also exists — **the contested set** | **44** | **0.9%** |
| ...of those, admitted by `REL+` at all | 13 | 0.3% |
| ...of those, surviving ADR-0012's `T_gap` | **3** | 0.06% |

The other 805 `own` Signals carry only a `self` Citation, so the ladder never has
a choice to make. **Every argument about which rung wins is an argument about
0.9% of the corpus and three visible entries.**

## Both measured tiebreaks select for garbage, which is #4's own error again

#42 asked whether the rung should be chosen by the higher `REL+` or the higher
`GAP`. The predicted objection was the **cross-bar** problem — `own` is gated at
0.70 and `citing` at 0.67, so maximising the score selects for whichever rung has
the lower bar. That effect is real and small: "higher `REL+`" adds 6 admissions
over the 44, and **exactly 1** of them clears only the 0.67 bar.

What disqualifies both rules is cruder. **29 of the 44 `citing` texts are under 25
characters** — `Docs`, `v1.0.0`, `published`, `post about the project.` A short
text against short Interest statements inflates cosine, so score-maximising picks
those: **higher `REL+` picks them 14 times, higher `GAP` 11 times.**

```
go.dev/blog/16years            (Go's 16th-birthday post)
  own     REL+ 0.647  -> "Frontier model releases from the major AI labs"
  citing  REL+ 0.714  -> "Vue 3 Composition API and the Vue ecosystem"
          citing text, in full: `v1.0.0`
```

This is structurally the error §4's own largest finding caught: **a bar on `REL+`
over polluted text selects for pollution.** #4 caught it in concatenated
newsletter titles making short texts long; here it is bare anchors making texts
short. The direction reversed; the mechanism did not.

`GAP` fails on a second count as well — 14 of the 44 comparisons are decided by
less than 0.010, against a median |Δ`GAP`| of 0.019.

## The flagship failures are `own`'s composition, not the ladder

`own` embeds the Item's title **plus up to 1200 characters of extracted body**,
and on this set it is essentially always at the cap (median `own` text length:
1200). In 15 of the 44 the `citing` anchor **quotes the Item's own title** — so in
those cases "`own` versus `citing`" is really *title + body* versus *title*, and
the rung is not the variable. Measuring the third text §4 never considered:

| | `own` full | title alone | `citing` |
|---|---|---|---|
| `blog.cloudflare.com/the-agentic-internet` | 0.647 → *Coding agents* | **0.793 → *Coding agents*** | 0.780 → *RSS, feeds, and the open web* |
| `blog.cloudflare.com/kitesurf` | 0.704 → *Drizzle and other TypeScript ORMs* | **0.751 → *Coding agents*** | 0.766 → *Web platform features* |

The agentic-internet row is decisive, because #35 read its `citing` score as the
losing rung naming better. It does not — the `citing` text is `own`'s title
verbatim **plus `(9 minute read)`**, and it names *RSS and feeds* for a Cloudflare
post about an agent protocol. The title alone beats both and names right. `own`
lost because **the body diluted a title that was already correct.**

On kitesurf the two texts are the *same sentence* differing only by a
`(16 minute read)` suffix — and they **name different Interests**. That is the
noise floor, measured: at these margins the argmax is not carrying information
about which rung is better.

The one case where a genuine long anchor scores higher, the precedence is
**right**: `openai.com/index/ten-advances-in-mathematics`, `citing` 0.793 →
*"Frontier model releases"* against `own` 0.704 → *"AI research published by the
frontier labs"*, for a post about mathematics results.

## The decision

**§4's precedence stands as written — `own` ≻ `citing` ≻ `slug`, unconditional, no
tiebreak — and the rung is a coverage decision, not a quality one.**

Quality of the why-text is not refused; it is **assigned elsewhere**. It belongs to
`T_gap` (ADR-0012) and to what a rung *embeds*, never to which rung wins. The rung
choice is disqualified as a quality lever on both counts a lever needs: it reaches
0.9% of the corpus, and every rule measurable over this corpus names *worse* on a
third of the set it governs.

**This is not "the fix is too expensive."** It is that there is no defect at this
address, and §4's open-defect note is therefore retracted rather than left
pending.

## Consequences

- **§4's re-embed rule keeps its meaning, and #42's third question dissolves.** "A
  Signal is re-embedded when its rung improves (`slug → citing → own`)" presumes a
  total order, and #42 asked what "improves" would mean if the rung were chosen
  per-Signal by a measured quantity. It is not, so the order is intact, the
  monotonicity holds, and `embedding_version` needs no new state. The consequence §4
  already records — a Signal can pass tomorrow because its text improved rather
  than its Strength — stays bounded by `E2` and still cannot disturb sealing.
- **What §4 records at this address changes from a defect to a finding.** The
  paragraph naming the precedence a measured open defect is replaced by the
  population count and the garbage-anchor result, so the question is answered in
  the document rather than pointed at.
- **The real defect is re-addressed, not dropped**, as
  [Decide what the `own` rung embeds](https://github.com/SaKaNa-Y/Zis/issues/49) —
  title, title + body, or a length-bounded composition. It is a **19× larger
  lever**: it governs all 849 `own` Signals rather than 44. Nothing here licenses
  an answer to it — title-alone wins 23 of 44 and loses badly where the title is
  thin (`Go's Sweet 16`: 0.516 against 0.647), so "embed the title" is measured to
  be wrong too.
- **The `citing` rung's definition is untouched.** Anchor text, longest wins,
  citing Item title as fallback — settled by
  [#21](https://github.com/SaKaNa-Y/Zis/issues/21). What the garbage-anchor result
  adds is that **a bare anchor's shortness is a property #21 did not have to price**,
  because on the `citing` rung there is no alternative text to lose to. It becomes
  a live question only where a rule would *compare* an anchor against something
  else, which this decision refuses to do.
- **Every named Interest above is against the draft profile, and none of the
  load-bearing facts depend on it.** 44-not-849 and 29-of-44-under-25-characters are
  properties of the corpus text, so
  [#46](https://github.com/SaKaNa-Y/Zis/issues/46)'s real profile cannot move them.
  A profile rewrite changes which Interest each row names; it does not restore the
  rung as a quality lever.
- **Do not re-open on a single anecdote.** A future case where `citing` would have
  named better is expected — the contested set is 44 wide and its argmax
  disagreements run at 65.9%. Re-opening needs a labelled measurement over the
  contested set showing a rule that beats the precedence *without* selecting short
  anchors, which is the thing three quantities failed at here.
