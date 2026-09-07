# Zis — Phase 0 spec

The consolidating document for [Zis — Phase 0 Map](https://github.com/SaKaNa-Y/Zis/issues/1).
Every decision on that map is settled; this is where they are made to agree with
each other, and where the places they do not are written down.

## 0. What this document is, and is not

**It is a thin index.** A decision lives in exactly one place — its ticket, and
the domain doc that ticket wrote. This spec restates none of them. Its own prose
covers only what exists nowhere else: the positioning paragraph, the core loop end
to end, the cross-doc contradictions and how they resolve, the compute arithmetic
assembled in one place, what v1 refuses, the Phase 1 build sequence, and an honest
verdict against the motivation.

**It is not a substitute for the docs it points at.** Anyone building from this
reads `CONTEXT.md` first and then the doc for the area they are touching. The
pointers below are load-bearing, not courtesy links.

**A note on every number in this document.** No count here is a current
measurement, and each carries the corpus it came from inline. There are two, and
they are not interchangeable:

- **The 48-Publisher clustering replay** — 1,395 Items / 6,468 Citations / 4,986
  Signals from 47 Sources. Three broken adapters, Cooper Press triple-counted.
  Source of every *entry-count* and *why-text* figure.
- **The 73-Publisher supply replay** — the register as curated. Source of every
  *supply* figure.

`source-register.md` §8 rules the first **not transferable** to the second, and
§8.1 adds that a single-snapshot replay structurally understates its own older
days — the window's first 16 days hold 33 eligible Signals and 5 of its 6 blanks;
the last 14 hold 60 and one. Read every figure below as the shape of an argument.
§14 says what has to happen before any of them may be quoted as current.

---

## 1. Positioning

Zis is a bounded daily tech brief where the reason each story appears is a
sentence you wrote, and the number behind it is one you can count by hand. It
polls a global corpus of curated Publishers on a fixed schedule, detects
convergence deterministically by URL co-citation rather than by a model, and
admits a story only when it clears an absolute test — either one of the reader's
own Interest statements matched it, or enough independent Publishers converged on
it that it earns a place without one. There is no score, no ranking blend, no
unread count, no infinite scroll, and no escape hatch to the firehose. A Brief may
honestly hold one entry, and says so.

Full document: [`docs/positioning.md`](../../docs/positioning.md). Read §8,
"Refused, and the rule each fails", before proposing a feature.

### 1.1 Zis claims one shipped structural difference, and one specified but not yet true

ADR-0011 is the test: a claimed advantage is admissible only if a competitor would
have to give something up to copy it. `positioning.md` §3 claims two. After the
ADR-0012 → ADR-0018 → ADR-0019 sequence, only one of them ships true.

**Shipped: admission is an absolute bar, never a top-N cut** (ADR-0006, #14). This
passes on a commercial give-up. Every competitor's digest is a top-N cut; copying
the bar means shipping days with one entry, and only a product with no churn to
lose can afford that.

**Specified, not yet true: the explanation-constrained formula** (ADR-0006 /
ADR-0003). The *constraint* is real and honoured everywhere — a term that cannot be
rendered into the why-text from stored columns alone is disqualified, which is why
there is no score, no Publisher trust weights, and no velocity term. The
*rendered sentence* is a different matter: **4 of 8 why-texts on the 48-Publisher
replay name an Interest the reader would not have written.** ADR-0019 closed the
class on both sides of the cosine — the fault is embedding knowledge, so no
arithmetic over the vectors reaches it, and the one candidate that would (a
re-ranker) is out of scope on compute grounds.

This is a **named Phase-0 defect against ADR-0011's claim**, not a softening of it.
The test is unchanged; Zis fails half of it today. `positioning.md` §7.1a is right
to call this the claim failing *visibly* rather than quietly, and that is the
better failure of the two.

---

## 2. The core loop

What happens between a story breaking and it reaching the reader.

1. A Publisher publishes. Nothing happens yet.
2. Within the hour, one of Zis's Sources — that Publisher's own feed, or an
   Aggregator that linked it, or an HN submission — is polled. The Item is
   normalized; if the Source is an Aggregator serving excerpts, its issue page is
   hydrated to recover the link list that *is* its value.
3. Every URL in that Item is canonicalized into a `Link` through the L1–L5
   cascade, and reference-only or intra-publisher URLs are dropped before anything
   is counted. Each surviving URL becomes a `Citation`.
4. A `Signal` already exists for that `Link`, 1:1, created eagerly. Deterministic
   alias rules may fold a vehicle post into the thing it points at.
5. `Strength` — `COUNT(DISTINCT publisher_id)`, origin-excluded, self-citation
   guarded — rises when a *second, different* Publisher cites the same Link. This
   is the moment the story becomes a story.
6. At the reader's local cut hour, on the hourly wake that crosses it: new and
   improved Signals are embedded, matched against the reader's separately-embedded
   Interests, and tested against two absolute admission routes.
7. Admitted Signals become `BriefEntry` rows in a `Brief`, ordered, then **sealed**.
   Only then are they summarized — admitted Signals only, which is what makes the
   AI bill $0.40/month instead of $50.
8. The reader opens Today. Each entry is a title linking out to the origin, a
   summary, a Publisher name, and — on the interest route — the sentence they
   wrote, linking to the provenance page where the co-citation arithmetic can be
   checked by hand.

The whole loop is deterministic except step 7's summary, and nothing in it puts a
model on the path that decides what the reader sees.

---

## 3. Entity model

**Read [`CONTEXT.md`](../../CONTEXT.md).** It is the ubiquitous language and it is
settled ([#5](https://github.com/SaKaNa-Y/Zis/issues/5)). The spine is
`Item` → `Citation` → `Link` → `Signal`. `Entity`, `Topic`, `Digest`, `Article`,
`unread count`, `Slot`, `Quota` and `Score` are **banned project-wide**, each for a
stated reason.

Not restated here, on purpose: a second copy drifts from the first edit.

---

## 4. Source set

**Read [`docs/source-register.md`](../../docs/source-register.md) and
[`source-register.json`](../../docs/source-register.json)** before adding, cutting,
or citing a Source ([#11](https://github.com/SaKaNa-Y/Zis/issues/11)).

**73 Publishers / 96 Sources**: 67 RSS/Atom, 18 Bluesky author feeds, 9 GitHub
release watches, 2 HN lists, plus three retained negative controls.

Why each is in, in one line: the curation metric is **cites-per-vote** — a Citation
counts for nothing unless another Publisher independently cites the same URL — and
it spans 3.6 to 391.5 with no relation to volume or prestige. The register runs on
**two currencies**, and a single-metric cut would delete one: 28 of 73 Publishers
raise Strength zero times, and origin blogs do so *by construction* (Strength
excludes the origin), earning their slot on the `own` text rung instead.

Four things easy to get wrong from a summary:

- **Shared ownership is asserted by the register, never detected by the schema**
  (ADR-0015). `host → publisher_id` UNIQUE is necessary and not sufficient — three
  Cooper Press newsletters on three hosts were the top three Strength suppliers and
  are one company, worth 77% of the Strength-≥3 tier on the 48-Publisher replay.
- **A Source's Publisher must own the utterance or the venue** (ADR-0017). Owning
  only the *selection* over someone else's venue is not a Source — which refuses
  Bluesky feed generators and `rsshub.app` wholesale.
- **A robots verdict belongs to the host that served it** (ADR-0014), in both
  directions, and it is **perishable state with a TTL, not a boolean**. Four blanket
  blocks landed on ordinary tech hosts inside three years.
- **`Unverifiable` is a third register state**, not a synonym for excluded. InfoQ
  holds it.

Out, and on which ground: Reddit and X on terms and cost; Bilibili, Lobsters, The
Register, Changelog on verified `Disallow: /`; YouTube channel feeds on robots
**and** on the ground that survives a robots change — a channel does not vote.
Interest #8 (the AI industry as a business) has **no voting supplier** and is
recorded as a hole rather than filled.

---

## 5. Ingestion architecture

**Read [`docs/ingestion-pipeline.md`](../../docs/ingestion-pipeline.md)**
([#8](https://github.com/SaKaNa-Y/Zis/issues/8)).

**Where it runs**: a Node script inside the **GitHub Actions runner**, connecting
to Neon directly. Not a Vercel cron, not an Actions cron hitting an authenticated
route handler — that design was overturned, and with it the cron endpoint was
**deleted rather than hardened**, which is why login is the only unauthenticated
route in the product.

**Schedule**: hourly, one cron, one wake. ADR-0008 — **the wake is the unit of
compute cost**, not the query. An extra cron is never small, cheaper queries save
nothing, and run duration is itself a compute variable. Read it before proposing
any schedule change.

**Stages**: stage 0 asserts ADR-0020's host-ownership invariant and **fails the
run** if it breaks. Hourly: select due → fetch → normalize → **hydrate** → canonicalize
→ citation-worthiness → alias merge → strength. Daily, inside the wake crossing the
cut hour: embed → match Interests → admission → cut → seal → **summarize admitted
only** → prune.

There is no dedupe stage (canonicalization *is* the dedupe) and no score stage
(ADR-0006).

**Failure handling**: commit per Source, so one flaky origin cannot starve the
corpus; the natural key makes re-running free. **Failure and dormancy are two
signals with two consequences** — a Publisher's silence is not a fault, so a
Dormant Source is surfaced for a human to judge rather than treated as broken.

**One accepted coupling, named because it is the sharpest failure mode**:
embedding runs inside the cut, so an embedding outage yields a thin Brief that then
**seals** that way. Accepted for v1; the fix, if it fires, is moving embed to the
hourly run, and it costs no extra wake.

**Retention**: full text ~30 days, then title + canonical URL + summary + embedding
indefinitely. **This may not be shortened to buy density** — it is irreversible
under ADR-0005, it costs Interest-matching text directly, and it frees storage when
**compute is what binds**.

---

## 6. Clustering

**Read [`docs/clustering-model.md`](../../docs/clustering-model.md)**
([#6](https://github.com/SaKaNa-Y/Zis/issues/6)).

Detection is deterministic, without qualification. URL co-citation is the spine;
the LLM names and summarizes clusters and **never detects them**.

- **Canonicalization**: L1 syntactic → L2 query-param denylist with per-host
  allowlists **keyed by path shape** → L3 shape aliases → L4 redirect unwrap → L5
  publisher-declared canonical (which can arrive as an HTTP header, and needs a
  cross-site rejection guard).
- **Citation-worthiness**: a reference is not a citation. Reference-only URLs and
  intra-publisher links are excluded **before** Strength is counted — 3,863 junk
  Citations on one day of the 48-Publisher corpus, and removing them killed 2 false
  clusters and 0 true ones.
- **Signals are created eagerly, 1:1 with Links, and only ever merged** (ADR-0002).
- **There is no cluster-formation window** (ADR-0004). Co-citation raises Strength
  without merging, so a stale cluster absorbing new arrivals is how a growing story
  works, not a failure. Temporal decay lives in ranking.
- **The embedding second pass is cut from v1 detection** — measured precision worse
  than 1:2, and three quarters of Signals have no ingested text for it to read.
  Embeddings survive only for matching Signals to Interests.
- **The self-citation guard is scoped to the Publisher and keyed on the Signal's
  target** (ADR-0020): a Publisher that owns the story does not vote on it. Do not
  propose a second key.

---

## 7. Ranking

**Read [`docs/ranking-model.md`](../../docs/ranking-model.md)**
([#9](https://github.com/SaKaNa-Y/Zis/issues/9)) before designing anything that
decides what a reader sees.

**The governing rule is ADR-0006: the explanation constrains the formula, not the
reverse.** A term that cannot be rendered into the why-text from stored columns
alone is disqualified. Consequences: there is **no score**, no weighted sum, no
Publisher trust weights, and **no velocity term in v1**.

**Eligibility** — all four must hold: `STRENGTH >= 2`; `AGE <= 7 days`; no
`BriefEntry` for this reader and Signal ever (ADR-0007); no `ReadState`.

**Admission — two nested absolute routes**:

```
MATCHED     REL+ >= T+[text_basis]
interest    MATCHED
convergence STRENGTH >= 3  AND NOT MATCHED
```

`≥2` on both routes would be degenerate — it makes them exhaustive and demotes the
relevance bar to a caption. There is **no quota and no reserved slot count**; each
route self-limits because each is an absolute test.

**The numbers, and what they are conditional on.** `T+` per rung: `own` **0.70**,
`citing` **0.67**, `slug` uncalibrated. `H` = **36h**, measured. **There are no
negative Interests** — `T−` has no value that does not empty the Brief, and #46
made it unmeasurable by construction when the reader deleted the draft's negatives
as not theirs. Every cosine here is conditional on `bge-small-en-v1.5` *and* on the
specific Interest Profile it was sited against; a model swap is a re-calibration,
not a config change.

**`T_gap` is gone** (ADR-0018). `GAP` is still computed and stored, gates nothing,
and is never rendered — §8.2 bans showing a relevance number.

**Text Basis**: `own` ≻ `citing` ≻ `slug`, unconditional, no tiebreak (ADR-0013) —
a **coverage** decision, not a quality one. The `own` rung embeds title + extracted
body at a **1200-char cap that is a storage and compute bound, never a relevance
parameter**. Three attempts to make the rung a quality lever all selected for
polluted text.

**Ordering**: interest admissions first, by `REL+` descending; then convergence, by
`DECAY × STRENGTH` descending. Putting convergence first is Techmeme's ordering and
inverts the claim.

**Cut time**: one Brief per reader per local day, at a fixed hour in a stored
`User.timezone`, riding an existing ingestion wake, with a uniqueness guard on
`(user_id, local_date)`.

**Cold start**: the corpus's is the real one, and a **backfill answers it** — it
must run before the first Brief is ever cut, or Brief #1 seals against an empty
Citation graph.

**Density is an observation, not a target** (ADR-0016). No change to `E1`, `T+` or
the interest route's selector may be justified by brief density. The one watched
quantity is a **supply alarm**: the longest run of consecutive days with zero
eligible Signals at Strength ≥2, provisionally **2** on the 73-Publisher replay and
**not permitted to fire until re-sited on forward-running data**. See §15.

---

## 8. AI strategy

**Generation: DeepSeek `deepseek-v4-flash`.** OpenAI-API-compatible. No free tier —
cheap, not free. ~$0.40/month at 10 clusters/day, because **only admitted Signals
are summarized**; summarizing everything would be ~1,400 calls/day instead of ~10.
`response_format: json_object` only, no JSON Schema mode, and the API may return
empty content — **plan for validate-and-retry**. Use the explicit model id; the
`deepseek-chat` / `deepseek-reasoner` aliases are retired.

**Embeddings: `bge-small-en-v1.5` at 384 dimensions**, via Cloudflare Workers AI
REST, with `transformers.js` as a drop-in local runtime for the *same weights* — no
key, no quota, no provider call. **This is a model choice, not a vendor choice**,
which is what makes the non-hot-swappable constraint tolerable. 384-dim `halfvec`
is ~82 MB/yr against a 0.5 GB Neon cap; 1536-dim would exceed the whole tier inside
a year.

**Both behind a provider-agnostic interface.** "Pin the model, not the vendor"
holds only *within* a fixed dimension — a dimension change is a migration plus a
full re-embed.

**Prompt-injection posture** (`security-model.md` §4): **AI output is untrusted.**
Rendered as plain text, never HTML, never auto-linkified. The LLM only ever sees
already-public article text, because it names and summarizes and never detects.
**The Interest Profile must never enter a DeepSeek prompt** — it is the one
genuinely personal artifact in the system, and it feeds deterministic ranking, not
generation. The summary prompt **pins English** regardless of the Item's language;
a Brief is sealed, so summary language is baked at cut time.

---

## 9. Auth

**A hand-rolled signed session cookie** ([#4](https://github.com/SaKaNa-Y/Zis/issues/4)):
`jose` HS256 JWT in a `__Host-` cookie, a seeded Argon2id credential, and a
`session_version` integer on the user row for server-side revocation. This is
first-party Next.js documented guidance, and it is defensible here precisely
because the parts where hand-rolled auth goes wrong — signup, reset tokens, email
verification, account linking, OAuth state machines — **do not exist in this
product**. Clerk is out on a non-configurable 7-day free-tier session; Auth.js v5
on ~33 months in beta; Neon Auth on "anyone can sign up by default".

**Deny-by-default routing.** No signup route exists at all; the account is seeded
by migration. Every route is auth-gated and **login is the only exception** — the
cron endpoint that used to be the second one was deleted by #8.

**Three Next.js 16 facts that most tutorial content gets wrong**, and that this
routing depends on:

- `middleware.ts` is deprecated and renamed **`proxy.ts`**; the export must be
  named `proxy` or be the default.
- Proxy runs on the **Node runtime by default**, and setting `runtime: "nodejs"`
  there **throws**.
- **Server Functions are not separate routes** — they POST to the route they are
  used on, so excluding a path from the proxy matcher un-gates every Server Action
  on it. **Proxy is optimistic; the `verifySession()` DAL is the boundary.**

**There is deliberately no in-app passphrase recovery**
([#18](https://github.com/SaKaNa-Y/Zis/issues/18)). The passphrase is a
**generated high-entropy secret**, not a chosen phrase, which is what makes that
safe. Recovery is one Neon-side `UPDATE` that must bump `session_version`. No reset
route, no recovery-code table, no break-glass env var — a second path that can mint
a session is the bypass shape #7 bans. Standing operator requirement: **Neon access
must not share a failure domain with the passphrase.**

---

## 10. Security model

**Read [`docs/security-model.md`](../../docs/security-model.md)** before writing
anything that fetches, parses, or renders
([#7](https://github.com/SaKaNa-Y/Zis/issues/7)).

The three load-bearing invariants:

- **`safeFetch` is the only egress in the system** — every outbound request,
  curated Sources included, no exemption list — enforced by **lint, not review**, so
  a stray `fetch` fails CI. It resolves DNS, validates every returned address, and
  connects to the **pinned IP** via undici's `dispatcher` (never `agent`, which
  undici silently ignores). Exactly **two call sites**, confirmed by #17 cutting
  images.
- **No publisher HTML is ever stored or rendered** (ADR-0005). Extraction produces
  text, which *deletes* the sanitizer question rather than answering it.
- **Polite fetching is a hard rule.** `robots.txt` per host **before** liveness,
  never after — a liveness probe cannot fail in a way that reveals a robots problem,
  which makes a green liveness column actively misleading. Only a `text/plain` 200
  or a hard 404 yields a verdict; **everything else is ambiguous and fails closed**.
  A 404's body is never evidence. The parser must handle `*`, `$` and
  longest-match-wins, or it fails **closed** on the corpus's highest-yield Source.

---

## 11. Information architecture

**Read [`docs/ui-and-ia.md`](../../docs/ui-and-ia.md)** before designing any screen
([#10](https://github.com/SaKaNa-Y/Zis/issues/10),
[#15](https://github.com/SaKaNa-Y/Zis/issues/15)).

**Five destinations and no others**: Today, Earlier, Saved, Interests, Settings.
Discover, Following, Topics and an AI assistant are all cut, each for a stated
reason — a browse surface *is* the "Everything" escape hatch under another name.
Desktop gets a persistent rail; a phone does not, and the destinations live in the
footer, reached having finished.

**The brief's shape.** The two Admission routes render as a **section break whose
heading is the explanation**, so **no badge exists anywhere in the product**. A
Brief Entry is title, summary, Publisher name, why-text, link — **no images, no
favicons, no Source icons, in Phase 0, full stop**. The title links out to the
origin; the why-text links to a Signal provenance page. A reading view is
*unavailable*, not unwanted — ADR-0005 stores no HTML to render.

**There is no `Card` and no container behind an entry at all**, which is what makes
a one-entry Brief look deliberate rather than broken. Short and empty states were
designed first.

**Stack**: Tailwind v4 and nothing else — no component library, no headless
primitive. The whole interactive inventory is `<form>` + Server Action,
`<details>`, `<select>` and anchors, so #15's escape hatch was never reached.

**Two CI-enforced rules**: **no `px`** in type size, line-height, spacing or the
measure (hairline borders excepted), because that is the entire basis on which
browser zoom substitutes for a text-size control; and colour is **semantic tokens
only, with not one `dark:` utility**, which is what makes light/dark parity
structural.

**Nothing is reader-adjustable** (ADR-0009): a presentation control is admissible
only if it changes neither which information renders nor its order. Every layout
candidate fails; the theme passes and lives in a **per-device cookie**, not a
`User` column. **The whole surface is English** — no i18n library, no string table,
no language control.

---

## 12. Stack, and the arithmetic that justifies the cadence

**Next.js 16 (App Router) + Drizzle + Neon Postgres**, tiered retention from day
one. **Vercel Hobby serves only the UI.** The pipeline is a Node script in the
**GitHub Actions runner** talking to Neon directly. DeepSeek for generation, a
separate embeddings provider, both behind a provider-agnostic interface.

Consequence worth watching: `safeFetch` and the canonicalization cascade are
imported by **two entry points**, so a second copy in a standalone script is the
failure mode. `repo-and-ci.md` §6 — one package, and the pipeline is not a second
copy. Lint and typecheck must cover **`scripts/` as well as `src/`**.

### The compute budget

The unit of cost is the **wake**, not the query (ADR-0008).

| | hourly (shipped) | 15-minute (rejected) |
|---|---|---|
| Wakes/day | 24 | 96 |
| Wake cost | ≤2 min run + 5 min idle tail = **7 min** | 7 min |
| Per day | 168 min = 2.8 h | 672 min = 11.2 h |
| Per month | 84 h → **21 CU-hours** @ 0.25 CU | 336 h → **84 CU-hours** |
| Neon free cap | 100 CU-hours | 100 CU-hours |
| Headroom for UI | **~79 CU-hours** | 16 CU-hours |
| Actions | 720 runs ≈ 720–1,440 min of 2,000 free | 2,880 runs vs 2,000 min — **breached** |

Storage: 0.5 GB cap against ~82 MB/yr of embeddings plus a 30-day text window.

**Two provisioning requirements the arithmetic depends on**, and both are easy to
lose: **pin the compute to a fixed 0.25 CU (min = max)** — Neon's free tier
autoscales to 2 CU, which multiplies every figure above by up to 8 — and note that
**scale-to-zero cannot be disabled on the free plan** (5 min, fixed), which is what
makes the idle tail a constant rather than a tunable.

15 minutes was an assumption from charting that no requirement ever supported.
Nothing in Zis renders faster than daily.

### Repository and CI

**Read [`docs/repo-and-ci.md`](../../docs/repo-and-ci.md)** (ADR-0010). The
repository is **public, and publication is one-way**, so the disclosure review
happens **before** the flip — and the flip is itself gated: **public before the
hourly cron is enabled**, with the fallback that a still-private repo at that point
**drops the cadence** rather than rushing a one-way door.

**CI is one sequential job**, because GitHub bills per job rounded up to the whole
minute. It enforces two invariants no stock config has: #7's egress rule as
**explicit ESLint** (`next lint` is gone in Next 16) and ADR-0009's no-`px` rule as
a standalone scan script, **both covering `scripts/`**. Migrations are manual and
never in the Vercel build step, snapshot first. **Vercel holds no AI keys at all**,
so `DATABASE_URL` is the only variable in both places — and that asymmetry is a
security property.

---

## 13. Contradictions between independently-resolved decisions

The part this document exists for. Three surfaced; all three are resolved above,
recorded here so nobody re-derives them.

**13.1 — The claim is asserted in one doc and measured false in another.**
`positioning.md` §1 claims the reason each story appears is a sentence you wrote.
`ranking-model.md` §6 records 4 of 8 of those sentences wrong on the 48-Publisher
replay. **Resolved in §1.1**: one shipped structural difference, one specified and
not yet true, ADR-0011 unsoftened.

**13.2 — Two docs disagree about which corpus the entry counts came from.**
`ranking-model.md` §9.4 presents the `6 interest / 4 convergence` split inside a
table headed by **73-Publisher** supply figures. `positioning.md` §7.1a states
that every entry count in §7.1 and §7.1a comes off the **48-Publisher** cache and
is not transferable. Both cannot be true of the same number. **Resolved**: treat
the split as a 48-Publisher figure — §7.1a is the more specific and more recent
claim, and it is the one that names its own staleness. `ranking-model.md` §9.4's
table mixes provenances and should be corrected when the re-replay in §15 supplies
real values. Until then the supply rows (163 eligible, median 3/day, median Brief
1, 6 empty days, longest run 2) are 73-Publisher, and the admission-split rows are
not.

**13.3 — "Ticket zero" cannot be first.** The 73-Publisher re-replay is the thing
that makes every number above quotable, but it needs an ingested, canonicalized,
clustered and embedded corpus — which is most of the first build slice.
**Resolved**: it gates the **claim**, not the **cut**. Slice 1 runs to a rendered
Brief; the re-replay is the first thing done *with* the running pipeline, before
Brief #1 is ever **sealed** and before any figure in `positioning.md` §7.1/§7.1a or
ADR-0016 §9.2 is quoted as current. Sealing is the right gate because ADR-0015
establishes that a sealed `BriefEntry` freezes a Strength that can never be
recomputed.

---

## 14. What v1 explicitly does not do

Carried from the map's Out of scope. Each is ruled out on a stated ground, and
none of them is a gap waiting to be filled.

| | ground |
|---|---|
| Billing, plan tiers, teams, admin dashboard | Phase 5. Should not shape a single Phase-1 decision |
| Native mobile apps | responsive web covers the stated phone requirement |
| OpenTelemetry / PostHog / full observability | Sentry + a `source_fetch_log` table answers every question at single-user scale |
| Playwright / E2E infrastructure | Vitest on feed parsing, canonicalization and URL validation earns its keep; E2E does not, yet |
| Monorepo tooling | one app, one repo |
| Reddit, X | terms and cost |
| Bilibili | robots **and** co-citation yield |
| Email delivery of a Brief (the `Digest`) | the persisted Brief is canonical and sealing is what makes the boundary structural; a send adds a channel without strengthening anything |
| Velocity scoring, and its cold start | ADR-0006 — "unusual velocity against a baseline" cannot be rendered into a checkable why-text |
| A cross-encoder or re-ranker over top-k Interests | **probably the eventual answer**, and out on compute: a second model on the relevance path is a fresh ADR-0008 bill |
| The whole image apparatus — proxy, blob storage, `og:image`, favicons | ~5% of Signals on the 48-Publisher replay would carry one, skewed away from the high-Strength end. **If images ever ship, they hotlink** |
| Vercel Deployment Protection as the reader-facing gate | it is Vercel-*account* login; cannot gate an end user, cannot cover production on Hobby |
| Neon Auth and its prebuilt login UI | "Anyone can sign up for your application by default" |
| The layout-customization apparatus | ADR-0009 — the admissible set is empty, so there is nothing for a preference store to hold |
| The i18n apparatus | English only; both possible triggers live elsewhere |
| Personal subscriptions layer | scope, not sharpness — the shape is clear, it is simply past this destination |
| Asking a Publisher for a bespoke crawl allowance | silence is indistinguishable from a slow yes, so the ticket has no date on which it can close |

**Standard Protection stays on for preview deployments** — that is a project
setting, free, and not a decision.

---

## 15. Phase 1 build sequence

A thin vertical slice, deployed, before any breadth is added. **Resist any plan
that builds all the ingestion adapters before anything renders** — #6 shipped three
broken adapters and 25 robots-disallowed feeds and nothing noticed, which is
exactly what a horizontal build buys.

### Slice 0 — scaffold

Phase 1's first build ticket, sliced from here.
[`docs/repo-and-ci.md`](../../docs/repo-and-ci.md) holds every decision; the
scaffolding is the only thing left. Next.js 16, Drizzle, Neon, pnpm, Node 22, one
`package.json`, `@antfu/eslint-config` with `nextjs: true`. **One sequential CI
job**, with the `safeFetch` ESLint rule and the no-`px` scan **covering
`scripts/`**. Repo stays **private**; the cron is not enabled.

### Slice 1 — RSS, end to end, rendered in production

One Transport: **RSS/Atom**. Chosen because Strength decides it —
`COUNT(DISTINCT publisher_id)` means a single-Publisher Transport can never cut a
Brief. **HN is one Publisher**: an HN-only slice produces Strength-1 Signals by
arithmetic, however high-yield its 438 citations are in the full corpus. RSS is the
only Transport where one adapter yields many Publishers *and* carries the
Aggregators that actually raise Strength.

1. `safeFetch` with DNS pinning, and the `robots.txt` parser — **`*`, `$`,
   longest-match-wins, Allow-beats-Disallow on ties**, plus the positive whitelist
   of answerable responses. This is first because it is the only egress and it is
   lint-enforced; everything downstream imports it.
2. RSS fetch + normalize → `Item`, with conditional requests and per-host serial
   fetching.
3. **Issue-page hydration** — in scope for slice 1, not deferred. Aggregators
   serving excerpts have no Citations at all until the link list is recovered, and
   Aggregators are where the convergence route's Strength comes from. A
   hydration-free RSS slice clusters nothing.
4. Canonicalization **L1–L3** plus citation-worthiness → `Link`, `Citation`. L4
   redirect-unwrap and L5 publisher-canonical are slice 2 — refinements on a
   cascade that already produces Links.
5. Store; eager `Signal` 1:1; deterministic alias merge; `Strength` with the
   ADR-0020 guard, behind the stage-0 host-ownership assertion.
6. Embed locally via `transformers.js` — same weights as the Cloudflare path, no
   key, no quota, and the runner's compute is free. Match the reader's 20 Interests.
7. Admission, cut, order, render **Today**. **Do not seal yet** — see slice 2.
8. Deploy the UI to Vercel. Run the pipeline by **`workflow_dispatch`, not
   `schedule`.**

"Deployed" means it renders in production, not on localhost. It deliberately does
**not** mean the public flip: ADR-0010 makes that one-way and gates it behind a
disclosure review over `.scratch/` and sixty-odd issues — including the reader's
real Interest Profile, the one genuinely personal artifact in the project. Clearing
a one-way door in week one to get a cron nothing yet needs is the wrong trade.

### Slice 2 — backfill, re-replay, then seal

In this order, and the order is the point.

1. **Backfill** (`ingestion-pipeline.md` §12) — a `--backfill` flag on the same
   pipeline, not a second script. It **must** run before the first Brief, or Brief
   #1 seals against an empty Citation graph. `E2` still applies, so a years-deep
   window fills the graph without dumping a year of stories into Brief #1.
2. **The 73-Publisher re-replay** — §13.3. Re-site every entry count in
   `positioning.md` §7.1/§7.1a, the `4 of 8` in §1.1, and ADR-0016 §9.2's
   provisional alarm value of 2. **The alarm may not fire until re-sited on 30 days
   of forward-running data**, because a single-snapshot replay understates its own
   older days.
3. **Turn sealing on.** Only now, because a sealed `BriefEntry` freezes a Strength
   that can never be recomputed.
4. Re-check `positioning.md` §7.1's separability falsifier against real values.

### Slice 3 — the remaining Transports, cheapest clustering first

HN (highest value in the corpus, and it joins a co-citation graph that already
exists), then GitHub releases (with the **reversed** alias — the announcement cites
the release tag), then Bluesky author feeds (18 Publishers on one host, so per-host
serialism makes them the longest pole, and vehicle-folding is the most complex
clustering path). Canonicalization L4 and L5 land here.

### Slice 4 — the public flip and the cron

Disclosure review over `.scratch/` and the issue history **first**. Then public.
Then `schedule`. ADR-0010's fallback stays live: if the repo is still private at
this point, **drop the cadence** rather than rush the door. ADR-0008 loses one of
its four stated ceilings at the flip — a correction to apply then, not now.

---

## 16. Sanity check against the motivation

The motivation: **the reader checks X daily, is overwhelmed, and the algorithm
never learned what they care about.**

**Zis solves the second and third.** The overwhelm is gone by construction — `E1`
alone rejects 4,910 of the 4,937 Signals in the 48-Publisher corpus, there is no
unread count, no infinite scroll, and no Everything tab, and a Brief that holds one
entry has no empty container to look broken in. And the algorithm is not learning
anything: the reader wrote twenty sentences, and the matched sentence is rendered
verbatim from a stored column with no model between it and the page.

**It does not solve the first, and the spec should not pretend otherwise.**

On the 73-Publisher supply replay the trailing-14-day median Brief is **1**, with
6 empty days in 30. `ranking-model.md` §9.4 is explicit that this is **1 at every
bar tested, including one low enough to admit every eligible Signal** — the bar is
not what binds. The reader, asked directly, said **3 entries make a morning worth
opening.**

Every lever is closed by name. Supply is not one: a 66% increase in Publishers
bought a 50% increase in the ceiling, and reaching a ceiling that yields 5 needs
several hundred Publishers, which ADR-0008 forbids long before it arrives. `T+` is
not one (§9.1, §9.5). `E1` is not one — weakening it restores the anxiety inbox.
Density is not even an admissible *justification* (ADR-0016).

So, plainly: **Phase 0 as specified is a ~3-mornings-a-week product, not a daily
one.** That is a supply property, not a tuning failure, and no decision on this map
can move it. It replaces the overwhelm; it does not replace the *habit*.

**The one reopening condition, and it is not a lever on this map: the corpus
definition changes.** Every closed lever above is closed *given* what Zis ingests —
English-language tech Publishers who cite each other's URLs. What has never been
measured is a corpus defined differently. Two dormant patches would change it
(multilingual relevance, personal subscriptions), and both are out on their own
grounds, neither on density. **This is a Phase 1+ product question, not a tuning
question** — nobody reaches for `T+` when the mornings feel thin.

**And the honest closing note.** Accepting Zis as a three-day-a-week product is a
coherent choice, and it is arguably the better one: a bounded thing that is
sometimes silent is not the failure mode the reader was escaping. But it is a
different product from the one the original motivation described, and the person
who has to agree to that is the reader — before slice 1, not after slice 4.

---

## Index of pointers

| area | document |
|---|---|
| Ubiquitous language | [`CONTEXT.md`](../../CONTEXT.md) |
| Positioning, refusals | [`docs/positioning.md`](../../docs/positioning.md) |
| Sources | [`docs/source-register.md`](../../docs/source-register.md), [`source-register.json`](../../docs/source-register.json) |
| Ingestion | [`docs/ingestion-pipeline.md`](../../docs/ingestion-pipeline.md) |
| Clustering | [`docs/clustering-model.md`](../../docs/clustering-model.md) |
| Ranking | [`docs/ranking-model.md`](../../docs/ranking-model.md) |
| UI / IA | [`docs/ui-and-ia.md`](../../docs/ui-and-ia.md) |
| Security | [`docs/security-model.md`](../../docs/security-model.md) |
| Repo / CI | [`docs/repo-and-ci.md`](../../docs/repo-and-ci.md) |
| Decisions | [`docs/adr/`](../../docs/adr/) — 0001 to 0020 |
