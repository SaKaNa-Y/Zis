# Admission to a Brief is a set of absolute bars, and there is no score

Status: accepted

The obvious ranking model is a score: weight Strength, velocity and relevance
into one number, sort, take the top ten. We rejected it. **A Signal is admitted to
a Brief by a conjunction of absolute tests, each independently checkable, and no
number combining them is ever computed.**

The rule that forced this is the explanation. ADR-0003 already makes the matched
Interest *be* the why-text, produced without an LLM call. Generalising it:
**the explanation constrains the formula, not the reverse — any term that cannot
be rendered into the why-text sentence from stored columns alone is disqualified
from the decision.** One principle then kills three proposals that would each
otherwise have needed their own argument:

- **Publisher trust weights.** "2.8 weighted Publishers" is not a sentence a
  reader can check. They are also unfalsifiable at this scale — there is no
  labelled data to tune a weight against — and redundant, because the failure they
  target ("five Bluesky reposts are not five outlets") is already prevented
  structurally by `COUNT(DISTINCT publisher_id)` and the self-citation guard. When
  a Publisher proves to be noise the lever is **removing the Source**, a decision
  with a visible owner.
- **A combined importance/relevance score.** It needs a weight nobody can justify,
  and it renders as "a blend scored 0.61".
- **Subtractive negative Interests.** A strong positive can outvote a strong
  negative, so "not crypto" silently becomes "less crypto". Negative Interests
  suppress outright instead, across **both** admission routes — a negative that
  only filtered the interest route would fail exactly when the unwanted story is
  widely covered.

**Velocity is cut from v1 on the same rule plus a data argument.** It needs
history the system does not have on day one; HN's Firebase publishes a current
score rather than a rate, so any velocity requires snapshots Zis must accumulate
itself; and GitHub is narrowing per-star timestamp access (July 2026), so one of
the two proposed inputs may not exist. Per-Source metric snapshots are recorded
from day one so the term can be added later against measured data.

The two admission routes are **nested, not orthogonal**: `interest` requires
Strength ≥2 with an Interest match, `convergence` requires Strength ≥3 without
one. A ≥2 bar on both would make them exhaustive — every eligible Signal admitted,
the relevance bar reduced to a caption — which would reverse #14's
absolute-relevance-bar ruling by accident rather than by decision.

## Consequences

- **No quota, no reserved slot count.** A reserved "~3 importance slots" is a
  top-N cut wearing a different hat, and #14 banned top-N. Each route self-limits
  because each is absolute.
- **Decay's scope collapses.** Admission tests against *integer* Strength bars, so
  a half-life multiplier has nothing to multiply in the decision. ADR-0004's
  "half-life multiplier on its score" survives only as **ordering inside the
  `convergence` route**, which makes the half-life a far smaller decision than the
  clustering prototype's config implied.
- **The invisible rejected class is accepted.** Strength 2 with no Interest match
  is the largest rejected population and the reader never learns it existed. That
  is what never padding means.
- **Brief density is a target on the bar, never an input to it.** An adaptive bar
  is padding wearing a formula, and it would make one Brief's content depend on
  other days' data, breaking sealing's reproducibility guarantee.
- Any future change that sums two of these quantities into one rank is a reversal
  of this decision and of ADR-0003's deterministic why-text, not a refinement.
