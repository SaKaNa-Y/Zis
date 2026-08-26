# ADR-0019 — The wrong Interest is not reachable from either side of the cosine

**Status**: Accepted
**Date**: 2026-08-25
**Ticket**: [Decide whether a deterministic selector beats the argmax over cosine](https://github.com/SaKaNa-Y/Zis/issues/61)
**Withdraws**: nothing. **Extends**
[ADR-0018](0018-a-gap-cannot-see-a-confident-wrong-answer.md)'s closed class from
*arithmetic over the vectors* to *the vectors themselves*, on both sides.
**Amends**: `ranking-model.md` §6 (a second measured-inert lever),
`positioning.md` §8.4 (the same, as support for a standing refusal).

## Context

ADR-0018 dropped `T_gap` and left the interest route a bare argmax over cosine,
with the price written down: on the reader's own profile the argmax names an
Interest they would not have written on **4 of 8** admitted entries. Because
[ADR-0011](0011-a-claimed-advantage-must-cost-a-competitor-something.md) makes
*the reason each story appears is a sentence you wrote* one of exactly two
structural claims Zis makes, that is a **named Phase-0 defect**. #61 is the route
it was given: *is there a selection rule better than argmax-over-cosine that Phase
0 can actually have?*

**There is not.** This ADR records the answer, the one candidate that deserved a
measurement, and the reason the class is now closed on both sides rather than one.

## The decision

**The interest route stays a bare argmax over cosine. No selector replaces it in
Phase 0, and the 4-of-8 defect stands as recorded.**

```
MATCHED(s,u)  =  REL+(s,u) >= T+[text_basis(s)]        unchanged
why_text      =  argmax over the reader's Interests    unchanged
```

ADR-0018's *"no candidate survives the constraints, defect recorded"* was named a
legitimate resolution, and this is it — reached by falsifying the strongest
candidate rather than by declining to look.

## The candidate that should have worked, and did not

Every quantity tried before this ticket operates on the **Signal** side of the
cosine: composition and the 1200 cap (#49), the rung (#42), the gap to 2nd and the
spread to 5th (#35), text length (ADR-0018). ADR-0018 named the fault an
**embedding-knowledge fault** — `bge-small-en-v1.5` does not know Grok is a
frontier model — and predicted a fourth arithmetic quantity would interleave the
verdicts like the first three.

**Nobody had touched the Interest side**, and it is where the missing fact could
legally live. `#1 Frontier model releases from the major AI labs` contains no model
name. `#9 Version releases of developer libraries, frameworks and runtimes`
contains the words *version* and *releases*, which is what `announced Grok 4.6`
looks like lexically. So the candidate: **the reader's statement carries
exemplars.** Deterministic, no second model, reproducible from stored columns, and
it re-embeds **20 vectors rather than 4,986** — ADR-0008 barely notices. It is also
not the pre-refused *"write narrower Interests"*: #47 measured **sharpness**, which
is how tightly a statement scopes a topic; this is whether the statement contains
the **proper nouns the corpus actually uses**. Different levers.

Measured in
[`.scratch/zis/prototype/PROTOTYPE-calibration/`](../../.scratch/zis/prototype/PROTOTYPE-calibration)
(`interest-exemplars.mjs`), two variants over the reader's 20 statements, both
inside ADR-0003's 200-char cap:

- **`labs`** — organisation names only (`OpenAI, Anthropic, Google DeepMind, Meta,
  xAI, Mistral, DeepSeek`). Durable: the set of frontier labs turns over slowly and
  a reader writes it once.
- **`models`** — product names too (`GPT, Claude, Gemini, Grok, Llama, DeepSeek`).
  Stronger if it works, and stale the day a lab ships under a new name.

**The flagship case is unmoved, and that is the whole decision.**

```
                        base            labs            models
"announced Grok 4.6"    #9 @ 0.680      #9 @ 0.692      #9 @ 0.665
  where #1 sits         rank 7 (0.572)  rank 4 (0.590)  rank 2 (0.630)
  gap to 2nd            0.081           0.080           0.035
```

With the word **Grok written literally into statement #1**, `#9` still wins. The
exemplars are not inert on the ranking — they pull the right answer from rank 7 to
rank 2, which is a real effect and the reason this candidate was worth a run — but
they **do not flip the argmax**, and ADR-0018 set the bar at surviving this entry.

**The reason it cannot be fixed with a longer exemplar list is the important
part.** `#9` does not win on a vocabulary gap the reader can close. It wins because
`announced Grok 4.6` **genuinely is** a version-release announcement on its surface
— *announced*, a product name, a dotted version number — so the winning Interest is
a defensible reading of the text. Only the world knowledge that Grok is a model
rather than a library breaks the tie, and that knowledge is not expressible as more
words in the reader's sentence. `models` is already the maximal version of this
candidate. There is no narrower one that does better.

### What the rest of the labelled set says, and why none of it is encouragement

| verdict | wanted | base | `labs` | `models` | text |
|---|---|---|---|---|---|
| `missed` | #1 | #9 @ 0.680 | #9 @ 0.692 | #9 @ 0.665 | `announced Grok 4.6` |
| `missed` | #8 | #2 @ 0.729 | #2 @ 0.728 | **#8 @ 0.716** | `AI is removing the middle class…` |
| `missed` | #10 | #19 @ 0.670 | #19 @ 0.687 | #19 @ 0.697 | `Stacked pull requests…` |
| `missed` | #16 | #20 @ 0.708 | #20 @ 0.708 | #20 @ 0.708 | `CodePen 2.0` |
| `RIGHT` | — | #4 @ 0.754 | #4 @ 0.745 | #4 @ 0.755 | `LLMs reward expertise…` |
| `RIGHT` | — | #1 @ 0.671 | #1 @ 0.704 | #1 @ 0.684 | `deepseek-ai/DeepSeek-V4-Flash-0731` |
| `RIGHT` | — | #18 @ 0.737 | #18 @ 0.756 | #18 @ 0.753 | `Rewriting Bun in Rust…` |

**One row moves, and it is the one row that proves nothing.** `models` fixes the
job-market essay — and that is the entry ADR-0018 recorded as *the right answer
losing by 0.004*. A coin landing the other way at the noise margin is not a
knowledge fix, and #61's own brief flagged that margin as *the strongest single
argument for pick-better*. It turns out to be the weakest, because it is the one
outcome any perturbation of any magnitude could have produced.

**Two rows are fully inert.** `CodePen 2.0` names `#20` at 0.708 under all three
variants, unchanged to three decimals — 11 characters carry too little for any
Interest-side edit to reach. The GitHub changelog keeps naming `#19 RSS, feeds, and
the open web` and grows **more** confident about it (0.670 → 0.697), so the
candidate makes one failure worse.

**The candidate is not destructive, which is worth recording so nobody re-runs it
hoping.** All three `RIGHT` rows survive both variants, and `labs` raises DeepSeek's
correct match from 0.671 to 0.704. It helps the already-right and leaves the wrong
wrong — the profile of a change with no diagnostic power.

### It also carries a hidden price, and the price is `T+`

§4's floor under every bar is the profile's own median pairwise cosine. Changing the
statements changes the floor:

| variant | median pairwise cosine (n=190) | shift |
|---|---|---|
| `base` | 0.6607 | — |
| `labs` | 0.6702 | **+0.0095** |
| `models` | 0.6616 | +0.0009 |

§10 already makes `T+` conditional on `(model, profile)`; this measures the size of
it. So an exemplar edit is **not a drop-in** — it re-sites every bar to preserve
#21's 0.039 offset, and it does so **on every edit the reader ever makes to a
statement**, which is a re-calibration triggered by reader data.

And the shape of `labs`'s gain is §4.1's **select-for-pollution** result for the
fourth time: **11 admissions against `base`'s 8** at the shipped bars, still 11 at
bars shifted to preserve the offset — admissions bought by raising cosine
everywhere, while the argmax churns on **9 of 27** eligible Signals (`models`: **10
of 27**) against one label improving. Under §9.1 those counts justify nothing in
either direction; they are recorded because a reader watching 10 of 27 explanations
change would read motion as improvement.

**The overfitting hazard is stated rather than measured away.** There are 8 hand
labels and the exemplars were written knowing which 4 failed, so every list here is
fitted to the failures it is tested on — the exact signature ADR-0012 named for
fitting rather than measuring. The run could therefore only ever **falsify** the
candidate, never confirm it. It falsified it. Under ADR-0018's rule, that is
sufficient and no rate is quoted: a single counterexample to a stated mechanism,
holding under any denominator.

## The class is now closed on both sides

This is the finding that outlives the candidate, and it is why this is an ADR rather
than a resolution comment.

ADR-0018 closed a class: *the fault sits in the vectors, so no arithmetic over those
vectors can detect it.* That left an opening, and the opening was real — change the
vectors instead of the arithmetic. The Interest side is the only place Phase 0 can
change them cheaply, and it is now measured.

**So the class is wider than ADR-0018 stated it. The wrong Interest is not reachable
from either side of the cosine** — not by re-composing the Signal's text (#49), not
by choosing a different rung (#42), not by any arithmetic over the resulting
ranking (#35, ADR-0018), and not by enriching the reader's statement (this ADR).
A fix has to **add knowledge the embedding does not have**, and every mechanism that
can do that is a second model on the relevance path.

**That, and not a shortage of ideas, is why Phase 0 has no successor selector.**

### Two candidates refused without a measurement, on the class argument

- **A rule over the ranking's shape** — normalised entropy over all 20 Interests,
  already computed for #49 by `rung-flatness.mjs` and #61's cheapest candidate to
  test. **Refused unmeasured**, and deliberately: entropy is arithmetic over the
  vectors, so it is inside the class ADR-0018 closed. Spending a run on it
  re-instances a class result instead of testing it. Nothing about a fifth quantity
  would be different, and this ADR is the document that should stop a fifth attempt.
- **A cross-encoder or re-ranker over the top-k Interests** — the one candidate that
  genuinely adds world knowledge, and deterministic if the model is pinned.
  **Ruled out of scope rather than resolved**, because it is perfectly sharp and
  simply sits past this map's destination: a second model on the relevance path, a
  fresh ADR-0008 compute bill, and `ranking-model.md` §6's existing refusal of an
  LLM there for translation. It is probably the right answer eventually. It is not a
  Phase-0 answer.

### And one refusal that is not a candidate at all

**Dropping the `matched: "…"` clause from the interest route's why-text is refused.**
It is the cheapest way to make 4-of-8 disappear — explain by Publishers and origin
alone and there is no wrong sentence to be wrong. ADR-0011 forbids rewording a claim
to survive its own measurement, and this is the strong form of that: a route naming
no sentence is not a softer version of *the reason each story appears is a sentence
you wrote*, it is that claim deleted, and it would leave the interest route
indistinguishable from `convergence` in the reader's eyes. Recorded because it is
obvious, and an obvious move that is refused only implicitly comes back.

## The holdout travels to Phase 1

ADR-0018 re-attached ADR-0012's reopening condition — *a corpus with enough
hand-labelled admitted entries to hold one out* — to this ticket, and priced it:
**if this ticket produces a candidate, the holdout becomes its price.** No candidate
survived, so the price is not owed.

It is **not waived and not ticketed.** It travels to Phase 1 alongside
`positioning.md` §7.1a's 48-vs-73-Publisher staleness and ADR-0016 §9.2's
provisional alarm value, on ADR-0018's own three reasons, all of which still hold:
a ~9-point holdout cannot site anything; the labels would be against a single
snapshot that `source-register.md` §8.1 shows understates its own older days; and
there is still no selector for it to evaluate. A ticket that needs a running
pipeline could never reach this map's frontier, and filing one would be filing a
ticket that cannot close.

## Consequences

- **Nothing in the shipped model changes.** No new column, no new bar, no re-embed,
  no migration. The 30-day replay figures ADR-0018 reported stand unchanged, and
  under §9.1 they justify nothing here either.
- **The 4-of-8 defect stands, still with its number attached.** ADR-0018 accepted it
  on the ground that *a defect with a number attached is fixable*; this ADR is that
  ground being honoured rather than quietly dropped. The claim in ADR-0011 is **not**
  softened.
- **A second lever the reader holds is measured inert.** #47 found narrowing a
  statement inert; this finds enriching one inert. Both are recorded in
  `ranking-model.md` §6, and together they are the strongest support
  `positioning.md` §8.4 has for refusing a guidance surface: there is nothing
  honest to guide the reader **toward**. §8.4's refusals gain no reopening condition
  from this.
- **`GAP` keeps being computed and stored, unchanged.** ADR-0018's reasoning is
  untouched — it is free, it renders nowhere, and it is the one class of evidence a
  future selector can only accumulate by running.
- **`ui-and-ia.md` §7 is not reopened.** Its per-Interest state reports a fact about
  a statement (*this cannot match*); *"add some examples"* is advice this ADR has
  just measured to be worthless, which is exactly where ADR-0009's line falls.
- **This term does not enter `CONTEXT.md`**, for ADR-0018's reason: the glossary
  names what the product has and the words it refuses, and a diagnosis belongs where
  its evidence lives.

## What would reopen this

**A knowledge source, not a quantity.** Concretely: a pinned cross-encoder or a
larger embedding model whose cost is justified against ADR-0008 with a real Phase-1
compute budget, or a stored fact about the corpus's proper nouns that is not derived
from the same embeddings. All three are Phase 1 or later by construction.

**What will not reopen it:** a fifth arithmetic quantity over the stored vectors
(the class is closed, twice over), a rate computed on 8 labels in either direction,
or a longer exemplar list. A reopening must answer the Grok entry the way ADR-0018
required — and now also explain why it is not the exemplar candidate wearing more
words.
