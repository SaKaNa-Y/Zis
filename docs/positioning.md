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
the risk, not busy ones. That is handled as a standing target on supply and on the
bar — a trailing-14-day median of ≥5 entries, missed by *reporting* the bar as
miscalibrated rather than lowering it ([#9](https://github.com/SaKaNa-Y/Zis/issues/9)).

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
equivalent of today (see §7 and
[#27](https://github.com/SaKaNa-Y/Zis/issues/27)).

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
  do. See the NewsBlur row.

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

Stated as a condition rather than a metric, because Zis has no instrumentation and
does not need any to observe it:

> **If the reader stops editing Interests after the first month and never opens a
> Signal provenance page, checkability was decoration and this position is wrong.**

That is the same shape as Feedly's real failure, and it puts the standing
assumption the prior-art study flagged — *the user is willing to write and
maintain the profile* — somewhere it can actually be checked, instead of leaving
it as an assumption in the map's Notes.

**The one candidate that aims at this falsifier** is NewsBlur's "Test on this
story", adapted: *what would this Interest edit have done to yesterday's Brief?*
It is the only thing that turns checkability from **passive** (inspectable if you
go looking) into **active** (the system shows you your edit working), and a reader
who never edits an Interest is exactly the reader it is for. It is not free — it
needs yesterday's *candidate* set, not just the sealed Brief, which is a schema
question — and sealing survives it, since a preview reads and never mutates.

That is a feature question, not a positioning one. It is routed to
[Decide which differentiating features, if any, enter Phase 0](https://github.com/SaKaNa-Y/Zis/issues/27),
whose question is narrowed to: **is the position already true, or must the preview
ship for it to be true?** — default *already true*, burden on the preview.
