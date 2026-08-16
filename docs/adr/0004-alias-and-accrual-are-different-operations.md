# Alias and accrual are different operations, and only accrual has a clock

Status: accepted

Three operations in clustering look alike in code and make different claims.
**Canonicalizing** decides which address defines a Link, so the other form never
existed. **Aliasing** claims two distinct Links are one event, and merges their
Signals. **Accruing** records that a new Citation belongs to a story that already
exists, which raises Strength.

**Only accrual has a clock.** An alias is an identity claim, and identity does
not age: an HN thread is a discussion of its target URL whether the pair is an
hour old or a year old. Gating alias merges on a temporal window refused 160 of
399 merges on one day's real corpus.

Accrual, meanwhile, turns out not to be a merge at all. Under ADR-0002 every Link
already has a Signal, so a second Publisher citing an existing Link raises that
Signal's Strength without merging anything. Measured at 12h, 24h, 48h, 72h and
168h merge windows, the corpus is identical.

**Therefore there is no cluster-formation window, and temporal decay lives
entirely in ranking.** ADR-0002's "temporal decay is expressible as *this Signal
no longer accepts merges*" is superseded: a Signal never stops accepting merges,
because merges are identity resolution. What decays is a Signal's rank, via a
half-life multiplier on its score.

## Consequences

- Alias rules — HN thread to its target, a single-citation post to the article it
  exists to point at, an announcement to the release tag it cites, a renamed
  repo, AMP, shorteners, `rel=canonical` — are never time-gated.
- A story that grows on day 2 competes for day 2's Brief, which is what #14
  required and what a closing window would have prevented.
- The "rolling window vs daily batch" question does not need answering for
  detection. It returns only as a ranking question.
- **Citation-worthiness becomes the layer that needs the attention** the window
  was getting. A reference is not a citation: three unrelated posts linking the
  Node docs is not three voices agreeing on today's story. Reference-only URLs
  (specs, MDN, docs paths, bug trackers, package pages, repo-internal GitHub
  links) and a Publisher's links to hosts it owns are excluded from Strength
  before it is counted.
- Every alias rule needs an "exactly one" guard where it keys off an Item's
  outbound links, because an Item citing many candidates is a roundup rather than
  one event.
- `host → publisher_id` must be unique. Two Publishers sharing a host silently
  disables the self-citation guard, which is the
  vendor-manufactures-its-own-cluster failure arriving through a data-modelling
  slip rather than a rule.
