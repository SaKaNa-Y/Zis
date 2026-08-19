# A claimed advantage must cost a competitor something to copy

Status: accepted

Settled by
[State Zis's positioning against existing RSS readers and aggregators](https://github.com/SaKaNa-Y/Zis/issues/26).
The verdicts it produces are in [`positioning.md`](../positioning.md).

The ticket proposed the test as *"a difference a competitor could ship next
quarter is not an advantage."* That is a test about **time**, and it is the weaker
of the two available framings: it dates, and it makes every verdict depend on
guessing somebody's roadmap. The rule adopted instead is about **cost**:

**A claimed advantage is admissible only if a competitor would have to give
something up to copy it.**

**This governs claims, not features.** ADR-0009's admissibility test governs what
may be *built*. This one governs what may be *asserted as a reason for building
it*. The two are independent: a feature can be perfectly admissible and still
provide no advantage worth naming, and that combination is common rather than
exotic.

Worked against the field, the test separates cleanly where the time-based version
blurred:

- **The explanation constrains the formula** (ADR-0006) passes. Feedly must delete
  Leo, which is its paid tier; Techmeme must fire 26 editors; TLDR must stop using
  a practitioner's judgement, which is the whole product; NewsBlur must unhook its
  classifiers from subscriptions. Every one of those is a subtraction.
- **Admission as an absolute bar, never a top-N cut** (ADR-0006,
  [#14](https://github.com/SaKaNa-Y/Zis/issues/14)) passes, and passes on a
  *commercial* give-up rather than a technical one: copying it means shipping days
  with one entry, and a subscription product cannot do that without churn. Zis has
  no churn to lose. A commercial give-up is the strongest kind, because it does not
  close as engineering gets cheaper.
- **Sealing** fails. Readwise gives up nothing to seal a digest. Sealing remains
  load-bearing *internally* — it is what made replayability a correctness property
  and killed LLM merge adjudication — which is exactly the distinction this test
  exists to draw: internal coherence is not differentiation.
- **No unread count** fails. Reeder gave it up in a full rewrite and NetNewsWire
  treats anxiety as a design axis, so it is table stakes among good clients.
- **"Better summaries"** fails, and this is the case the test was needed for. The
  prior-art study found summary quality differentiates nothing and that a chatbot
  with a URL pasted in is a comparable substitute. Nobody gives up anything to
  write a better prompt.

## Consequences

- **A difference that fails the test is recorded as table stakes, and may not be
  used to justify work.** This is the operative half. It retires "we should do X
  because it differentiates us" as an argument unless X survives the test first,
  and it is what stops a feature list from accumulating properties that are true,
  pleasant, and shared with every competitor.
- **Zis claims two structural differences, not six.** A list of six advantages is
  the shape of a product that has none. Anything proposed as a third is proposed
  against this test.
- **Internal coherence and differentiation are separate ledgers.** A property may
  be invariant, load-bearing, and expensive to reverse while being worth nothing
  as a claim — sealing is the worked example, and the map's phrasing that "sealing
  is what makes the boundary structural" is a statement in the first ledger that
  reads like one in the second.
- **A structural difference may be invisible, and that is not a defect.** The
  deterministic replayable spine and the global-first, API-first corpus are both
  real and neither is a claim: the spine is the *mechanism* behind a claim already
  made, and the sourcing choice is a durability argument. Neither gets its own row.
- **Where a competitor is strictly better, the comparison says so in the same
  row.** A concession three pages from its claim reads as a disclaimer; one in the
  row reads as calibration. This is why `positioning.md` carries a "where they win"
  line per competitor rather than a disadvantages appendix.
- **The test is the reopening condition, and shipping one advantage that fails it
  retires the test permanently.** That asymmetry is what makes this an ADR rather
  than a note in `positioning.md` — the same basis ADR-0009 used, where one
  presentation control would have retired that test.
