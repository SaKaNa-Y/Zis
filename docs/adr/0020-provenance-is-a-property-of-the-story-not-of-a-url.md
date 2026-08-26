# ADR-0020 — Provenance is a property of the story, not of a URL

- **Status**: Accepted
- **Date**: 2026-08-21
- **Context**: [#44](https://github.com/SaKaNa-Y/Zis/issues/44), found by
  [#39](https://github.com/SaKaNa-Y/Zis/issues/39)
- **Prototype**: `.scratch/zis/prototype/PROTOTYPE-self-citation/`
- **Supersedes nothing. Extends**
  [ADR-0015](0015-shared-ownership-must-be-asserted-by-the-register.md).

## Decision

**A Publisher's provenance relationship is to the Signal's story, not to any URL it
happens to cite.** Two consequences, and they are the whole ADR:

1. **The self-citation guard is scoped to the Publisher and keyed on the target.**
   A Publisher that owns the Signal's **target** — its union-find root, the thing
   every alias merge folds *into* — does not vote on that Signal at all. It is not
   a test applied to each Citation separately.
2. **Ownership Zis cannot observe must be asserted, never inferred.** Where a
   Publisher's ownership of a target is invisible to the register, the guard misses
   it and the miss is **named and counted**, not patched with a second list.

## Why the scope, and not the key

#44 was opened on the premise that the registry is the wrong shape: it is a list, a
list can be incomplete, and §4 already records one silent failure caused by a
registry error. Both live cases #39 found sat outside it. Measured over #6's corpus,
the premise does not survive on either half.

**The registry has one hole and completing it changes nothing.** Every host a
Publisher's own Items are published on, minus what it is registered as owning, is
**10 of 48 Publishers and exactly one host: `bsky.app`** — shared by all ten.
Registering it *is* the `github.blog` failure, and the `host → publisher_id` UNIQUE
rule forbids it outright. Completing the registry from that evidence moves **57**
Signals and **0** at Strength ≥2.

**Authorship — the key that needs no list — inverts the vehicle rule.** Pass 1
already records a `self` Citation for every Item's own address, so Link → author is
a fact the corpus carries and never goes stale. Applied to any *member* Link it is
30% precise: of 10 admission changes, **7 destroy a legitimate vote**, four of them
HN's own submissions. The reason is structural rather than incidental — **an alias
merge deliberately folds a pointer into the thing, so after the merge the vehicle's
author is the voter, by design.** A guard that suppresses the author of any member
suppresses exactly the voice the merge rule exists to preserve.

**What was actually broken was the scope.** The guard tested each Citation, so a
Publisher could be `origin` *and* a voter on one Signal — caught on its own host,
counted on a different member. One admitted voter-set in the corpus:

```
- 3 | interconnects, simonwillison, tldr
+ 2 | interconnects, tldr
  target  simonwillison.net/2026/Aug/7/openai-timeline   [owned by simonwillison]
  member  news.ycombinator.com/item?id=49220609
```

Strength 3 from two independent voices, at exactly the `convergence` threshold
(ADR-0006) — so it entered a Brief with no Interest match, on a number the reader
could not have counted. Keying on the target with the **unchanged** registry
removes it and costs nothing: `s≥2` 26 → 26, `s≥3` 5 → 4, negative-control false
positives unchanged at 3. Adding authorship of the target on top, or completing the
registry underneath it, each change **nothing further** at admission.

`s≥3` 5 → 4 is a **removed false Strength-3, not a lost one** — #39's reading of
27 → 26. This guard can only ever subtract votes, so judging it on the supply ledger
(#20 §1) would refuse every version of it; it is judged on the invariant it protects:
`positioning.md`'s second structural difference, **Strength is a number the reader
can count by hand.**

## Why the miss is named rather than mechanized

Two shapes reach no key at all.

**Ownership on a shared platform is path-keyed.** Kent C. Dodds' Bluesky post
promoting *"New Better with Kent"*, his own YouTube video, gives Strength 2 where
there is one independent voice. `youtube.com` cannot be registered to him — that is
ADR-0015's own rule — and the video was never ingested as an Item, so authorship
cannot see it either. **One measured instance at Strength 2, and one arguable second**
(una.im citing a Chrome for Developers video she appears in — a person is not the
organization, so it may not be one voice at all).

**An unregistered second host is unfalsifiable.** `cloudflare.net` is a *cited* host
only; Cloudflare publishes nothing there, so no evidence-based detector can find it.
ADR-0015 already assigns that case to the register.

Every mechanism for either is a second unverifiable list — a per-Publisher identity
roster of channels and handles — with the same silent failure mode the ticket was
opened to escape. So both are accepted as a **named Phase-0 defect with its count in
`clustering-model.md` §4**, on #61's precedent for the labelled holdout: the number
needs forward-running data to know whether one instance is the rate or the floor, and
a ticket needing a running pipeline could never reach this map's frontier. **Not
waived; it travels to Phase 1.**

## What this adds that ADR-0015 did not

ADR-0015 settled that shared ownership is **asserted by the register, never detected
by the schema** — and stopped at *what the register is responsible for*. This ADR
covers the other side: **what the code may infer from what the register says.** The
guard may infer nothing beyond ownership of the target. Specifically refused, both
measured inert or harmful:

- a second key derived from authorship (inert at admission — only **0.7%** of cited
  Links are authored in-corpus);
- a per-Publisher identity list for shared-platform ownership;
- deriving ownership from name or domain similarity (`cloudflare.net` from
  `cloudflare.com`) — an inference about ownership, which is what "asserted, never
  inferred" forbids.

## The failure mode becomes loud

The registry's errors were silent twice. The class is now asserted, and the
assertion is the one evidence-based test that needs no judgement:

> **Every host a Publisher's own Items are published on must resolve to that
> Publisher, unless it is a Transport venue host, which is owned by nobody.**

A **Transport venue host is owned by nobody by construction** — not by exemption.
`bsky.app` is where a Bluesky author feed is *served*; the Publisher is the author
(ADR-0017), never the venue. So a Transport host can never be owned, therefore never
registered, and the UNIQUE rule and the guard stop disagreeing about it. The set is
**derived from each Source's transport**, never listed — a second list is a second
place for the same fact to be wrong. One wrinkle worth stating so it is not read as
an inconsistency: `news.ycombinator.com` is both a Transport venue *and* `hn`'s
registered host, and that is correct, because **HN votes** and `bsky.app` does not.

It runs as a **pipeline startup assertion, not a CI check** — CI has no corpus, so a
static check can only read the register against itself, and the hole is only visible
once Items exist. Failing the ingest run is the right blast radius: ADR-0008 makes
the wake the unit of cost, and a run that would silently mis-count Strength is worth
losing.

## Consequences

- `origin` becomes **single-valued and derived**: the Publisher owning the target, or
  none. It was previously a by-product of iteration order over Citations — the last
  own-host match won — which is state a replay should not depend on, and #14 makes
  reproducibility a correctness property. §4's two-counts rule and the why-text's
  origin label are deterministic as a result.
- **§3's citation-worthiness filter does not change.** Its intra-publisher drop keys
  on the same registry and stays per-Citation, because *"is this link internal
  navigation?"* genuinely is a question about one Citation's host. Measured: a
  completed registry makes **0** additional drops and authorship makes **0**, against
  2,312 shipped. The two consumers share a table for different reasons, and that is
  correct rather than accidental.
- The register's responsibilities are unchanged. #11 owns `hosts[]`; this decides
  what the guard may do with it.
