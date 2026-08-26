# Positioning

Settled by
[State Zis's positioning against existing RSS readers and aggregators](https://github.com/SaKaNa-Y/Zis/issues/26),
plus [ADR-0011](adr/0011-a-claimed-advantage-must-cost-a-competitor-something.md).

**Who this is for.** Not a prospective user — Zis has one reader, no signup route,
and no funnel. This document is written for whoever is deciding what to build
next, and its job is to be a **refusal test**: does this proposal serve the claim?
The comparisons exist to keep the claim sharp enough to refuse things with. A
claim that cannot distinguish Zis from Feedly refuses nothing.

---

## 1. The claim

> **Zis is a bounded daily tech brief where the reason each story appears is a
> sentence you wrote, and the number behind it is one you can count by hand.**

> Every other tech brief asks you to trust its selection. Zis's selection is a
> sentence you wrote plus a row count you can check.

Compressed against the field: **Zis is NewsBlur's inspectability over Techmeme's
corpus at TLDR's volume.**

Both halves of the first sentence are load-bearing and they are separable. The
reason is **yours** — an `Interest` you wrote, rendered verbatim
([ADR-0003](adr/0003-interest-profile-is-a-set-of-statements.md)), not a label the
system inferred about you. And the arithmetic is **verifiable** — the why-text
reports origin-excluded Strength, and the Signal provenance page lists every
`Citation` behind it, so a reader can count the rows and get the system's number
([`ui-and-ia.md`](ui-and-ia.md)).

Note what the claim does *not* say. It does not say the summaries are better; the
prior-art study found summary quality differentiates nothing and that "placement
beats model quality" in every AI-reader review. It does not say the corpus is
bigger; TLDR draws on 3,000–4,000 sources. It does not say the selection is
smarter than a human's; §4 concedes that it is not.

---

## 2. The test

[ADR-0011](adr/0011-a-claimed-advantage-must-cost-a-competitor-something.md):

**A claimed advantage is admissible only if a competitor would have to give
something up to copy it.**

This governs **claims**, not features. ADR-0009's admissibility test governs what
may be *built*; this one governs what may be *asserted as a reason for building
it*. A difference anyone could add without subtracting is recorded as **table
stakes** (§5) and may not be used to justify work.

The test replaces the weaker "a competitor could ship it next quarter" framing the
ticket proposed. That one is about *time*: it dates, and it makes the answer
depend on guessing someone's roadmap. This one is about *cost*, and it is the
reason "better summaries" fails — nobody gives up anything to write a better
prompt.

---

## 3. The two structural differences

Two, not six. A list of six advantages is the shape of a product that has none.

### 3.1 The explanation constrains the formula

[ADR-0006](adr/0006-admission-is-absolute-bars-not-a-score.md): a term that cannot
be rendered into the why-text from stored columns alone is disqualified. So there
is no score, no weighted sum, no Publisher trust weight, and no velocity term. The
explanation is not generated *about* the decision — it **is** the decision, and
the deterministic replayable spine ([ADR-0002](adr/0002-signals-are-created-eagerly-and-only-merged.md),
[ADR-0004](adr/0004-alias-and-accrual-are-different-operations.md)) is what makes
it checkable rather than plausible.

What each competitor would have to give up to copy it:

| Competitor | The give-up |
|---|---|
| Feedly (Leo) | Delete Leo. A vote-history model has no stored column to render, and Leo is the paid tier. |
| Techmeme | Fire 26 editors. Editorial judgement is unexaminable in principle — that is what judgement means. |
| TLDR | Stop using a practitioner's judgement, which is the entire product. |
| Readwise Reader | Nothing to give up here, because it does not select — it summarizes what you already saved. |
| NewsBlur | Unhook classifiers from subscriptions (see 3.3). |
| Folo | Ship a described mechanism at all. Its marketing states none. |

### 3.2 Admission is an absolute bar, never a top-N cut

[ADR-0006](adr/0006-admission-is-absolute-bars-not-a-score.md) and
[#14](https://github.com/SaKaNa-Y/Zis/issues/14): two nested absolute routes —
`interest` at Strength ≥2 with an Interest match, `convergence` at Strength ≥3
without one — no quota, no reserved slot count, and a Brief that may be honestly
short and says so.

This was the surprise of the exercise. **Every competitor's digest is a top-N
cut.** Readwise caps at 20–25 posts plus five saved; TLDR ships 8–15 links every
weekday. Giving that up means shipping days with one entry, and a subscription
product cannot do that without churn. Zis has no churn to lose. **The give-up is
commercial, not technical**, which is the strongest kind — it does not close as
engineering gets cheaper.

The honest scale note: 5–12 is below every documented precedent, and thin days are
the risk, not busy ones. **That is handled by a rule, not by a number**
([ADR-0016](adr/0016-brief-density-is-an-observation-not-a-target.md)): no change
to `E1`, `T+` or `T_gap` may be justified by brief density, so the bar cannot be
lowered to make thin days look fuller. The ≥5 target this line used to cite is
retired — it was denominated in the one quantity a lowered bar inflates. What is
watched instead is a **supply regression**, and what is promised about Brief size
is nothing.

### 3.3 Why NewsBlur is the hard row, and still loses

NewsBlur is the competitor that already ships checkable selection, and it is not
close to Feedly on this: thumbs up/down on authors, tags, title keywords, full
text, URLs and regex; natural-language classifiers; a **"Test on this story"**
preview; colour-coded results; and a stated conflict-resolution rule (green always
wins). The prior-art study calls it "the single most valuable AI-adjacent
mechanism found in this survey" and "the clearest existing answer to *every
surfaced item explains why it surfaced*."

It loses the test for a different reason than the others. **NewsBlur's classifiers
run over feeds you subscribed to, with an unread count and the full firehose
behind them.** Zis's Interests run over a global corpus nobody subscribed to, and
the output is bounded and sealed. To copy Zis, NewsBlur would have to give up the
count, the firehose, and subscription-as-corpus — which is its entire surface.

Feedly and NewsBlur are opposite failures of the same idea: Feedly's selection is
inspectable in principle and never in practice, NewsBlur's is genuinely
inspectable and attached to an inbox.

---

## 4. The comparisons

Seven rows. Each states what Zis does that the competitor does not, **and where
the competitor wins.** The concession sits in the row rather than in a later
section on purpose: a concession three pages from its claim reads as a
disclaimer; one in the same row reads as calibration.

### Techmeme

**What Zis does that it does not.** Selection is tuned to interests one reader
wrote, and every entry names which one. Techmeme publishes one front page for
everybody.

**Where Techmeme wins.** General tech salience, with lower latency, staffed 3
full-time plus 23 part-time editors across five continents for near-24×7
coverage. It has run the same link-graph clustering engine for twenty years. If
the Interest Profile is weak, Zis degrades into a worse-latency Techmeme — that
is the falsifier in §7, and Techmeme is the product it fails *into*.

**Evidence, not a competitor: memeorandum.** The same engine with the editors
removed, still running. Its documented failure modes — unmerged duplicate
clusters, stale top items, thin clusters from correlated bursts, headlines
carrying the source's spin — are the control experiment for Zis's spine. Three of
the four are fatal at 5–12 entries a day, where one duplicate is a 8–20% quality
regression. Zis's answer is deterministic rules plus one-click merge/kill, with
LLM adjudication rejected because sealing makes replayability a correctness
property ([#14](https://github.com/SaKaNa-Y/Zis/issues/14)).

### Folo

**What Zis does that it does not.** State a mechanism. Folo's marketing is
entirely generic — "AI reads the internet for you," "keep only the signal" — with
no described mechanics, no stated cap, and no position on unread counts. Zis
publishes its clustering rule, its admission bars, and its arithmetic.

**Where Folo wins.** Feature surface, today: digest emails, chat, AI source
discovery, transcription, mobile apps. Its own Show HN cites the same "1,000+
unread" motivation Zis was built against, so it is a strong feature-parity threat
and a weak differentiation threat.

### Nuzzel / Sill

**What Zis does that it does not.** Have a relevance mechanism at all that does
not require a social graph. Sill ranks by unique accounts sharing a URL among
people you already follow.

**Where Nuzzel/Sill wins.** Relevance for free. The follow graph did enormous
unacknowledged work — it filtered for relevance before ranking ran, and it was
continuously curated by the user for unrelated reasons. Zis has no graph, so
co-citation alone measures general tech salience, and the Interest Profile is
doing a job Nuzzel got gratis. That is the single most load-bearing concession in
this document.

**What Zis takes from them.** Rank by distinct **Publishers**, never total
mentions, so one loud voice cannot manufacture a cluster
([`CONTEXT.md`](../CONTEXT.md), *Strength*). And the lesson from Nuzzel's decay —
"you'd sometimes see the same post six times in a row" — that co-citation systems
die of unhandled reshare/alias semantics, not of bad similarity math, which is why
[#6](https://github.com/SaKaNa-Y/Zis/issues/6) enumerated them per adapter before
writing clustering code.

### Feedly / Inoreader

**What Zis does that it does not.** Make selection legible. Feedly's dominant
complaint underneath the pricing gripes is that users cannot tell whether Leo is
working; the long-time paid users who report it works add the qualifier "after
setup and training." Zis's configuration is visible, editable, and rendered back
verbatim as the reason.

**Where Feedly/Inoreader win.** Coverage breadth, mature mobile apps, OPML
portability, and — Inoreader specifically — server-side near-duplicate filtering
with a configurable comparison period, plus bring-your-own-key model choice.
Inoreader's own migration of dedup from client to server is a rule Zis inherits:
dedup happens before the Brief is composed, never at render.

### NewsBlur

**What Zis does that it does not.** See §3.3. A global corpus instead of
subscriptions, bounded and sealed output instead of a firehose with a count.

**Where NewsBlur wins.** Granularity, and it is a real win: regex, per-author and
per-tag rules are finer instruments than an embedded sentence, and the "Test on
this story" preview shows the reader their training working — which Zis has no
equivalent of, and **will not build**: the preview is refused outright by
[#27](https://github.com/SaKaNa-Y/Zis/issues/27) (§8.1). This row is therefore a
standing concession, not an open question.

### Readwise Reader

**What Zis does that it does not.** Select. Reader's digest is a cap on things you
already chose to save; Zis decides what is worth your attention out of a corpus
you never curated.

**Where Readwise wins, and it is not close.** Reading and annotating — a real
reading view, highlights, inline Ghostreader summarise/define/translate, and chat
over the whole library. Zis competes on none of it and structurally cannot:
[ADR-0005](adr/0005-no-publisher-html-is-ever-stored.md) stores no publisher HTML,
so a reading view is **unavailable, not unwanted**. This row is the reason that
decision should not get re-litigated: the strongest product at the thing Zis
cannot do already exists, and Zis's title links out to the origin instead.

Two cautions Zis inherits from Readwise's history. Auto-summarisation that stopped
being opt-in drew a backlash specifically about processing *other people's*
content — which is why Zis summarizes only admitted Signals (~10 DeepSeek calls a
day, not ~1,400). And the reviewer verdict that Ghostreader's value comes from
*where* it sits rather than *how good* the model is, with summary quality "good but
not exceptional" versus pasting into a chatbot.

### TLDR

**What Zis does that it does not.** Tune to one reader's stated interests, and
show its work. TLDR ships one edition to a general audience.

**Where TLDR wins, probably permanently.** Judgement. A topic-specialist
practitioner reading everything and picking beats a co-citation count, and it is
not a gap engineering closes. Its mechanics are instructive rather than
threatening: 8–15 links at 2–3 sentences each, a genuine five-minute read, drawn
from 3,000–4,000 sources via RSS and aggregators, curated by freelance editors who
are working engineers. **Zis's honest pitch is not "better than TLDR"** — it is
*TLDR, but the selection is tuned to my stated interests instead of a general
audience's, and I can see and edit why.*

### The substitute for the summary job: a chatbot with a URL pasted in

Named because it is the real alternative to the one job Zis assigns an LLM. It is
free, it is comparable in quality, and it is available to everyone. That is the
whole reason summary quality is not on the claim: the commodity substitute already
exists and is fine. What a chatbot cannot do is tell you which URL to paste, which
is the job Zis actually took.

---

## 5. Table stakes, not advantages

These are real properties of Zis and several are load-bearing internally. None is
admissible as a claimed advantage under ADR-0011, and none may be cited as a
reason to build something.

- **Sealing.** Readwise gives up nothing to seal a digest. Sealing is load-bearing
  *internally* regardless — it made reproducibility a correctness property, which
  is what killed LLM merge adjudication in
  [#14](https://github.com/SaKaNa-Y/Zis/issues/14), and it disarmed the
  irreversibility argument in [#17](https://github.com/SaKaNa-Y/Zis/issues/17)
  and [#24](https://github.com/SaKaNa-Y/Zis/issues/24). But the map's phrasing
  that "sealing is what makes the boundary structural" is a claim about Zis's own
  coherence, **not** about competitors, and it should not be read as positioning.
- **No unread count, no infinite scroll, no "Everything" tab.** Reeder gave up the
  count in a full rewrite and kept the old app alive as *Reeder Classic*;
  NetNewsWire treats anxiety as an explicit design axis. This is table stakes among
  the best clients, not a Zis difference. It stays an invariant on its own merits.
- **The deterministic replayable spine.** Structural but invisible — it is the
  mechanism that makes §3.1 checkable, not a second advantage. Do not list it
  twice.
- **Global-first corpus and API-first sourcing.** No reader can see it. It is the
  answer to "will this still work in three years", not to "why is this better":
  79% of top news sites block AI training bots and 71% block AI *retrieval* bots,
  Cloudflare catches legitimate readers as collateral (Miniflux was blocked for
  matching the substring "Flux"), and Techmeme itself reports crawling has gotten
  much harder. Filed as a **durability argument**.

---

## 6. Where Zis is worse

Three buckets, because the ticket's flat list mixed three different kinds of
thing. A scope choice presented as a weakness invites someone to fix it; a
consequence presented as a shortcoming invites someone to reverse the decision
that caused it.

### 6.1 Weaknesses — genuinely worse than a competitor

- **The reader must write and maintain the Interests, and the product
  underperforms if they don't.** This is the headline concession. Feedly's
  pattern is the warning: it works for users who trained it and disappoints those
  who didn't. Zis makes the same bet visibly instead of hiding it behind a vote
  history, which improves *legibility* and removes nothing.
- **No follow graph, so no free relevance.** See the Nuzzel row.
- **Most Signals have no text to match against.** 3,607 of 4,986 Signals in the
  measured corpus carry no ingested Item at all — **72%** — and the shortfall is
  disproportionately at the high-Strength end, including the flagship Strength-3
  case. Relevance is computed from the best text a Signal has, with the rung
  stored as `Text Basis`.
- **A Brief can honestly be one entry.** Measured supply is thin: max Strength
  anywhere in the corpus is **4**, and a backfill produced 27 Signals at Strength
  ≥2 and 5 at ≥3 — a backfill yield, not a daily rate, so steady-state daily
  supply is materially lower.
- **Granularity.** No regex, no per-author rule, no preview of what an edit would
  do. See the NewsBlur row. The preview is refused rather than pending (§8.1), so
  this stays a weakness permanently — which is the honest place for it.

### 6.2 Scope choices — deliberate, not deficiencies

- **Single user, no signup route.** The account is seeded by migration. Teams and
  shared feeds are Phase 5.
- **English only** — chrome, summaries, and Interests
  ([#24](https://github.com/SaKaNa-Y/Zis/issues/24)). A Chinese Interest embeds to
  a meaningless vector under `bge-small-en-v1.5` and silently stops participating
  in relevance, which is surfaced as a per-Interest note rather than enforced.
- **No email delivery.** The persisted Brief is the canonical artefact; a send
  would add a delivery channel and a provider decision without strengthening
  anything.

### 6.3 Consequences — forced by a decision made for a stated reason

Each of these is stated *with* its reason, so the reason travels with the
limitation.

- **No reading view.** [ADR-0005](adr/0005-no-publisher-html-is-ever-stored.md)
  stores no publisher HTML, which deleted the sanitizer question rather than
  answering it. Unavailable, not unwanted.
- **No images, at all.** [#17](https://github.com/SaKaNa-Y/Zis/issues/17): a free
  thumbnail reaches ~5% of Signals, skewed away from the high-Strength end that
  clears Admission. A feature that fires on one entry in twenty is not a layout.
- **No layout customization.**
  [ADR-0009](adr/0009-a-presentation-control-changes-neither-information-nor-order.md):
  every candidate control changes which information renders or its order. Text
  size and contrast remain adjustable — through the platform, not through
  Settings.

### 6.4 Not on this list

**No unread count, no infinite scroll, no "Everything" tab, no badges.** These are
the product. They belong in §5 as table stakes, never here.

---

## 7. What would falsify this position

Stated as conditions rather than metrics, because Zis has no instrumentation and
does not need any to observe them. **There are two, and they falsify different
things** — a distinction this section got wrong on the first pass and which
[#27](https://github.com/SaKaNa-Y/Zis/issues/27) corrected.

### 7.1 The falsifier of the claim: separability

> **If the Interest Profile selects nothing that convergence would not have
> surfaced anyway — if a reader's Briefs would be the same without their
> Interests — then "the reason each story appears is a sentence you wrote" is
> decoration and this position is wrong.**

This one bites on the claim itself. If the `interest` route only ever admits
Signals that the `convergence` route would have admitted regardless, then the
sentence the reader wrote explains nothing: it is a caption on a decision
co-citation already made, and Zis is a worse-latency Techmeme with a nicer
why-line.

It is observable by corpus replay, which is how it should be checked, and **it is
currently not firing.** Over the 30-day replay at the settled **per-rung** bars
(`own` 0.70 / `citing` 0.67): **6 entries by the `interest` route, 4 by
`convergence`**, and **all six interest-route entries are Strength 2** — below the
convergence threshold, so co-citation alone would never have surfaced any of them.
The Interest Profile is doing separable work today. Re-check this on any corpus
replay, any bar change, and any embedding-model swap.

*(The figure this section carried until
[#35](https://github.com/SaKaNa-Y/Zis/issues/35) re-ran it — 5 and 4 — came from
#21's grid at a **flat** `T+` = 0.70. The shipped model bars `citing` at 0.67, which
admits one more. The conclusion was unaffected, but a positioning document should
not quote a configuration the product does not run.)*

### 7.1a The condition to actually watch: the claim hollowing out without falsifying

**The condition stands; the numbers under it have changed twice and are now back
where they started.** `T_gap`
([ADR-0012](adr/0012-a-flat-interest-ranking-has-no-explanation.md)) took the
interest route from **6 entries to 1** over the same 30 days — re-measured on the
reader's own profile, 6 to **3** — and the claim this section protects was resting
on that. **ADR-0018 has withdrawn the floor**, so the interest route is **6 entries
against 4 by `convergence`** again, and the hollowing this section was written about
was substantially `T_gap`'s doing.

**Keep watching anyway.** The condition is about a general failure — a binary test
reporting *healthy* while the claim it guards goes vacuous — not about one floor,
and the floor's removal bought the entries back at a measured cost of **4 of 8
wrong why-texts** (`ranking-model.md` §6), which is the claim failing *visibly*
rather than quietly. Note also which instrument actually noticed: **the falsifier
never fired, at any floor in the sweep, including the one that reduced the route to
a single entry.** It was this watch that saw the problem, which is a standing
argument for a condition of this shape over a binary one.

This is recorded as a distinct condition because §7.1 is written as a binary and
would report *healthy* all the way down to a single entry, and then to zero only if
that last entry happened to be Strength ≥3. **A claim can hollow out without
tripping a test written that way.** The honest statement of where the position
stands: the mechanism is separable and doing real work, and it is doing it **rarely
enough that the claim's weight rests on supply** —
[#11](https://github.com/SaKaNa-Y/Zis/issues/11) is therefore load-bearing for the
*position*, not merely for density
([`ranking-model.md`](ranking-model.md) §9).

**Stale by register, and it stays stale — the route that was going to fix it does
not.** Every entry count in §7.1 and §7.1a comes off a replay over the clustering
prototype's **48-Publisher** corpus, which had three broken adapters and Cooper
Press triple-counted. `source-register.md` §8 rules those figures **not
transferable** to the 73-Publisher register, and §8.1 adds that a single-snapshot
replay understates its own older days besides. Read them as the shape of an
argument, not as current values.

This section previously routed the re-measurement to
[#54](https://github.com/SaKaNa-Y/Zis/issues/54) on the ground that its `T_gap`
replay would produce current values as a by-product. **It did not, and that is
recorded rather than re-routed**: `argmax-replay.mjs` reads the 48-Publisher cache,
so re-running it against the register needs an interest-and-embedding pass over the
supply prototype's data — a running pipeline this phase forbids. It therefore
**travels with Phase 1**, alongside
[ADR-0016](adr/0016-brief-density-is-an-observation-not-a-target.md) §9.2's
provisional alarm value, rather than becoming a ticket that could never reach the
frontier.

One thing this is not: it is **not** licence to move a bar to buy entries back.
Under ADR-0016 and `ranking-model.md` §9.1, density is not an admissible
justification for moving `E1`, `T+`, or the interest route's selector at all, and a
bar lowered until the Brief fills is an adaptive bar reintroduced through the
explanation instead of through the score. That rule bound in exactly this direction
when `T_gap` was withdrawn: removing the floor *adds* entries, and the decision was
taken on the mechanism alone.

### 7.2 The test of the standing assumption: reader behaviour

> **If the reader stops editing Interests after the first month and never opens a
> Signal provenance page, the standing assumption is wrong: this reader does not
> in fact care about inspectability.**

This is the same shape as Feedly's real failure, and it puts the assumption the
prior-art study flagged — *the user is willing to write and maintain the profile*
— somewhere it can be checked, instead of leaving it in the map's Notes.

**It is not a falsifier of the claim, and the difference is load-bearing.** The
claim is that the mechanism is inspectable and the arithmetic checkable. A reader
who declines to inspect it leaves both halves true; what has failed is the
*product's* bet on that reader, not the position. Reading it as a falsifier of the
claim is what licensed the Interest-edit preview
([§8](#8-refused-and-the-rule-each-fails)) — a feature whose stated job was to stop
this observation from firing, which is adjusting the instrument rather than the
thing being measured. **A falsifier you build a feature to prevent is not a
falsifier.**

## 8. Refused, and the rule each fails

`positioning.md` claims to be a refusal test; this is the list to be refused by.
It is an **index, not a store** — one line and a pointer per row, with the
reasoning left in the rule it cites, so nothing here can drift out of sync with
the ADR that decides it.

| Refused | The rule it fails |
|---|---|
| An "Everything" tab, unread counts, infinite scroll | [#14](https://github.com/SaKaNa-Y/Zis/issues/14) — bounded output. And per §6.4 the absence *is* the product, so it is table stakes (§5), never a claimed advantage |
| A reading view | [ADR-0005](adr/0005-no-publisher-html-is-ever-stored.md) — no publisher HTML is stored. Unavailable, not unwanted (§6.3) |
| A follow graph | [#5](https://github.com/SaKaNa-Y/Zis/issues/5) — `Publisher` is the owning-entity dimension; there is no social graph to ride, and the Interest Profile is the only relevance mechanism |
| Reader-tunable ranking, and layout customization | [ADR-0009](adr/0009-a-presentation-control-changes-neither-information-nor-order.md) — a control is admissible only if it changes neither which information renders nor its order |
| Better summaries | [ADR-0011](adr/0011-a-claimed-advantage-must-cost-a-competitor-something.md) — nobody gives up anything to write a better prompt, and the commodity substitute (a chatbot with a URL pasted in, §4) is free |
| Images and thumbnails | [#17](https://github.com/SaKaNa-Y/Zis/issues/17) — fires on ~5% of Signals, skewed away from the high-Strength end |
| Email delivery of a Brief | [#14](https://github.com/SaKaNa-Y/Zis/issues/14) — adds a delivery channel and a provider decision without strengthening anything |
| Velocity scoring | [ADR-0006](adr/0006-admission-is-absolute-bars-not-a-score.md) — "unusual velocity against a baseline" cannot be rendered into a why-text from stored columns |
| **The Interest-edit preview** — *what would this edit have done to yesterday's Brief?* | [ADR-0011](adr/0011-a-claimed-advantage-must-cost-a-competitor-something.md) and [#17](https://github.com/SaKaNa-Y/Zis/issues/17). See below |
| **Near-miss surfacing** — *"3 Signals came close"*, or a relevance margin on the Signal page | [#14](https://github.com/SaKaNa-Y/Zis/issues/14) and §1. See below |
| **A "matched, weakly" state** — naming an Interest while flagging low confidence | [ADR-0012](adr/0012-a-flat-interest-ranking-has-no-explanation.md) and [#10](https://github.com/SaKaNa-Y/Zis/issues/10) — a flat ranking has no explanation to hedge, and there is no badge anywhere in the product; a section invented to house it is a badge renamed |
| **An aggregate no-coverage note** — *"N Signals cleared Strength 2 and none of your statements had an opinion"* | [#41](https://github.com/SaKaNa-Y/Zis/issues/41) — §8.2 inverted, and it cannot distinguish a profile gap from thin supply. See below |
| **A minimum-coverage requirement on the Interest Profile** — a floor on statement count, or on the areas the statements must span | [#47](https://github.com/SaKaNa-Y/Zis/issues/47) — the fault it would prevent does not exist, and it is a constraint on *reader data*. See below |
| **Guidance to write sharper, narrower Interests** — a nudge on a statement that produced a wrong why-text | [#35](https://github.com/SaKaNa-Y/Zis/issues/35) and [#47](https://github.com/SaKaNa-Y/Zis/issues/47) — sharpness is uncorrelated with correctness, so the lever is inert and the reader would be editing in the dark. See §8.4 |

### 8.1 The Interest-edit preview

NewsBlur's "Test on this story", adapted. Refused by
[#27](https://github.com/SaKaNa-Y/Zis/issues/27) on three independent grounds, any
one of which is sufficient:

- **ADR-0011.** NewsBlur already ships it, so the preview buys no give-up of its
  own. The rescue — *but Zis's preview runs over a global corpus with a bounded,
  sealed output* — spends a give-up §3.3 **already charged** to buy §3.1. Billing
  the same coin twice is how a list of two structural differences becomes a list of
  six.
- **The corpus.** Over #21's 30-day replay at the settled bar, **21 of 30 days have
  no eligible Signal at all** and per-day eligible counts run 0–3. Two days in
  three the preview's answer is *"nothing, still nothing"* whatever the edit — which
  teaches the reader their Interests do not matter, the exact opposite of the job it
  was proposed for. That is [#17](https://github.com/SaKaNa-Y/Zis/issues/17)'s
  consistency rule.
- **§7.2.** Its only positioning justification was defeating a reader-behaviour
  observation that turns out not to falsify the claim.

It is refused **full stop**, not deferred. Thicker supply would change the second
ground but neither of the other two, and a Zis with a corpus dense enough for a
preview to be informative is a different product needing a fresh position — so it
returns, if ever, as a new effort rather than a resumption. **No candidate-set
table enters the Phase-0 schema**; nothing else wanted one.

### 8.2 Near-miss surfacing

The consolation prize for 8.1 — *show the reader what nearly made it* — and it
fails on its own terms. On Today or Interests it is an **"Everything" tab wearing a
new name**, putting unadmitted Signals in front of the reader, which #14 bans. On
the Signal page it fails §1 instead: **Strength is countable and a cosine is not.**
*"Matched at 0.74, bar is 0.70"* sets an uncheckable number beside the checkable one
on the single screen built to demonstrate that the arithmetic can be checked by
hand. The qualitative variant — *"this nearly matched"* with no number — is
unfalsifiable text on the provenance record, which is worse.

So the Signal page ([`ui-and-ia.md`](ui-and-ia.md) §4) shows the Admission route
and the Citation table, and **no relevance number is rendered anywhere in the
product**.

**This survived a live test rather than a hypothetical one.**
[ADR-0012](adr/0012-a-flat-interest-ranking-has-no-explanation.md) added `GAP` —
the margin between the named Interest and the runner-up — as a **gate** on the
interest route. A margin is exactly what this row refuses, so the distinction it
forced is worth keeping: what §8.2 bans is **showing** a relevance number, not
**computing** one. `GAP` is stored, gates admission, and renders nowhere; a Signal
that fails it simply has no matched-Interest line, which is indistinguishable to
the reader from any other `convergence` entry. Had ADR-0012 instead proposed
*"matched, weakly"* as a visible state, this row would have refused it — and
[#10](https://github.com/SaKaNa-Y/Zis/issues/10)'s no-badge rule would have refused
it independently.

### 8.3 The aggregate no-coverage note

ADR-0012 leaves one fault suppressed but undiagnosed: a Signal for which *nothing
in the profile has an opinion*, indistinguishable at runtime from a genuine
near-miss. [#41](https://github.com/SaKaNa-Y/Zis/issues/41) asked whether the
**aggregate** of that fault could be surfaced where the per-Signal case cannot —
*"N Signals cleared Strength 2 this month and none of your statements had an
opinion about any of them."* It is refused on **three independent grounds**, any
one sufficient.

- **§8.2, inverted.** A count of unadmitted Signals is *"3 Signals came close"*
  read backwards. §8.2 refuses near-miss surfacing on Today or Interests as an
  **"Everything" tab wearing a new name** ([#14](https://github.com/SaKaNa-Y/Zis/issues/14)),
  and a bare count does not escape that by withholding the titles — its only
  actionable meaning is *go edit your profile*, so it invites the "show me" the row
  exists to refuse. The qualitative variant is worse, as §8.2 already found:
  unfalsifiable text.
- **It cannot distinguish the two causes it appears to report.** *Your profile has
  a gap* and *supply was thin* produce the identical number, and over #21's 30-day
  replay **18 of 30 days have no eligible Signal at all**. So the note is
  ADR-0012's own defect recurring one level up — a quantity that suppresses both
  faults and diagnoses neither. Acting on it means editing the profile in response
  to a number that was mostly about the crawl.
- **It has no truthful denominator.** The 27-Signals-at-Strength-≥2 figure is a
  **backfill** yield over feed windows spanning one day to several years, not a
  monthly rate — a correction `ranking-model.md` already carries. There is no
  per-period count to render honestly, and at the settled bars the note would read
  *19 with no opinion against 1 with one*, permanently. That is
  [#27](https://github.com/SaKaNa-Y/Zis/issues/27)'s ground for refusing the
  Interest-edit preview: a surface whose answer is always *"nothing, still
  nothing"* teaches the reader their Interests do not matter, which is the opposite
  of the job it was proposed for.

**Two rules that do *not* refuse it**, recorded so they are not miscited later.
[ADR-0009](adr/0009-a-presentation-control-changes-neither-information-nor-order.md)
does not apply — the note is a passive report, not a control, and it changes
neither which information renders nor its order. And `ui-and-ia.md` §7's
per-Interest state is a genuine precedent *for* it: a computed, persistent note
reporting a fact about a statement the reader wrote. The refusal rests on the three
grounds above, not on there being nowhere to put it.

**Refused full stop, not deferred.** None of the three grounds is a supply
condition or a profile condition, so neither a denser corpus nor a better-written
profile revives it. #41 found that the uncovered cases which motivated the note
were an artifact of an unedited draft profile and were not coverage gaps at all —
but that finding is why the note is *unnecessary*, not why it is refused.

**#41's suspicion is now confirmed at full strength**, and it changes nothing here:
[#47](https://github.com/SaKaNa-Y/Zis/issues/47) measured the reader's own
20-statement profile and found **0 of 8** admitted entries uncovered. So the note's
subject matter has no observed instances at all. It stays refused on the three
grounds above, all of which were chosen precisely because they do not depend on
which profile is loaded.

### 8.4 A minimum-coverage requirement, and guidance to narrow a statement

Two refusals from [#47](https://github.com/SaKaNa-Y/Zis/issues/47), which re-asked
ADR-0012's coverage and separation questions against the profile
[#46](https://github.com/SaKaNa-Y/Zis/issues/46) elicited from the reader. Both are
refusals of a **constraint or nudge aimed at the reader's own sentences**, which is
what makes them one section rather than two.

**A minimum-coverage requirement on the profile.** ADR-0012 recorded two admitted
Signals with *no right answer anywhere in the profile*, and #41 deferred the
question of whether the spec therefore needs a written minimum-coverage rule — a
floor on statement count, or on the areas the statements must span. #47 measured it
and **the fault does not exist**: all **8 of 8** admitted entries have a correct
statement present in the reader's 20, and the four wrong winners passed over #1,
#10, #8 and #9. The `uncovered` verdict stopped describing anything and left the
measurement's label vocabulary. So the rule has nothing to prevent — and it is a
constraint on **reader data**, which is a genuinely awkward thing for a spec to
assert: the product telling the reader their own interests are malformed.
**Refused with no reopening condition, on purpose.** The obvious trigger — *a
profile smaller than N statements* — is the very constraint being refused, so
writing it in as a condition smuggles it back in. A thin profile already produces a
thin Brief through `T+`, without a separate rule to say so.

**Guidance to write sharper, narrower Interests.** Refused first by
[#35](https://github.com/SaKaNa-Y/Zis/issues/35) as *guidance, not a mechanism* —
it pushes the product's correctness onto the reader's phrasing — and upheld by #47
on stronger and different ground. #35's original evidence was that narrowing looked
actively **counter-productive** (the draft's sharpest statements produced its worst
failures), and #41 could not rely on that because it was draft-measured. On the
reader's own profile **neither that pattern nor its opposite holds**: wrong winners
span vagueness rank 2 to 18 of 20, right winners span 1 to 12, and the profile's
*vaguest* statement produces a **correct** why-text. Sharpness and correctness are
uncorrelated, so the lever is **inert** rather than backwards — and an inert lever
the reader holds is worse than a weak one, because they would be editing in the
dark. Decisively, the sentence each failure needed was **already in the profile**,
so no edit to the reader's phrasing was ever the fix. **`ui-and-ia.md` §7 is not
reopened to house it**: §7's per-Interest state reports a *fact* about a statement
(*this cannot match*), whereas *"try narrowing this"* is advice with no evidence
behind it — which is where ADR-0009's line falls.

**A third refusal joins them, and it is the one a reader would try first —
ADR-0019**, [#61](https://github.com/SaKaNa-Y/Zis/issues/61). Told the system does
not know Grok is a frontier model, the natural response is *"then I will write the
model names into my Interest"*. Measured over the reader's own 20 statements at two
strengths: with *Grok* written literally into `#1 Frontier model releases`, the entry
**still** names `#9 Version releases of developer libraries…`. The right answer moves
from rank 7 to rank 2 and does not win, one of the four failures grows **more**
confident of the wrong answer, and the one row that flips is the entry ADR-0018
recorded as the right answer losing by **0.004**. Adding exemplars also **re-sites
`T+`** — it moves the profile's median pairwise cosine, which is the floor under
every bar — so a reader editing a sentence would trigger a re-calibration.

**Two independently-measured inert levers is what closes this section rather than
deferring it.** Narrowing a statement is inert (#47); enriching one is inert
(ADR-0019). A guidance surface needs something honest to point the reader **toward**,
and there is nothing: in both cases the sentence each failure needed was already in
the profile, and no edit to the reader's phrasing was ever the fix. **No reopening
condition is added here either**, for §8.4's standing reason — the obvious trigger
would be the constraint being refused, smuggled back in as a condition.

Neither of the first two refusals touches `T_gap`, which was
[#54](https://github.com/SaKaNa-Y/Zis/issues/54)'s question and is now settled:
ADR-0018 withdrew the floor, and the successor selector question closed with
ADR-0019.
