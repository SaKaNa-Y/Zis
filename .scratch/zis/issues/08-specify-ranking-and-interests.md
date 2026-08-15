# 08 — Specify the ranking and interest model

Type: grilling
Status: open
Blocked by: 02, 04, 05

## Question

What earns one of the day's ~5–10 slots. Two scores, deliberately kept separate.

**Importance** (global, user-independent):

- Cross-source citation count — how many distinct Sources cite this canonical
  URL. Weighted by source trust, so five Bluesky reposts ≠ five independent
  outlets.
- **Velocity against a baseline** — a repo going 40 → 4,000 stars in a day is a
  signal; a repo sitting at 80k stars is not. Same for HN points/hour.
- Source trust weight — where do the initial weights come from? Hand-assigned,
  or derived? Hand-assigned is honest and adjustable; say so if that's the
  answer.

**Relevance** (per-user, from the interest profile):

- The profile is **editable free text** ("Postgres internals, Rust async, LLM
  inference infra — not crypto, not startup drama"). How does free text become a
  score? Embedding similarity against the item? Keyword/entity extraction? An
  LLM classification pass? Cost and latency differ by an order of magnitude
  between these — and note that if Ticket 05 cuts embeddings, the embedding
  option goes with it.
- Negative interests ("not crypto") must actually work. Are they a separate
  suppression list or part of the same similarity computation? Suppression is
  more predictable and more debuggable.

**Slot allocation.** Reserved quota: ~7 relevance-ranked slots + ~3
high-importance/low-relevance slots, so the filter bubble stays punctured. Tune
the split, and decide what happens on a quiet day — **does the brief pad to 10,
or is it allowed to show 3?** Padding to a fixed count trains you to distrust
the bottom of the list; a short brief on a quiet day is the honest signal.
Argue it through, but the map's bias is: never pad.

**Explanation.** Every item shows why it surfaced ("4 sources; matched: Postgres
internals; unusual velocity"). Since the score is two separable numbers, the
explanation should fall out mechanically — verify it does, and that no
un-explainable term sneaks into the formula.

**Cold start** (currently fog on the map — graduate it here if it sharpens).
Velocity needs history the system doesn't have on day one. Relevance-only
warm-up, or absolute thresholds until a baseline accumulates? How long is the
warm-up?

Deliverable: the scoring formula written out, the slot-allocation rule, the
explanation format, and the cold-start behaviour.
