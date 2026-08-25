# The Zis v1 source register

Resolves [Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11).
The machine-readable register is [`source-register.json`](./source-register.json);
this document is why it looks the way it does. Where the two disagree, the JSON
is the register and this is the commentary.

**73 Publishers, 96 Sources.** Transports: 67 RSS/Atom, 18 Bluesky author feeds,
9 GitHub release watches, 2 Hacker News lists. Three Publishers are retained as
**negative controls** (AWS, Hugging Face, Vercel) and are marked as such.

Measured against the corpus fetched **2026-08-23** by
[`.scratch/zis/prototype/PROTOTYPE-supply/`](../.scratch/zis/prototype/PROTOTYPE-supply/).
Every number below is a property of *that* corpus on *that* window. None is a
guarantee, and §7 states what re-measuring costs.

---

## 1. The headline: #6's supply figures were stale, and the shortfall was mostly bugs

The map has been quoting **"27 Signals at Strength ≥2 and 5 at ≥3"** since
[Specify the clustering algorithm](https://github.com/SaKaNa-Y/Zis/issues/6),
and the amendment to this ticket made that number the reason this ticket exists:
*"Supply is what binds, and this ticket owns supply."*

That figure was measured with **three of the corpus's highest-value contributors
at or near zero**, all three for reasons already fixed by decisions taken *after*
#6 and never re-measured:

| what was broken in #6 | evidence | fixed by |
|---|---|---|
| Issue-page hydration capped at 24 items, consumed in ingest order by TLDR's 20 + JS Weekly's 4 — so **React Status, Frontend Focus, This Week in Rust and PyCoder's were never hydrated at all** | their per-publisher citation counts were 4, 4, 641, 3; the first two are *self-citations only* | [#8](https://github.com/SaKaNa-Y/Zis/issues/8) removed the cap (an issue page is immutable and hydrated once ever) |
| **GitHub releases 403 without auth** — 0 items on all nine repos | `! gh releases facebook/react -> 403` ×9 in #6's own log, unremarked | [#8](https://github.com/SaKaNa-Y/Zis/issues/8) requires authenticated GraphQL and a PAT |
| **404 Media fetched 0 items** — a transport failure cached as a result | `! 404media … -> 0 fetch failed` | nothing; it was simply a bad fetch, and #29's rule that *a transport error is not a verdict* applies to feeds too |

Re-running #6's own roster with those three fixed, minus the two robots
casualties from [#29](https://github.com/SaKaNa-Y/Zis/issues/29):

| | Publishers | Strength ≥2 | ≥3 |
|---|---|---|---|
| #6 as published | 44 | 27 | 5 |
| Same roster, adapters fixed, clean window | 46 | **86** | **13** |

**Do not quote 27 / 5 again.** They describe a pipeline nobody decided to build.

The correction cuts the other way too, and harder — see §2.

## 2. Cooper Press is one Publisher, and it cost 77% of the convergence route

Recorded in full as
[**ADR-0015**](./adr/0015-shared-ownership-must-be-asserted-by-the-register.md).
In short: JavaScript Weekly, React Status and Frontend Focus were the top three
suppliers of Strength in the corpus, contributing 102 of its votes, and all three
are one company on three hosts. `CONTEXT.md` defines a Publisher as an owning
voice "regardless of how many accounts or feeds it speaks through", so they are
one Publisher.

| | Publishers | Strength ≥2 | ≥3 |
|---|---|---|---|
| Cooper Press as three voices | 46 | 86 | 13 |
| **Cooper Press as one voice** | 44 | **49** | **3** |

Strength ≥3 is the *entire* admission condition for the `convergence` route
(ADR-0006) — the route that fires **without** an Interest match and therefore has
no second check on it. So the inflation sat exactly where it was least visible
and did the most damage.

**The research document's advice needs amending, not discarding.** "Buy the
aggregators first" is still right — the collapsed Cooper Press Publisher is still
tied for the highest-yield row in the register. What is wrong is the corollary
that more newsletters from the same stable are more supply. Its note on Frontend
Focus — *"Overlaps JS Weekly heavily — good, that's the point"* — describes
self-citation approvingly.

## 3. The curation metric is cites-per-vote, and it correlates with nothing

Citations are not the currency; **votes** are — a Citation only matters if some
*other* Publisher independently cites the same canonical URL. So the measure that
decides whether a Source earns its slot is how many Citations it spends to raise
Strength once.

It spans **three orders of magnitude and tracks neither volume nor prestige**:

| cheapest per vote | | most expensive per vote | |
|---|---|---|---|
| Una Kravets | 3.6 | Smashing Magazine | 391.5 |
| Ethan Mollick | 9.0 | Dan Luu | 327.3 |
| Salvatore Sanfilippo | 9.0 | Svelte | 242.8 |
| React | 9.3 | Hacker News | 218.0 |
| Simon Willison | 11.9 | Pragmatic Engineer | 185.0 |
| Interconnects | 12.9 | Latent Space | 74.3 |
| **Cooper Press** | **13.6** | Sebastian Raschka | 65.6 |
| Stefan Judis | 14.8 | CSS Weekly | 49.5 |

Two rows are worth staring at. **Latent Space spent 1,040 Citations on 14 votes
and zero at Strength ≥3** — the single largest citation producer in the corpus,
near the bottom on yield. And **This Week in Rust produced 559 Citations and *no
votes at all***: a pure aggregator, doing its job perfectly, overlapping nobody,
because nothing else in the register covers the Rust ecosystem deeply enough to
co-cite it. That is the research document's own warning — *"30 feeds spread
across ten ecosystems produce singleton clusters"* — now with a name and a
number attached.

## 4. Two currencies: origin blogs cannot vote, and are kept anyway

**28 of 73 Publishers raised Strength zero times.** Most are origin blogs — React,
Node.js, Vue.js, Tailwind, Nuxt, OpenAI, DeepMind, WebKit, Go, Rust — and they
vote zero **by construction**, not by underperforming: Strength excludes the
origin (`#9`), so a Publisher cited *for* its own work never appears as a voter
on it. [#6](https://github.com/SaKaNa-Y/Zis/issues/6)'s C6 case already proved
the corpus does not need them to form the cluster — an Anthropic URL clustered at
Strength 3 with zero origin Citations.

What they buy instead is the **`own` text rung**, which
[#21](https://github.com/SaKaNa-Y/Zis/issues/21) measured as the best-scoring rung
of the three (0.70 against `citing` 0.67), and which
[#49](https://github.com/SaKaNa-Y/Zis/issues/49) settled the composition of.
Since 83% of Signals embed from someone else's words, the rows that supply the
other 17% are carrying the relevance layer.

**So the register is ranked on two currencies and a single-metric cut would
delete one of them.** Aggregators and link blogs earn their slot on Strength;
origin blogs earn theirs on the `own` rung. Four of the reader's twenty Interests
(#12 React, #13 Vue, #14 Tailwind, #15 TypeScript) name an origin blog by name.

## 5. Coverage against the reader's actual profile

Filled, against the 20 statements elicited in
[#46](https://github.com/SaKaNa-Y/Zis/issues/46):

- **#13 Vue 3 / Composition API** had **nothing** in #6's roster. Added Vue.js
  (4 votes, despite the blog being dormant since 2024-09 — its full-content feed
  still links out), Nuxt, and Anthony Fu (6 votes, despite the research flagging
  the feed as ~16 months stale). **Both "stale" verdicts were inherited notes
  that the measurement contradicts**, which is also true of CSS Weekly: flagged
  stale, delivered 21 votes.
- **#14 Tailwind v4** had nothing. Added, votes zero, kept per §4.
- **#10 tooling and build systems** — added Vite (10 votes), Web Tools Weekly
  (24), Console.dev (11).
- **#20 software design writing** had nothing. Added Martin Fowler (4 votes, 2 at
  ≥3) and Will Larson.
- **#16 web platform** — added Stefan Judis, who turns out to be the **single
  highest-yield individual in the register** (49 votes, 14.8 per vote), tied with
  the whole of Cooper Press.

**One Interest is left with no supplier, deliberately.** Interest #8 — *"the AI
industry as a business: funding rounds, valuations, acquisitions, executive moves,
and lawsuits"*, which #46 recorded the reader confirming they want — has **no
Publisher in the register that can supply it**. The press tier went on trial for
exactly this and failed: **TechCrunch 20 Citations / 0 votes, The Verge 30 / 0.**
Their feeds are excerpts that barely link out, so they cannot raise Strength at
any volume, and admitting them would not give Interest #8 a voter. Recorded as a
hole rather than filled with a Publisher that cannot vote. Neither candidate
document contains one that would.

## 6. What is excluded, and on which ground

Ground matters more than the list, because a ground is what stops a candidate
coming back.

**On robots, verified against primary `robots.txt`** (from
[#29](https://github.com/SaKaNa-Y/Zis/issues/29) and
[ADR-0014](./adr/0014-a-robots-verdict-belongs-to-the-host-that-served-it.md)):
Lobsters, The Register, Changelog, Bilibili, `youtube.com/feeds/videos.xml`.
**InfoQ is `Unverifiable`** — a third register state, not a synonym for excluded:
both `feed.infoq.com` (406) and the apex (405 + AWS WAF) refuse to answer, so
there is no rule to quote. **Ars Technica is IN** — `feeds.arstechnica.com`
answers 404, which under ADR-0014 is a verdict whatever the body, and Zis never
contacts the apex that challenged.

**On ownership** (ADR-0015): the six unlisted Cooper Press newsletters are Sources
of one Publisher, not seven Publishers. `hnrss.org` and `rsshub.app` stay banned
as Transports.

**On the shared-host rule** (ADR-0015 rule 3): **Hillel Wayne is excluded** — his
only feed address is `buttondown.com/hillelwayne`, a path on a shared newsletter
platform, and `host → publisher_id` cannot express path-scoped ownership. Claim
the bare host and the next Buttondown tenant collides, silently disabling the
self-citation guard for one of them; claim nothing and the guard never fires. His
yield agreed (154 Citations, 0 votes) but that is not the reason, and recording
the reason is the point.

**On cost, measured**: Smashing Magazine (391.5 per vote, into the densest
neighbourhood in the register) and Stack Overflow (0 votes).

**On a Content-Signal, narrowly**: `kentcdodds.com` and `xeiaso.net` serve
`Content-Signal: ai-input=no`. This is a **rule, not a cut** — Kent C. Dodds stays
in the register on his *Bluesky* Source, a different host, and what the signal
forbids is **article-body fetches from `kentcdodds.com`** at ingestion stage 4.
`ai-train=no` alone (Val Town, Phoronix, Vercel) does not restrict Zis, which
trains nothing.

**On authorship** ([ADR-0017](./adr/0017-a-sources-publisher-must-own-the-utterance-or-the-venue.md)):
Bluesky **feed generators** are excluded, and so is any third-party curated stream
— Flipboard Tech, a Google News RSS query, any "best of" feed over a venue its
selector does not own. **A Source's Publisher must own either the utterance or the
venue; owning only the selection is not enough.** This paragraph used to hold the
question open and call feed generators *"the largest untapped supply in the
candidate set"* — **do not quote that phrase again**: it is denominated in the brief
density [ADR-0016](./adr/0016-brief-density-is-an-observation-not-a-target.md)
retired, and §8 measures supply as not the lever anyway. Two grounds refuse them
independently: authorship, and **ADR-0015 rule 3 generalized** — a `*.bsky.social`
author's only address is a path on a shared host, and a feed generator's is a path
under a DID owning none of the content. Note what this register keys, since it is
easy to misread: a Publisher's `hosts` are its *own* web addresses and a
`bluesky-author` Source is keyed by **DID**, which is why 18 author feeds sharing
`public.api.bsky.app` never collided. An author with a **custom-domain handle**
(`una.im`, `crawshaw.io`) is the `netflixtechblog.com` case and stays registerable
by hand. The rule bites on a Source's *identity*, never on its Items, so reposts
inside an author feed and submissions on HN are untouched — those are
Citation-level questions with their own answers.

**Still worth reading by hand, and only by hand**: the 11 feed generators verified
in `.scratch/zis/research/candidate-sources-platforms.md` §3.3 remain a cheap
**curation instrument** — five read unauthenticated via `app.bsky.feed.getFeed`, so
a curator can open one to *find* candidate authors, who then enter the register
normally with an asserted owner. There is no runtime role: discovery runs on the
explicitly unstable `app.bsky.unspecced.*`, one "popular" feed already answers
`XRPCNotSupported`, and a poll would land on `public.api.bsky.app`, which §7 records
as the run's longest pole and a sequential chain.

## 7. What this register costs to run, and to keep true

**Fetch budget — the check [#8](https://github.com/SaKaNa-Y/Zis/issues/8) asked
for by name.** Its §10 states the ≤2-minute run budget "belongs in this spec as a
number, because it is what keeps §11 true and **it will otherwise rot silently as
Sources are added**." Sources have now been added: **96 Sources over 66 RSS hosts,
against #8's 47 over ~44.** At per-host serial with global concurrency 6 the RSS
tier is ~11 rounds and comfortably inside the budget. **The new longest pole is
Bluesky**: 18 author feeds all on `public.api.bsky.app`, so per-host serialism
makes them a *sequential chain* where the RSS tier parallelises — the one place
where doubling the Source count doubles wall-clock. ADR-0008 makes run duration a
compute variable, so this is the number to watch, and it is the reason not to grow
the Bluesky tier without re-timing the run.

**Robots verdicts are perishable.** #29 found **four blanket blocks appearing on
ordinary tech hosts inside three years, two inside the last nine months**, on
hosts nobody would have flagged. The register's verdicts have a TTL, not a
boolean; monthly re-sweep is #29's defensible cadence.

**The measurement is conditional on its window.** The 2026-08-23 corpus reaches
back years for deep-archive feeds and days for the Cooper Press family, so
crossing dates span 2022 to 2026 while the *rate* is measured over the last 30
calendar days. Any re-measurement must refetch **every** Source into one window:
comparing a freshly-fetched addition against a cached incumbent understates the
addition, which is why the incumbent cache was set aside rather than reused.

## 8. Supply is not the lever it was hoped to be, and there is no longer a target to miss

**Retired by
[ADR-0016](adr/0016-brief-density-is-an-observation-not-a-target.md)
([#56](https://github.com/SaKaNa-Y/Zis/issues/56)): the ≥5 density target this
section was written against no longer exists.** The measurement below stands
unchanged and is the reason it no longer exists. Read §8.1 before quoting any
count in it.

The amendment to #11 made brief density this register's primary job: *"enough
distinct Publishers citing overlapping URLs that Strength ≥2 happens routinely."*
It happens more routinely than before. It does not happen enough.

Replaying the corpus from Citation timestamps — bucketing each Signal on the day
the **second distinct non-origin Publisher** cites it, not on `firstSeen`, which
would credit a backfilled Signal to a day years earlier:

| roster | Publishers | Signals ≥2 | trailing-14-day **median/day** ≥2 | empty days /30 | median/day ≥3 |
|---|---|---|---|---|---|
| #6's roster, Cooper collapsed | 44 | 49 | 2 | 10 | 0 |
| **This register** | **73** | **163** | **3** | 6 | **0.5** |

**Read what that 3 is.** It is the count of Signals *eligible* at Strength ≥2 —
the ceiling **before** any Interest match and before `T+`. The Brief lands well
under it, at a median of 1. #9's target was a trailing-14-day median Brief of
**≥5**; the reader, asked directly, states **3** entries make a morning worth
opening, and that number binds nothing (ADR-0016 §3).

So: **a 66% increase in Publishers bought a 50% increase in the ceiling, and the
ceiling is still below the target.** Supply responds to curation, sublinearly, and
lands short. Reaching a ceiling high enough that a bar admitting a third of it
yields 5 needs the ceiling near 15 — several hundred Publishers on this slope,
which is a different product and collides with ADR-0008 long before it arrives.

**The bar was not lowered to close the gap, and under ADR-0016 §9.1 it may not
be** — density is not an admissible justification for moving `E1`, `T+` or the
interest route's selector (this named `T_gap` until
[ADR-0018](adr/0018-a-gap-cannot-see-a-confident-wrong-answer.md) withdrew it; the
rule is unchanged in force and now reaches a replacement selector too). That rule is
what survives of #9's target; the *number* did not, because
the shortfall stopped being attributable to an unmeasured corpus. It has been
measured, twice, on a clean window, every branch of its escalation is closed, and
a target that reports *miscalibrated* every morning forever was doing no work.
What this register still owes is an **alarm, not a target**: the watched quantity
is the **longest run of consecutive days with zero eligible Signals at Strength
≥2** — provisionally **2**, from the series in §8.1 — which fires on a supply
*regression* (a dead Publisher, a broken adapter, a newly-disallowing
`robots.txt`) rather than on a shortfall against an aspiration.

## 8.1 Every count above is understated on its older days, and structurally so

**A single-snapshot replay cannot see its own past.** An older day can only be
reconstructed from Items still present in a *current* feed; publisher-side
retention has already deleted the rest. So the further back the window reaches,
the emptier it looks, for reasons that have nothing to do with supply.

The per-day series at Strength ≥2 for the 30 days ending 2026-08-22, fetched in
one pass on 2026-08-23
([`rep-FINAL.log`](https://github.com/SaKaNa-Y/Zis/blob/main/.scratch/zis/prototype/PROTOTYPE-supply/rep-FINAL.log)):

```
4,0,0,2,2,2,5,1,1,0,3,6,4,3,0,0,2,0,8,2,4,3,3,4,3,4,6,17,1,3
```

| half of the window | eligible Signals | empty days |
|---|---|---|
| first 16 days | 33 | **5** |
| last 14 days | **60** | **1** |

Nearly twice the supply in the more recent half, and five of the six blanks in the
older one. **So "6 empty days of 30" — and #21's "18 of 30" before it — are partly
measuring feed retention rather than supply, and neither is a steady-state
figure.** The longest run of consecutive empty days is **2**, twice; there is no
3-day blank streak in the window at all.

Two consequences. The supply alarm's value is **provisional and may not fire until
re-sited on 30 days of forward-running data** — an alarm sited on a biased window
buys either false alarms or silence. And a **future re-measurement of this register
must not be compared against this table day-for-day** unless it was fetched the
same way over the same window depth; the comparable figures are the recent-half
ones. This is `ranking-model.md` §10's "these numbers are conditional" applied to
counts instead of cosines.

**One honest consequence for the positioning.** `positioning.md` §7's separability
falsifier and §7.1a's "one entry per month" note both rest on entry counts drawn
from #21's replay over #6's corpus. That corpus was 44 Publishers with three
broken adapters and Cooper Press triple-counted. Those figures are not
transferable to this register and should not be quoted as though they were.
