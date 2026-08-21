# The Interest Profile is a set of statements, not one description

Status: accepted

The obvious model is one textarea: a reader describes what they care about, and
that description is embedded and compared against every Signal. We rejected it.
**An Interest Profile is a collection of `Interest` records, each embedded
separately, and a Signal is relevant if it clears the bar against any single
one.**

Two forces make the single blob untenable. The first is arithmetic: embeddings
are `bge-small-en-v1.5` at 384 dimensions, and one vector over "Rust, Postgres
internals, typography, and EU tech policy" is a centroid sitting near none of
them. Diversity of interest degrades a single-vector profile in exactly the way
a real reader's interests diversify over time. The second is a constraint
inherited from the AI-provider decision: **the Interest Profile must never
appear in a DeepSeek prompt**, because inputs there are trained on and retained,
which is tolerable for already-public article text and not for a private
description of a person. That rules out asking an LLM to explain why something
matched. Under separate statements the explanation is free and deterministic —
the matched Interest *is* the why-text.

A menu of suggested wordings exists, but only as a seed. Choosing one inserts
text into the reader's own profile and leaves no record that a menu was
involved. This is deliberate: a stored set of predefined categories matched
alongside the free text would be `topic_follow` under a new name, and would
reintroduce the competing second relevance mechanism that the entity-naming
decision removed.

## Consequences

- Relevance is `MAX` over per-Interest similarity, not one comparison. Cost
  scales with the number of Interests, which is why a count cap (~10–20) and a
  per-statement length cap (~200 characters) are quality-and-cost limits rather
  than policy. There are no content restrictions; at single-user scale there is
  no threat they would answer.
- `BriefEntry`'s frozen why-text is produced without any LLM call, so a sealed
  Brief is reproducible from stored rows alone.
- ~~A vague Interest is visible rather than silent: it shows up as the stated
  reason on Signals that should not have surfaced, which tells the reader what
  to sharpen. This is the answer to the cold-start problem — the profile must be
  non-empty before the first Brief is cut, and the why-text is the feedback loop
  that improves it.~~ **Withdrawn** by
  [ADR-0012](0012-a-flat-interest-ranking-has-no-explanation.md), on measurement.
  The loop requires the wrong winners to be the *vague* statements; measured
  against the profile's own geometry, three of four are among the **sharpest** in
  the profile, so the loop reaches one failure in four and the reader is left with
  a correct, specific sentence attached to the wrong story and nothing to edit.
  **The cold-start half of this bullet stands** — the profile must be non-empty
  before the first Brief is cut — but the why-text is not a reliable repair
  mechanism, and a wrong why-text is a failure rather than feedback.
- Any future change that matches a stored category set alongside the free text
  is a reversal of this decision and of the removal of `Topic`, not an
  enhancement.
- **The argmax alone is not a sufficient why-text**
  ([ADR-0012](0012-a-flat-interest-ranking-has-no-explanation.md)). This ADR's
  core survives unchanged — statements embedded separately, `MAX` over
  per-Interest similarity, the matched Interest *is* the why-text, rendered
  verbatim with no LLM call. What is added is a second condition: the ranking that
  produced the argmax must not be **flat**, because the reader's own statements sit
  at a median pairwise cosine of 0.659 and a generic text scores alike against all
  of them, making the winner rounding noise.
