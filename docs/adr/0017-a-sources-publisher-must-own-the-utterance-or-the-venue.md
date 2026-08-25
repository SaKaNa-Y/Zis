# ADR-0017 — A Source's Publisher must own the utterance or the venue; owning the selection is not enough

**Status**: Accepted
**Date**: 2026-08-25
**Ticket**: [Decide how a Bluesky feed generator becomes Publishers, or whether it can](https://github.com/SaKaNa-Y/Zis/issues/57)
**Supersedes nothing. Amends**: the *"Not excluded, and worth saying"* paragraph of
[`source-register.md`](../source-register.md) §6, which held this question open, and
the "the path is follow-graph + feed-generator polling" finding carried on the
Phase-0 map from
[Verify source API limits against official docs](https://github.com/SaKaNa-Y/Zis/issues/2)
— the follow-graph half stands, the feed-generator half is refused here.

## Context

`.scratch/zis/research/candidate-sources-platforms.md` §3.3 verified **11 Bluesky
feed generators**, five of them readable unauthenticated via
`app.bsky.feed.getFeed`, each pollable exactly like an RSS feed with no auth and
no follow graph. They are streams of link-carrying posts, which is the genre
[Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11)
measured as the only one that raises Strength at all. §6 of the register recorded
them as *"the largest untapped supply in the candidate set"* and deliberately left
the modelling question open.

**A feed generator has no owning voice.** It is a stream of *other people's*
posts, and `CONTEXT.md` defines a **Publisher** as an owning voice. Both obvious
models are wrong, and they fail in opposite directions:

- **One Publisher per feed generator** makes a single voice that cites
  everything. A curated tech feed will co-cite whatever the register's real
  Publishers cite, manufacturing Strength on volume — the failure Strength exists
  to prevent, and the failure
  [ADR-0015](0015-shared-ownership-must-be-asserted-by-the-register.md) measured
  costing 77% of the convergence route.
- **One Publisher per post author** is right in principle and requires
  registering Publishers on the fly from a third-party stream, each needing an
  ownership assertion ADR-0015 says only a human can make.

Two facts settle it before any new rule is needed.

**The supply argument is void.** This ticket was priced in brief density, and
[ADR-0016](0016-brief-density-is-an-observation-not-a-target.md) retired that
currency: there is no density target to be short of, and **no change may be
justified by brief density**. #11 had already measured the slope — 66% more
Publishers bought 50% more ceiling. Whatever this decision is, it is not a supply
decision.

**ADR-0015 rule 3 already refuses it, as an extension rather than a quotation.**
Rule 3 refuses a Publisher whose only address is a *path on a shared platform*,
because `host → publisher_id` cannot express path-scoped ownership: claim the bare
host and the next tenant collides, silently disabling the self-citation guard for
one of them; claim nothing and the guard never fires. A `*.bsky.social` author has
exactly that address and nothing else, and a feed generator is worse —
`at://did:plc:…/app.bsky.feed.generator/news-tech` is a path under a DID that owns
none of the content. Rule 3 was written about publishing platforms (Buttondown,
RSSHub) and this is a social handle, so it is stated here as **rule 3 generalized**,
not as rule 3 applied. Note what the register actually keys: a Publisher's `hosts`
are its *own* web addresses and a `bluesky-author` Source is keyed by **DID**, which
is why 18 author feeds sharing `public.api.bsky.app` never collided — the API host
was never the key. An author with a **custom-domain handle** (`una.im`,
`crawshaw.io`) is the `netflixtechblog.com` case and remains registerable, by hand,
as an author feed.

**And the third model — discovery without registration — buys arithmetically
zero.** A Citation belongs to a Source, and Strength counts distinct Publishers, so
a discovered-but-unregistered URL adds no Publisher and therefore no Strength; the
`citing` text rung is *the citing Publisher's anchor text for that exact link*
(ADR-0013), so it adds no rung either. It widens the `Link` table and moves nothing
that decides Admission.

### The obvious rule kills Hacker News

The natural statement of the refusal — *a Source's Items must be authored by its
Publisher* — refuses `hn`, which is 438 Citations and the origin of three of the top
four Signals in the corpus. An HN Item is somebody else's submission.

The line that survives the counterexample is **venue**. An HN submission was *made
to HN* and exists nowhere else; `CONTEXT.md` already admits a **community** as an
owning voice. A post in a feed generator was made to its author's own PDS, and the
generator is a third party selecting over someone else's venue.

## Decision

**A Source's Publisher must own either the utterance or the venue it was uttered
in. A candidate that owns only the *selection* is not a Source, and cannot be made
into one by registering the selector, the selected, or both.**

Three notes on how it bites:

1. **It is a disqualifier, not a selector.** Where both an utterance-owner and a
   venue-owner exist and are different, which one the register names is a curation
   call the alias rules of
   [Specify the clustering algorithm](https://github.com/SaKaNa-Y/Zis/issues/6)
   already govern. This rule only removes candidates that are *neither*.
2. **It bites on a Source's identity, never on individual Items.** An author feed
   carries reposts and quote posts, which are other people's utterances inside a
   Source whose venue is the author's own account: the Source is sound. What a
   repost counts *for* is a Citation-level question, already answered — research
   §3.5 rules that **a repost must not count as a second distinct source citing a
   URL**. This rule is that principle lifted from Citation to Source, and the same
   clause is what stops HN being re-litigated.
3. **The two grounds are independent.** Authorship (this ADR) and addressability
   (ADR-0015 rule 3) each refuse a Bluesky feed generator on their own. A future
   amendment to one does not readmit it.

**Refused by this rule**: Bluesky feed generators, Flipboard Tech, a Google News
RSS query, any third-party "best of" feed over a venue the selector does not own.
**Unaffected**: Cooper Press and Techmeme (own the utterance — a newsletter issue
and an editor-written headline are things the Publisher said), HN and the 18
Bluesky author feeds (own the venue), GitHub release watches and every origin blog.

## Consequences

**The largest untapped supply in the candidate set is closed, and the phrase is
retired with it.** `source-register.md` §6 stops holding the question open and
records authorship as a ground; the map drops the phrase. It was denominated in
ADR-0016's dead currency and will otherwise be quoted back as a reason.

**Reading a feed generator by hand stays legitimate, and is not a feature.** A
curator may open one to *find* candidate authors, who then get registered normally
with an asserted owner. Research §3.3 keeps the AT-URIs and the fact that `getFeed`
reads unauthenticated, so the hand pass stays cheap. There is no runtime role: the
discovery endpoint is `app.bsky.unspecced.*`, explicitly unstable, one "popular"
feed already answers `XRPCNotSupported`, and a feed generator lands on
`public.api.bsky.app` where `source-register.md` §7 records the Bluesky tier as the
run's longest pole and a *sequential chain* — so polling one costs wall-clock, which
[ADR-0008](0008-the-neon-wake-is-the-unit-of-compute-cost.md) makes a compute cost,
to buy the zero above.

**The rule is a hole this ADR closes, and it was reachable without Bluesky.** A
third-party curated RSS feed is the same shape and would have arrived through
ordinary curation with nothing to refuse it by, since it has a host of its own and
so passes rule 3 cleanly. That is the case this ADR is really for; the feed
generator is only where it was noticed.

**What it does not license.** It is not an argument against Aggregators — they
remain the only genre that raises Strength, and ADR-0015's corrected Cooper Press
Publisher is still tied for the highest-yield row in the register. Owning the
selection *as well as* an utterance is exactly what an Aggregator does. The refusal
is for a candidate that has only the selection.
