# Ranking model — what earns a place in a Brief

Settled by
[Specify the ranking and interest model](https://github.com/SaKaNa-Y/Zis/issues/9).
Read [`CONTEXT.md`](../CONTEXT.md) first; this document uses its terms without
redefining them.

**Nothing here is provisional any more.**
[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21)
measured the four values this document used to mark, against the real corpus and
a handwritten Interest Profile, and three of the four came back differently than
the model expected: `T+` is sited per rung as designed, `H` is confirmed
unchanged, **`T−` has no admissible value and `E4` is cut**, and the **`citing`
rung's definition was wrong**. Those changes are written in below rather than
appended, so this document reads as the settled model.

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
| `DECAY(s)` | `0.5 ^ (FRESH(s) / H)`, `H` = **36h** |
| `REL+(s,u)` | `MAX` over the reader's Interests of `cos(vec(s), vec(i))` (ADR-0003) |
| `T+[basis]` | positive relevance bar, **one value per `text_basis` rung** — `own` **0.70**, `citing` **0.67**, `slug` **uncalibrated** (§4) |
| `GAP(s,u)` | `REL+(s,u) − ` the **second**-highest `cos(vec(s), vec(i))`. How far the named Interest beat the runner-up (§6, ADR-0012) |
| `T_gap` | the flatness floor, **provisional 0.038 and explicitly uncalibrated** (§6). Computed and stored; **never rendered** |

`H` = 36h is **measured, not assumed**: on the corpus the median gap from a
Signal's first Citation to its second distinct Publisher is **30.4h** and to its
Nth is **48.8h**, so 36h sits between them. It orders the `convergence` route
and gates nothing (below), so this was the cheapest of the four numbers and it
needed no change.

### There is no `REL−` and no negative Interest

The model used to carry a `REL−` quantity, a `T−` bar, and an `E4` eligibility
test suppressing Signals that matched a **negative** Interest. **All three are
cut from v1**, on measurement rather than on argument.

`T−` was specified as "deliberately **lower** than `T+`", from a sound
asymmetric-cost argument: a false admission shows the reader the exact thing they
wrote down that they did not want, and under sealing that is permanent. The
argument is fine. The number does not exist. On `bge-small-en-v1.5` the `REL−`
and `REL+` distributions are **the same distribution** — over the eligible set
`REL−` runs 0.512–0.725 against `REL+` 0.524–0.774 — because a cosine of ~0.60
against "cryptocurrency, blockchain, web3, and NFTs" does not mean *this is
crypto*, it means *this is technology writing*. Measured over the replay window,
`T−` = 0.60 suppresses 23 of 86 eligible Signal-days, 0.55 leaves **two**
admissions standing, and 0.50 empties every Brief. **Every value below `T+`
deletes the product**, and the one value that suppresses only the extreme tail
sits *above* `T+`, at which point the bar is doing nothing worth a schema column.

This follows [#6](https://github.com/SaKaNa-Y/Zis/issues/6)'s precedent exactly —
it cut the embedding second pass from detection **because it measured it** — and
it is the same shape as ADR-0006's own rule: a mechanism that cannot do the job
it is named for is disqualified, and "suppressed because it slightly resembled a
thing you dislike" is not a sentence a reader could check.

Two consequences, both small, which is part of why the cut is cheap. **Nothing in
the interface changes**: `ui-and-ia.md` §7 is a flat numbered list of statements
and never had a positive/negative split to remove. And **ADR-0006's third
rejected proposal still stands** — subtractive negative Interests were rejected
there because a strong positive can outvote a strong negative; that reasoning is
untouched, and the clause of ADR-0006 that replaced subtraction with *outright
suppression across both routes* is **superseded here**, since there is now
nothing to suppress with.

**One Interest kind, not two.** An `Interest` is a statement of what the reader
wants. A reader who wants less of something says so by not writing it down.

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
E4  no ReadState(u, s)                already met via Bookmarks or the archive
```

There were five tests. The negative-Interest suppression that used to sit at
`E4` is cut — see §1 — and the numbering closes up rather than leaving a hole,
because a reserved gap is an invitation to refill it.

`E1` is the product's thesis in one line. Without it the Brief is a
relevance-filtered river of single-source Items — 4,910 of the 4,937 Signals in
the measured corpus are Strength 1 — which is the anxiety inbox Zis exists to
delete, and it would leave the relevance bar discriminating over 4,937 candidates
instead of 27, making its value arbitrary.

`E1` is also the reason the relevance bar's exact value matters far less than the
model assumed, and §9 has the measurement: over a 30-day replay of the corpus's
own Citation timestamps, **18 days in 30 carry no eligible Signal at all**.

## 3. Admission — two routes, nested, not orthogonal

An eligible Signal is admitted by exactly one route, recorded on the
`BriefEntry` as its **Admission**:

```
MATCHED(s,u)  =  REL+(s,u) >= T+[text_basis(s)]  AND  GAP(s,u) >= T_gap

interest      MATCHED(s,u)

convergence   STRENGTH(s) >= 3  AND  NOT MATCHED(s,u)

not admitted  STRENGTH(s) == 2  AND  NOT MATCHED(s,u)
```

**The `GAP` conjunct is ADR-0012 and it is not a second relevance bar.** `T+` asks
whether the best Interest is close enough; `GAP` asks whether there *was* a best
one, or whether every Interest scored the same and the winner is rounding noise.
A Signal that clears `T+` on a flat ranking has no explanation to render, so it
does not take the interest route — see §6, which is where the condition is
justified, because it is a constraint the explanation imposes on admission rather
than the other way round (ADR-0006).

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

| rung | text | share of corpus | `T+` |
|---|---|---|---|
| `own` | the ingested Item's title + extracted summary | **17.0%** | **0.70** |
| `citing` | **the citing Publisher's anchor text for that exact link** — one description, not a concatenation | **78.9%** | **0.67** |
| `slug` | the canonical URL's path, tokenised, plus its host words | **4.1%** | **uncalibrated** |

**The `citing` rung's definition is a correction, and it is the largest single
finding of the calibration.** It used to read "the concatenated titles of the
Items citing it". Measured on the eligible set, that definition and the anchor
text agree on the argmax Interest **2 times out of 26** — and since the argmax
*is* the why-text (§6, ADR-0003), that is the share of explanations the two
definitions disagree about, on the rung that carries **79% of the corpus**.

The reason it is wrong is specific rather than statistical: the corpus's densest
citers are newsletters, and a newsletter Item's **title is the issue title**.
`Zuckerberg's manifesto 🤖, Elon's $1T shortcut 💰, local models won't win` is
about every story in that issue and therefore about none of them. Concatenating
eight of those produces a long, confident, on-topic-*sounding* vector attached to
the wrong subject — so it scores **higher** than the correct text:

```
anthropic.com/research/riemann-zeta       (Strength 3)
  concatenated titles   REL+ 0.765  -> "Frontier model releases … pricing"
  anchor text           REL+ 0.643  -> "AI research published by the frontier
                                        labs … scientific results"
```

The second explanation is the right one and it scores 0.12 lower. **A bar on
`REL+` over concatenated titles therefore selects for pollution**, which is the
opposite of what a bar is for. Anchor text is also *free* — it arrives in the
same feed body and issue page the Citation itself is harvested from, so this
costs one extra column, not a fetch.

Two clauses ride with it. **Longest anchor wins** where several Publishers cite
the same link, because "Learning more about Claude's mathematical capabilities"
beats "the spec" and "announced". And where a citing Publisher gives no anchor
text — a Bluesky post, an HN submission — the **citing Item's title is used, and
for those it genuinely is a description of the link**; only excerpt-newsletter
titles are excluded.

`T+` is keyed by rung because cosine similarity is not portable across text
lengths. **That premise is correct, but only under the corrected definition** —
which is worth recording, because as written the keying was pointless. Measured
per-rung medians:

| rung | as written (concatenated titles) | corrected (anchor text) |
|---|---|---|
| `own` | 0.656 | 0.656 |
| `citing` | 0.656 | **0.617** |
| `slug` | 0.604 | 0.604 |

Concatenation had dragged `citing` onto `own`'s scale by making short texts long,
so one global threshold would have been *right* — and right for the wrong reason.

**`T+[slug]` is deliberately left uncalibrated, and that is a finding rather than
an omission.** Zero of the 27 eligible Signals sit on the `slug` rung, so the
corpus contains no evidence about where its bar belongs. Its full-corpus
distribution is both low and narrow (median 0.604, p90 0.647, max 0.732 — against
`own` reaching 0.855), which is what a rung with almost no information in it looks
like. Implementations must **treat a `slug`-rung Signal as failing the interest
route** until a corpus with eligible `slug` Signals exists to site a value
against. Such a Signal can still be admitted by `convergence`, which reads no
text at all.

**The floor under all three numbers**, and the reason none of them is set lower:
the reader's own Interest statements have a **median pairwise cosine of 0.659**
with each other (n=153 pairs). A bar below that is not measuring topical match —
it is measuring "this is writing about software", which every Item in the corpus
is.

One share to correct while it is in view. #9 recorded that 3,607 of 4,986 Signals
have no ingested Item, implying ~28% would land on `own`; **17.0% actually do**.
The gap is the vehicle guard: an HN thread and a single-link Bluesky post are
Items with a `self` Citation, and after #6's merge rules their Link sits inside
the target's Signal — but a discussion **of** a story is not the story, so they
are excluded from `own` and their text carries the `citing` rung instead. **83.0%
of Signals embed from something other than their own text**, against the ~73%
this ticket assumed.

**A Signal is re-embedded when its rung improves** (`slug → citing → own`), with
`text_basis` and an `embedding_version` stored alongside the vector. The
consequence, stated rather than discovered later: a Signal that failed the
relevance bar yesterday can pass today because its *text* improved rather than
its Strength. That is correct, it is bounded by `E2`, and it cannot disturb
sealing — a cut `BriefEntry`'s why-text is frozen, so re-embedding never alters a
Brief already cut.

**The precedence stands, and the rung is a coverage decision rather than a quality
one** — **ADR-0013**,
[Re-decide which text_basis rung is chosen when more than one is available](https://github.com/SaKaNa-Y/Zis/issues/42).
This section used to call it a measured open defect, on #35's finding that two of
four `own`-rung eligible Signals name better on the losing rung. **Re-measured
with the eligibility filter dropped, that accusation does not survive**, and the
two facts that kill it are properties of the corpus rather than of the profile.

**The population is 44 Signals, not 849.** The precedence only fires on an `own`
Signal that *also* has a `citing` text; 805 of the 849 carry only a `self`
Citation, so the ladder never has a choice. Of the 44, **13** are admitted by
`REL+` and **3** survive `T_gap` — 0.06% of the corpus.

**Both candidate tiebreaks select for garbage.** The predicted objection was the
cross-bar problem, and it is small — "higher `REL+`" adds 6 admissions and exactly
1 clears only the 0.67 bar. What disqualifies both is that **29 of the 44 `citing`
texts are under 25 characters** (`Docs`, `v1.0.0`, `published`), and short text
against short Interest statements inflates cosine, so higher `REL+` picks them 14
times and higher `GAP` 11 times:

```
go.dev/blog/16years                     (Go's 16th-birthday post)
  own     REL+ 0.647  -> "Frontier model releases from the major AI labs"
  citing  REL+ 0.714  -> "Vue 3 Composition API and the Vue ecosystem"
          citing text, in full: `v1.0.0`
```

That is this section's own largest finding running in the other direction — **a
bar on `REL+` over polluted text selects for pollution**, whether concatenation
made short texts long or a bare anchor made them short.

**And the flagship failures are `own`'s composition, not the ladder.** `own` is at
the 1200-char cap on essentially every one of these Signals, and in 15 of the 44
the `citing` anchor quotes the Item's own title — so the contest is *title + body*
versus *title*. Measuring the title alone, which this section never did:
`blog.cloudflare.com/the-agentic-internet` is `own` 0.647 → *"Coding agents"*,
`citing` 0.780 → *"RSS, feeds, and the open web"*, and **title-alone 0.793 →
*"Coding agents"***. The `citing` text there is `own`'s title verbatim plus
`(9 minute read)`, and it names *worse*; `own` lost because the body diluted a
title that was already right. On `kitesurf` the two texts differ only by a
`(16 minute read)` suffix and **name different Interests**, which is the noise
floor rather than a signal about rungs.

**The real defect is therefore re-addressed at its own address** —
[Decide what the `own` rung embeds](https://github.com/SaKaNa-Y/Zis/issues/49),
a 19× larger lever, governing all 849 `own` Signals. Nothing here answers it:
title-alone wins 23 of 44 and loses badly on a thin title (`Go's Sweet 16`, 0.516
against 0.647), so "embed the title" is measured wrong too.

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
and only its `interest_id` is stored — listing three matches would let a vague
statement hide in the crowd.

### The argmax alone is not a good enough explanation

The justification that used to sit in the paragraph above — *ADR-0003's feedback
loop works by making a vague Interest visible as the stated reason on Signals that
should not have surfaced* — was **measured and withdrawn** by
[Decide whether the argmax Interest is a good enough explanation](https://github.com/SaKaNa-Y/Zis/issues/35)
(**ADR-0012**). Read that ADR before touching this section.

`T+` decides admission and #21's measurement says it can. **The same cosine also
decides the why-text, and there it does not hold up.** Of the 8 eligible Signals
clearing `T+` per rung, **4 name an Interest the reader would not have written**,
and the error does not fall as `REL+` rises — a browser announcement explained by
*"Drizzle and other TypeScript ORMs"* at 0.704, a GitHub changelog explained by
*"RSS, feeds, and the open web"* at 0.670.

**The loop cannot repair those.** It requires the wrong winners to be the *vague*
statements; measured against each statement's mean cosine to the reader's other 17,
three of the four are among the **sharpest** in the profile (*"RSS, feeds, and the
open web"* ranks 16th of 18 on vagueness). The reader is shown a tight, specific,
well-written sentence attached to the wrong story, with nothing to edit.

**So a why-text is admissible only if the ranking that produced it was not flat**
— the `GAP` conjunct in §3. The mechanism is §10's floor taken one step further:
the reader's statements sit at a median pairwise cosine of **0.659**, so a generic
text scores about the same against all of them and the winner is decided by noise,
while a specific text makes one Interest pull clear. **Flatness is the profile
saying it has no opinion, in the only vocabulary it has.** On the admitted set the
three unambiguously correct why-texts are the three largest gaps, with no overlap.

**`T_gap` is provisional at 0.038 and uncalibrated**, on the `T+[slug]` precedent
— fitted on 8 labelled points with no holdout, and two different quantities
separated them equally well, which is the signature of fitting rather than
measuring. Re-site it before quoting it as evidence. Unlike `T+[slug]`,
"uncalibrated" cannot mean "fails the route": `slug` excluded 4% of the corpus,
this would delete the relevance mechanism entirely.

**Failing `T_gap` fails the interest route outright**, and the Signal can still
arrive by `convergence` at Strength ≥3. There is deliberately no third state:
[#10](https://github.com/SaKaNa-Y/Zis/issues/10) puts no badge anywhere in the
product and makes the section heading the explanation, so *"matched, weakly"* has
nowhere to render, and a section invented to house it is a badge under another
name.

**`GAP` is stored and never rendered.** `positioning.md` §8.2 refuses a relevance
margin on the Signal page because *Strength is countable and a cosine is not*, and
a difference of two cosines is doubly uncountable. That refusal stands unamended:
what it bans is **showing** a margin, not **gating** on one.

**The price, recorded rather than discovered later.** Over the 30-day replay at the
settled bars, `T_gap` takes the interest route from **6 entries to 1**; Brief
entries 10 → 5, trailing-14 median 1 → 0, empty days 21/30 → 25/30. No floor keeps
more than one entry without also keeping a clearly-wrong one. This is §9's rule
applied, not an exception to it: a bar that misses the density target is reported
as miscalibrated, never lowered.

**What `T_gap` suppresses but cannot diagnose.** Two of the four failures — a
software-job-market essay, a GitHub product changelog — have **no right answer
anywhere in the 18 statements**, so the argmax was not choosing badly among
candidates; there were none. That fault is **not detectable at runtime**: both the
gap to 2nd and the spread to 5th interleave it with genuine near-misses, and it is
the judgement the cosine already failed at. `T_gap` suppresses both faults
together. Coverage is
[Decide whether the Interest Profile carries the why-text it is asked to](https://github.com/SaKaNa-Y/Zis/issues/41)'s
question, not this section's.

### Interests are written in English

A consequence of the two rules above, recorded here because it is not obvious and
because nothing enforces it in code
([#24](https://github.com/SaKaNa-Y/Zis/issues/24)).

The matched Interest is rendered **verbatim from a stored column**, so the
why-text's language is whichever language the reader wrote that Interest in.
There is no translation step available: adding one would put a nondeterministic
LLM call on the relevance path, which a sealed Brief's reproducibility
requirement already refuses (#14).

More decisively, embeddings are `bge-small-en-v1.5`, which is **English-only**
(#3). A Chinese-language Interest therefore embeds to a meaningless vector, never
wins the `MAX` cosine in §1, and **silently stops being part of the relevance
mechanism** — with no error, no empty state, and nothing on the Interests page to
say so. Since `CONTEXT.md` makes the Interest Profile the *only* relevance
mechanism, a silently inert Interest is a hole in the whole product.

So: **Interests are English.** Not enforced — script detection is a heuristic and
would be wrong on a mixed statement like `Rust 的 async 运行时` — but surfaced, as
a per-Interest note on the Interests route (`ui-and-ia.md` §7).

One thing this constraint does **not** reach: whether a Chinese-language *Item*
can match an English Interest. That is the map's **Multilingual relevance**
question, it has its own trigger, and it is not this rule.

## 7. Cut time

One Brief per reader per local day, cut at a fixed hour in a stored
`User.timezone`, on the **hourly** cron tick that crosses it, with a uniqueness
guard on `(user_id, local_date)` so the cut is idempotent and safely retryable.
The cadence is hourly rather than 15-minute per
[ADR-0008](./adr/0008-the-neon-wake-is-the-unit-of-compute-cost.md), and the cut
deliberately rides an existing ingestion wake rather than taking a schedule of its
own — see [`docs/ingestion-pipeline.md`](./ingestion-pipeline.md) §2.

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

### The target is currently missed by a factor of five, and not by the bar

This is measured, and it is the most important number the calibration produced.
Replaying the corpus's last 30 days from **Citation timestamps** — never from
dividing 27 by anything convenient — the eligible supply is:

| | |
|---|---|
| days with **zero** eligible Signals | **18 of 30** |
| most eligible Signals on any one day | **3** |
| trailing-14-day median Brief size | **1** |

and that median is **1 at every bar tested, including a bar low enough to admit
every eligible Signal**. At a flat `T+` = 0.50 the 30 days yield 21 admissions; at
a flat 0.70, **5 interest plus 4 convergence**. At the settled **per-rung** bars —
`own` 0.70 / `citing` 0.67 — it is **6 interest plus 4 convergence**, one more,
because the citing bar is the lower of the two. The trailing-14 median never moves
off 1, because it is not set by the bar — it is set by the 18 days on which `E1`
has nothing to offer at all.

**`T_gap` (§6, ADR-0012) makes this materially worse, and that is accepted rather
than traded away.** Over the same replay it takes the interest route from **6
entries to 1**: Brief entries 10 → 5, trailing-14 median **1 → 0**, empty days
21/30 → 25/30. No floor tested keeps more than one interest entry without also
keeping a why-text the reader would not have written. This section's mechanism is
what governs that outcome — the target is missed, so the miss is **reported**, and
neither `T+` nor `T_gap` moves to close it. A floor lowered until the Brief fills
would be an adaptive bar reintroduced through the explanation instead of through
the score.

One consequence worth stating plainly, because no test we have written trips on
it: with the interest route at one entry per month, **four fifths of a Brief
arrives by `convergence` with no Interest named at all**. `positioning.md` §7.1's
separability falsifier still does not fire — every surviving interest entry is
Strength 2, so co-citation alone would not have surfaced it — but a claim can
hollow out without falsifying, and the standing escalation onto
[#11](https://github.com/SaKaNa-Y/Zis/issues/11) is now load-bearing for the
*position*, not only for density.

So the escalation above resolves, today, entirely onto its **first** branch.
**`T+` is not what is binding and lowering it would buy nothing**: there is no
value of `T+` at which this corpus reaches a trailing-14 median of 5, so the
"explicit edit to `T+`" clause is not the available lever and must not be reached
for first. What binds is **distinct-Publisher supply**, which is
[#11](https://github.com/SaKaNa-Y/Zis/issues/11)'s work.

Two things this does **not** license. It is not a reason to raise or lower the
ceiling (#14 upheld) and it is not a reason to weaken `E1` — a Strength-1 floor
would admit 4,910 of the corpus's 4,937 Signals, which is the anxiety inbox the
product exists to delete. And it is **not** evidence that the product is
unworkable: a short Brief is honest by construction (#14), and the honest reading
of these numbers is that Zis currently has a **source-list problem wearing a
threshold's clothes**.

## 10. How the numbers were sited, and what they are conditional on

`T+` per rung, `T−`, and `H` were not settleable by argument, so they were not
argued. This follows the clustering ticket's precedent: it killed the embedding
second pass **because it measured it**, and a threshold guessed here would have
been the same class of error — which is exactly what happened to `T−`, a bar
whose specification was derived from a correct argument and whose value does not
exist.

[Calibrate the relevance bar against the corpus](https://github.com/SaKaNa-Y/Zis/issues/21)
embedded the corpus #6 measured (1,395 Items / 6,468 Citations / 4,986 Signals
from 47 Sources) against a handwritten 18-statement Interest Profile, locally via
`transformers.js` under #3's pin-the-model finding — no provider call, no quota,
no key. Prototype and findings:
[`.scratch/zis/prototype/PROTOTYPE-calibration/`](https://github.com/SaKaNa-Y/Zis/tree/main/.scratch/zis/prototype/PROTOTYPE-calibration).

**Three conditions every number here is contingent on**, stated so a later
disagreement can check them rather than re-derive them.

1. **The model.** All of it is `bge-small-en-v1.5` at 384 dimensions. Cosine
   values are not portable across embedding models, so **changing the model
   invalidates `T+` and `T−` together** — and per the map's multilingual-relevance
   note, "pin the model, not the vendor" only holds *within* a fixed dimension.
   A model swap is a re-calibration, not a config change.
2. **The Interest Profile.** `T+` is sited relative to a floor — the median
   pairwise similarity *between* that reader's own statements, 0.659 — so a
   profile of broader or narrower statements moves the floor and the bar with it.
   The bar is a property of the pair (model, profile), not of the corpus alone.
3. **The corpus window.** The per-day counts come from the last 30 days the
   corpus covers. The 2,064-day span behind it is **backfill**, and a rate taken
   over that span would be the error §8 warns about.

**What the calibration did not settle, and routed onward — now settled.** Whether
the argmax Interest is a good enough *explanation*: it is **not**, and
[#35](https://github.com/SaKaNa-Y/Zis/issues/35) (**ADR-0012**) answered it with a
second condition on the why-text rather than a change to `T+` or to how the winner
is picked. `T+` decides admission and the measurement says it can; the same cosine
also decides the why-text and there it is wrong on half the admitted set, with the
error flat in `REL+`. The mechanism is condition 2 above, taken one step further
than this section took it: the 0.659 floor does not only set where the *bar*
belongs, it means a generic text scores alike against every Interest, so the
argmax over a flat ranking is noise. See §6 for `GAP` and `T_gap`.

**A fourth condition, added by that answer.** `T_gap` is conditional on the same
`(model, profile)` pair as `T+`, and **more tightly** — it reads the profile's
internal separation directly rather than sitting relative to it. A model swap now
invalidates three numbers, not two. `T_gap` itself is **fitted rather than sited**:
8 labelled points, no holdout, and two candidate quantities that separated them
equally well. It is a placeholder with a mechanism behind it, which is a weaker
thing than the bars above.
