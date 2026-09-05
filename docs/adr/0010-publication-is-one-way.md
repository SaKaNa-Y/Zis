# Publication is one-way

Status: accepted

Settled by
[Set up the repository and CI](https://github.com/SaKaNa-Y/Zis/issues/12).

The repository is **public** ([`repo-and-ci.md` §1](../repo-and-ci.md)), verified
on 2026-09-05 after the owner changed its visibility. The original decision was
recorded while the repository was private because the act cannot be undone.

**Private → public is a click. Public → private retracts nothing.** Anything
fetched, cloned, forked, cached, or indexed in the interval stays fetched. So the
reversibility is **asymmetric**, which is the same basis on which
[ADR-0009](0009-a-presentation-control-changes-neither-information-nor-order.md)
earned an ADR where [#17](https://github.com/SaKaNa-Y/Zis/issues/17) and
[#24](https://github.com/SaKaNa-Y/Zis/issues/24) both declined one. It is worth
being explicit about why the usual killer does not apply here: sealing is what
disarmed the irreversibility argument in those two tickets — a past Brief never
changes, so nothing ever wants one re-summarized or backfilled. Sealing has no
purchase on publication. Nothing about a Brief being immutable makes a published
commit retractable.

The decision therefore carries one consequence, and it is the whole reason this
is an ADR rather than a line in a document:

**The disclosure review happens before the flip, not after.** There is no "we
will tidy it up once it is public" path. Specifically, what becomes readable is
not the code — it is the reasoning:

- **Every issue on the repository**, including
  [the Phase-0 map](https://github.com/SaKaNa-Y/Zis/issues/1) and every ticket's
  resolution comment. The map is the most valuable artifact in the project and
  also the most complete record of what the owner reads and thinks about.
- **`.scratch/`** — prototypes and research carrying real corpus data, including
  measured feed contents and source-by-source findings.
- **The source list and the DeepSeek prompts.**

What does **not** become readable, and should not be re-litigated as though it
might:

- **Secrets.** Actions secrets stay secret, and workflows triggered by fork pull
  requests never receive them. Publication is a disclosure decision, not a
  security decision.
- **The production Interest Profile.** Its records live in Neon and must not be
  copied into the repository, issues, or workflow logs. The earlier assertion
  that no real Interest had entered Git was incorrect: the calibration prototype
  contains 20 reader-authored technical Interests and derived research outputs.
  On 2026-09-05 the owner explicitly approved retaining that existing research
  material publicly. This exception does not authorize publishing future private
  Interests or exporting the production profile. See the
  [disclosure audit](../operations/2026-09-05-disclosure-audit.md).

## Why the repository is public at all

Because [ADR-0008](0008-the-neon-wake-is-the-unit-of-compute-cost.md)'s hourly
cron is unaffordable otherwise. GitHub bills Actions per job rounded up to the
whole minute; 730 runs/month against a private repository's 2,000 free minutes
consumes 73% of the allowance at #8's own ≤2-minute run budget, and **tips over
the cap entirely if a run reaches 2m01s**. The run budget stops being a
performance target and becomes a billing cliff one second wide. Public
repositories get standard runners free and unlimited.

**This does not reopen the cadence.** ADR-0008 stands: the wake is the unit of
compute cost, Neon's 21-of-100 CU-hours is what binds first, and Actions minutes
were the fourth ceiling. An extra cron is still never small. What the flip
changes is that **one of ADR-0008's four stated ceilings stops existing** — a
correction to be applied to that ADR at the flip, not before, because the ceiling
is live until then.

## The gate

The repository must be public **before the hourly cron is enabled** — an
acceptance criterion on the Phase-1 ticket that turns the pipeline on, not a note
in prose. While no app exists, private costs nothing; the burn starts at the first
scheduled run.

And the clause that keeps this ADR from pressuring the disclosure review it
exists to protect: **if the repository is still private when the cron is ready,
the cadence drops below hourly or minutes are bought.** The flip is never rushed
to hit a schedule. A one-way door is not walked through on a deadline.
