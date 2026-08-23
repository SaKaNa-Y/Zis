# PROTOTYPE — supply spike (Zis issue #11)

**Throwaway.** Forked from `PROTOTYPE-clustering` (#6) so that ticket's artifact
stays exactly as it was published. The cascade, the cluster rules and the cases
are #6's and are not changed here — the only edits are the ones listed below.
The validated *decisions* live in
[`docs/source-register.md`](../../../../docs/source-register.md) and
[ADR-0015](../../../../docs/adr/0015-shared-ownership-must-be-asserted-by-the-register.md).

It exists to answer one question the amendment to #11 asked: **is the corpus
shortfall a source-count problem?**

The answer is no, twice over. Three of #6's highest-value contributors were
broken, and one of its highest-yield Publishers did not exist.

## What was changed from #6, and why

| change | why |
|---|---|
| `ingest.mjs` — the 24-item issue-page hydration cap is **removed** | The cap was consumed in ingest order by TLDR's 20 items plus JS Weekly's 4, so **React Status, Frontend Focus, This Week in Rust and PyCoder's were never hydrated at all** — which is exactly why they read 4 / 4 / 641 / 3 citations in #6's per-publisher table. [#8](https://github.com/SaKaNa-Y/Zis/issues/8) removed the cap as a decision; nobody had measured it. |
| `ingest.mjs` — hydration reads a **per-Publisher flag**, not a hardcoded id set | A hardcoded set silently excludes every *added* aggregator from hydration, which would have made each new one look worthless for the same reason React Status looked worthless. |
| `net.mjs` — optional `authorization`, keyed separately in the cache | GitHub releases 403 unauthenticated; #6 recorded **0 items on all nine repos** and it went unremarked. An authed response is a different response, so a shared cache slot would let the cached 403 win forever. |
| `sources.mjs` — `theregister` and `infoq` removed | [#29](https://github.com/SaKaNa-Y/Zis/issues/29) / [ADR-0014](../../../../docs/adr/0014-a-robots-verdict-belongs-to-the-host-that-served-it.md). Ars Technica **stays** — its feed host answers 404, which is a verdict. |
| `sources.mjs` — two env-flagged variants | See below. Applied *before* `HOST_OWNER` is built, or the self-citation guard would point at the wrong owners. |
| `run.mjs` — `#11 supply` report | Per-Publisher **votes at Strength ≥2 / ≥3** and **cites-per-vote**. Citations are not the currency; a Citation only counts if another Publisher independently cites the same URL. |
| `run.mjs` — `#11 per-day supply replay` | A backfill total is not a daily rate (#9's own correction). Buckets each Signal on the day the **second distinct non-origin Publisher** cites it — not `firstSeen`, which credits a backfilled Signal to a day years earlier — then windows the last 30 **calendar** days, so an empty day counts as a zero instead of vanishing. |
| `additions.mjs` — new | 36 candidate Publishers, chosen by *genre* and by the reader's 20 Interests (#46), plus the Cooper Press collapse. Carries the refusal reasoning inline. |

## Run it

```sh
# baseline: #6's roster, adapters fixed, robots casualties removed
GITHUB_TOKEN=$(gh auth token) node run.mjs

ZIS_COOPER=1   # collapse the Cooper Press family into one Publisher
ZIS_ADD=1      # apply the candidate additions
ZIS_PRESS=1    # re-run the press-tier trial that was measured and refused
```

The register as shipped is `ZIS_ADD=1 ZIS_COOPER=1`.

**The cache is not shared with #6, deliberately.** Measuring an *addition* needs
every Source in one fetch window: a freshly-fetched addition compared against an
incumbent cached eight days earlier is understated, because the addition's newest
issue links to stories the incumbents never saw. #6's cache is set aside as
`cache-aug15/` and the whole corpus was refetched on 2026-08-23. Delete `cache/`
to refetch, and refetch **everything** or the comparison is not a comparison.

## Results

| variant | Publishers | Strength ≥2 | ≥3 | median/day ≥2 |
|---|---|---|---|---|
| #6 as published | 44 | 27 | 5 | — |
| baseline, adapters fixed | 46 | 86 | 13 | 2.5 |
| baseline + Cooper collapsed | 44 | 49 | **3** | 2 |
| + 36 additions | 82 | 228 | 34 | 4 |
| + additions, Cooper collapsed | 78 | 165 | 12 | 3 |
| **the register as shipped** | **73** | **163** | **12** | **3** |

Two readings, both in `source-register.md`:

- **#6's `27 / 5` describes a pipeline nobody decided to build.** Do not quote it.
- **77% of the Strength-≥3 tier was one company agreeing with itself** — three
  Cooper Press newsletters on three hosts. Strength ≥3 is the entire admission
  condition for the `convergence` route, so the inflation sat exactly where it
  had no second check on it. That is ADR-0015.

And the finding that goes against the amendment's hope: **a 66% increase in
Publishers bought a 50% increase in the ceiling, and the ceiling is still below
the target.** Routed to [#56](https://github.com/SaKaNa-Y/Zis/issues/56).

## What it deliberately does not do

- **No embeddings, so no relevance bar.** The per-day figures are *eligibility
  ceilings* at Strength ≥2 — what the Brief is drawn *from*, before any Interest
  match and before `T+`. The Brief is smaller. Getting the real Brief size needs
  #21's calibration prototype re-run over this corpus, which is a separate spend.
- **No verdict on the additions' relevance.** A Publisher's cites-per-vote says
  nothing about whether the reader wants to read it, and origin blogs vote zero
  by construction. `source-register.md` §4 is the rule.
