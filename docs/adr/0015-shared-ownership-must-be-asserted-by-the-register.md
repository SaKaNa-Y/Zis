# ADR-0015 — Shared ownership must be asserted by the register, because no constraint can detect it

**Status**: Accepted
**Date**: 2026-08-23
**Ticket**: [Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11)
**Supersedes nothing. Amends**: the "buy the aggregators first" advice in
`.scratch/zis/research/candidate-sources-rss.md`, which is now wrong as stated.

## Context

`CONTEXT.md` defines a **Publisher** as "a single owning voice on the web — an
organization, a person, or a community — regardless of how many accounts or feeds
it speaks through", and defines **Strength** as a count of distinct Publishers
"never a count of Citations, Items, or Sources — one loud voice must not be able
to manufacture agreement with itself."

[Specify the clustering algorithm](https://github.com/SaKaNa-Y/Zis/issues/6)
turned the second sentence into a schema rule: `host → publisher_id` is UNIQUE,
found by a negative control in which GitHub's blog and GitHub's changelog were
registered as two Publishers sharing `github.blog`, which silently disabled the
self-citation guard and let GitHub vote on its own changelog.

That constraint catches shared ownership **only when the hosts collide**. Two
facts show it is not enough.

**The measured one.** #6's corpus reported JavaScript Weekly, React Status and
Frontend Focus as three of the highest-yield Publishers in the whole register.
Re-measured on a clean fetch window with the pipeline as
[Specify the ingestion pipeline](https://github.com/SaKaNa-Y/Zis/issues/8)
actually settled it, they were the **top three suppliers of Strength in the
corpus**, contributing 102 of its votes. All three are **Cooper Press** — one
company, one editorial operation, on three different hosts, with four more
newsletters available on four more hosts. The research document had recorded the
overlap approvingly: of Frontend Focus, *"Overlaps JS Weekly heavily — good,
that's the point."*

Under the glossary that overlap is not the point. It is self-citation. Collapsing
the family into one Publisher and re-measuring:

| | Publishers | Signals at Strength ≥2 | at Strength ≥3 |
|---|---|---|---|
| Cooper Press as three voices | 46 | 86 | 13 |
| Cooper Press as one voice | 44 | 49 | **3** |

**77% of the entire Strength-≥3 tier was one company agreeing with itself.**
Strength ≥3 is the sole admission condition for the `convergence` route
(ADR-0006), so the inflation was concentrated precisely where it did the most
damage: on the route that fires *without* an Interest match and therefore has no
second check on it.

**The structural one.** `hnrss.org` was banned as a Transport by
[#8](https://github.com/SaKaNa-Y/Zis/issues/8) on exactly this reasoning — a
different host, so "the `host → publisher_id` constraint can't catch the
double-count", unlike Simon Willison's three same-host feeds which need no rule.
`rsshub.app` was excluded as a Transport wholesale because "N Publishers behind
one host would break the `host → publisher_id` UNIQUE rule the self-citation
guard depends on." Both are the same finding arriving one case at a time.

## Decision

**Shared ownership is a property the register asserts, not a property the schema
detects.** Where two candidate Sources are owned by one entity, they are one
Publisher — and it is the register's job to say so, because in the general case
nothing in the data can tell.

Three rules follow, in the order they bite:

1. **Same host → the constraint catches it.** `host → publisher_id` UNIQUE stays,
   and stays enforced at the schema level. It is necessary and it is not
   sufficient.

2. **Different hosts, same owner → the register must merge them by hand.** There
   is no signal to key on: Cooper Press's seven newsletters share no host, no
   feed platform detectable from the URL, and no self-referencing link. Only
   knowing who owns them decides it. Cooper Press ships as **one Publisher with
   many Sources**, which is exactly the shape `CONTEXT.md` already describes for
   Vercel's release, video and social surfaces.

3. **Shared host, different owners → the Publisher may not be registered at
   all.** A Publisher whose only address is a *path* on a shared publishing
   platform (`buttondown.com/<name>`, an RSSHub route) cannot be expressed:
   claiming the bare host collides with every other tenant and disables the
   guard for one of them, and claiming nothing means the guard never fires. Such
   a candidate is **excluded**, which is the `rsshub.app` ruling generalized from
   a Transport to a rule. A custom domain on a shared platform is *not* this case
   — `netflixtechblog.com` and `blog.angular.dev` are both Medium-hosted and both
   are one host with one owner.

## Consequences

**The register carries an ownership column that no test can verify.** This is a
real cost and it is the reason this is an ADR rather than a line in a document:
every future Source addition requires a human to ask "who owns this", and getting
it wrong inflates Strength silently and in the direction that flatters the
product. There is no negative control that catches it, because a negative control
needs a signal to fire on.

**It is irreversible in the one way that matters, and sealing is what makes it
so.** Briefs are **sealed** once cut ([#14](https://github.com/SaKaNa-Y/Zis/issues/14)),
and a Brief Entry freezes the Strength that admitted it. If a Publisher identity
is wrong when a Brief is cut, that Brief is permanently wrong and cannot be
recomputed — the entry claims a convergence that never happened, and the
provenance page will list rows a reader can count that do not add up to the
number beside them. This is the opposite of how sealing behaved in
[#17](https://github.com/SaKaNa-Y/Zis/issues/17) and
[#24](https://github.com/SaKaNa-Y/Zis/issues/24), where sealing *killed* the
irreversibility argument because a past Brief never wants re-rendering. Here
sealing *is* the irreversibility: it converts a data-modelling slip into a
permanent false claim, and the whole positioning rests on "the number behind it
is one you can count by hand" (ADR-0011).

**"Buy the aggregators first" survives, but not as stated.** Aggregators remain
the only genre that raises Strength at all — the corrected Cooper Press
Publisher is still tied for the highest-yield row in the register. What dies is
the idea that *more* aggregators from the *same* stable are more supply. Seven
Cooper Press newsletters are one voter, so buying the remaining four buys
coverage and text, not Strength.

**Two candidates were refused on rule 3 rather than on yield**, and the yield
happened to agree, which is worth recording so the rule is not later
re-derived from the yield: Hillel Wayne (Buttondown path, 0 votes) and
`rsshub.app` (already out).

**What this does not license.** It is not a general licence to merge Publishers
that merely *agree* a lot. Bramus, Rachel Andrew, Lea Verou and Stefan Judis
overlap heavily on Interest #16 and are four independent voices; the research's
"redundancy is a feature" argument is correct *for them* and the reason is
ownership, not correlation. Correlated coverage is the signal. Common ownership
is the double-count. Only the second is refused here.
