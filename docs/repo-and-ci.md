# Zis repository and CI

Settled by [#12](https://github.com/SaKaNa-Y/Zis/issues/12). This is reference
material — read it before scaffolding the app, adding a workflow, or introducing
an environment variable. The *why* behind each rule is in #12's resolution
comment; this document is what you check against.

Nothing here is built yet. This document is the decision set; the scaffolding is
Phase 1's first build ticket.

---

## 1. Visibility: public, and the flip is gated

**The repository is public.** Not yet in fact — it is private today and the owner
drives the flip when the work is mature enough to read, and will say when it is
done. The ruling is recorded now because it is load-bearing on the compute budget
and because publication is one-way ([ADR-0010](adr/0010-publication-is-one-way.md)).

The reason is arithmetic, not preference. GitHub bills Actions **per job, rounded
up to the nearest whole minute**, and the free allowance on a private repository
is **2,000 minutes/month**. [ADR-0008](adr/0008-the-neon-wake-is-the-unit-of-compute-cost.md)
puts the pipeline on an hourly cron — **730 runs/month**:

| Actual run duration | Billed per run | Billed per month | Share of 2,000 |
| ------------------- | -------------- | ---------------- | -------------- |
| ≤ 60s               | 1 min          | 730              | 37%            |
| 61s – 120s          | 2 min          | 1,460            | **73%**        |
| 121s – 180s         | 3 min          | 2,190            | **over cap**   |

So on a private repository, [#8](https://github.com/SaKaNa-Y/Zis/issues/8)'s
stated "≤2-minute run budget" is not a performance target — it is a **billing
cliff one second wide**, and it leaves 540 minutes for all CI. Public
repositories get standard runners free and unlimited, which removes the ceiling
entirely.

**The hard gate**: the repository must be public **before the hourly cron is
enabled**. This is an acceptance criterion on whichever Phase-1 ticket turns the
pipeline on, not a note in prose. While there is no app there is no cost, so the
deferral is free — the burn starts at the first scheduled run.

**The fallback, which is what makes the gate self-enforcing**: if the repository
is still private when the cron is ready, **the cadence drops below hourly, or
minutes are bought.** The flip is never rushed to hit a schedule.

What going public does **not** do:

- **It does not reopen the cadence.** ADR-0008 says the wake is the unit of
  compute cost and Neon's 21-of-100 CU-hours is what binds. Actions was the
  fourth ceiling, not the first. An extra cron is still never small.
- **It does not expose secrets.** Actions secrets stay secret either way, and
  workflows triggered by fork pull requests never receive them.
- **It does not expose the Interest Profile.** That lives in Neon and never
  enters the repository — which is why the disclosure surface is the reasoning
  trail, not the reader's data.

**Pending correction to ADR-0008**: the flip invalidates one of that ADR's four
stated ceilings (the private-repo Actions breach). Its conclusion is unaffected —
Neon binds first — but the ceiling is live *today* and stops being live at the
flip. Amend ADR-0008 then, not now.

---

## 2. CI: one job, not several

**CI is a single sequential job**: `typecheck → lint → no-px scan → vitest run`.

Per-job rounding inverts the obvious instinct. [#12](https://github.com/SaKaNa-Y/Zis/issues/12)
asked for CI that is "fast, so it's never skipped", and the standard way to get
that — three parallel jobs — bills **three minutes minimum on a private repo even
if every check takes 20 seconds**. One sequential job billing one minute is 3×
cheaper and, at this repo's size, slower by seconds.

| Shape                | Billed floor / push | Pushes inside 540 min |
| -------------------- | ------------------- | --------------------- |
| 3 parallel jobs      | 3 min               | 180                   |
| 1 sequential job     | 1 min               | **540**               |

Going public does not reward splitting it back up, so this shape is correct under
both visibility states and **the flip never forces a CI rewrite**. Order is
cheapest-first so it fails fast.

### What CI must enforce beyond the obvious

Two invariants were routed to this ticket from elsewhere, and **neither exists in
any stock config** — both have to be written:

- **The `safeFetch` egress rule** ([#7](https://github.com/SaKaNa-Y/Zis/issues/7),
  [`security-model.md` §1](security-model.md)). Enforced *by lint, not review*, so
  a stray `fetch` fails CI. [#15](https://github.com/SaKaNa-Y/Zis/issues/15) found
  **`next lint` is removed in Next.js 16**, so this must be an explicit `eslint`
  step in the workflow or it silently stops being enforced — which is worse than
  never having had it, because `security-model.md` claims it is enforced.
- **The no-`px` rule** ([ADR-0009](adr/0009-a-presentation-control-changes-neither-information-nor-order.md)) —
  no `px` in type size, line-height, spacing, or the measure; hairline borders
  excepted. This is the entire basis on which browser zoom substitutes for a
  text-size control, so it is a CI invariant rather than a review item.

**They need two different mechanisms, and this is the part worth getting right.**
`safeFetch` is a real ESLint rule (`no-restricted-globals` + `no-restricted-imports`
+ a custom rule). The no-`px` rule mostly lives in **Tailwind class strings and
CSS**, which ESLint reads poorly — forcing it into ESLint is how it ends up
half-enforced. It is a **standalone scan script** run as its own CI step.

**Both must cover `scripts/` as well as `src/`.** If lint and typecheck only
cover `src/`, the egress rule is enforced on the entry point that does not fetch
and skipped on the one that does (§6).

### Lint config

**`@antfu/eslint-config`, adopted as-is** — the owner's preference, and it needs
nothing overridden. It has first-class Next.js support (`antfu({ nextjs: true })`,
peer dependency `@next/eslint-plugin-next`) and requires ESLint ≥ 9.5 flat
config. The Zis-specific rules above are composed on top.

### Test baseline

**Vitest.** The tests that must exist: **URL canonicalization** (the five-layer
cascade from [#6](https://github.com/SaKaNa-Y/Zis/issues/6)), **feed parsing**
(no DTD, no entity expansion, byte cap *before* parse — verified, not assumed),
and **the nine `safeFetch` tests** from `security-model.md`. Of those, **test 2
(DNS rebinding) is the only one that would have caught the Budibase bug**, which
is why the resolver is injected. Playwright and E2E infrastructure stay out of
scope.

---

## 3. Migrations: manual, and never in the build step

**`drizzle-kit`, run manually against production, gated on taking a snapshot
first.** Auto-migrate on deploy is rejected.

The ticket's stated reason was wrong and must not be repeated: it argued from
"a free-tier DB with no backups on Neon Free, so a bad auto-migration is
unrecoverable." **Neon Free has recovery** — 6-hour instant restore (PITR) capped
at 1 GB of change history, plus **one manual snapshot**, at no cost. The two
reasons that survive:

- **`drizzle-kit migrate` in a Vercel build step runs on preview builds too**, so
  auto-migrate means previews migrating whatever database their environment
  points at. Removing the step beats sequencing it.
- **The 6-hour window covers the detected failure, not the silent one.** A bad
  migration fails the deploy in minutes, well inside 6 hours. A migration that
  succeeds structurally and corrupts data you notice next week is outside it —
  and that is precisely the case the one manual snapshot slot exists for.

So the procedure is: **take the manual snapshot, then migrate.** Free gives
exactly one slot, so it is a deliberate act with a single reusable checkpoint,
which is the right weight for a corpus that cannot be re-fetched
([ADR-0005](adr/0005-no-publisher-html-is-ever-stored.md)).

---

## 4. Environments: the two sets are nearly disjoint, and that is the point

The ticket assumed "both need the AI keys and the DB URL if the cron runs in
Actions." **That premise died with [#8](https://github.com/SaKaNa-Y/Zis/issues/8)**,
which moved the pipeline wholly into the Actions runner and left Vercel serving
only the UI.

| Variable                | Vercel | Actions |
| ----------------------- | :----: | :-----: |
| `DATABASE_URL`          |   ✓    |    ✓    |
| `SESSION_SECRET`        |   ✓    |    —    |
| `DEEPSEEK_API_KEY`      |   —    |    ✓    |
| `CLOUDFLARE_ACCOUNT_ID` |   —    |    ✓    |
| `CLOUDFLARE_API_TOKEN`  |   —    |    ✓    |
| `GITHUB_PAT`            |   —    |    ✓    |

**`DATABASE_URL` is the only overlap, so keeping them in sync is a one-variable
problem, not a process.** Do not grant Vercel the AI keys for symmetry — the
asymmetry is a security property: the UI cannot reach DeepSeek or Cloudflare at
all, so a UI compromise cannot spend the AI budget or reach the generation path.

**Bluesky and HN need no credentials** ([#2](https://github.com/SaKaNa-Y/Zis/issues/2) —
public AppView supports no auth, Firebase needs none). Absence of a credential is
a decision here, not an omission.

`.env.example` is the canonical list, and **a CI step asserts every name in it is
read somewhere in the source.** That catches drift; documentation does not.

### Preview vs production

**One long-lived `preview` Neon branch — not one branch per pull request.**
Copy-on-write, so storage is cheap. Two reasons for one rather than many: Neon
Free caps a project at **10 branches**, and — the cost the ticket did not name —
**each branch has its own compute drawing from the same 100 CU-hour project
pool** that ADR-0008 budgeted at 21. Preview database usage is not free; it is
charged to the pipeline's budget.

**The production `DATABASE_URL` is never present in the preview environment at
all**, enforced by Vercel environment scoping. A misconfigured preview then fails
closed — it cannot connect — rather than writing to the corpus. A preview deploy
pointed at production is the classic way to corrupt a corpus, and the defence is
absence, not care.

---

## 5. GitHub authentication and Dependabot

**A fine-grained PAT with zero permissions selected.**
[#8](https://github.com/SaKaNa-Y/Zis/issues/8) established that GitHub releases
403 without auth, so a credential is required. Every fine-grained PAT includes
public-repository read by default at 5,000 requests/hour, so the token Zis needs
is the **minimum-privilege one: no permissions granted, nothing but the default
public read**.

The built-in Actions `GITHUB_TOKEN` was considered and rejected: its
`permissions:` block governs only its own repository and the documentation does
not sanction cross-repository public reads, so the pipeline's only GitHub Source
would rest on undocumented behaviour. It is also capped at 1,000 points/hour.

**A PAT expires, so the pipeline will break roughly annually — and that rides
existing machinery rather than new.** #8 already separates a *failing* Source
from a *Dormant* one, and **a 401 is a failure while a 304 is not**, so the
failure counter surfaces a dead PAT with nothing added. Do not build an expiry
monitor. A GitHub App (auto-rotating installation tokens, no expiry to manage) is
the upgrade path if manual annual rotation ever actually annoys anyone; it is not
worth its setup cost for one credential at single-user scale.

**Dependabot: alerts and security updates on, version updates off.** At
single-user scale a version-bump PR stream is noise, and on a private repository
each PR also triggers CI against minutes there are none of. Dependabot's own runs
do not bill against the allowance; the CI on its pull requests does.

---

## 6. Layout: one package, and the pipeline is not a second copy

**One `package.json`, no workspaces.** A monorepo is out of scope and would be
pure overhead for one app.

```
src/lib/          shared — safeFetch, the canonicalization cascade
scripts/pipeline/ the Node script the Actions runner executes
```

The pipeline imports from `src/lib/` **directly**, run under `tsx` with the app's
own `tsconfig`. This is the structural answer to the failure mode #8 named: the
shared modules have **two entry points**, and *"a second copy in a standalone
script is the failure mode to watch for."* A copied `safeFetch` is a second
egress that #7's lint rule never sees — the rule would still pass, and
`security-model.md`'s "only egress in the system" claim would quietly be false.

**Therefore lint and typecheck must both cover `scripts/`** — see §2. Covering
only `src/` enforces the egress rule on the entry point that does not fetch and
skips the one that does.

**Runtime**: **Node 22 LTS and pnpm**, pinned in three places that must agree —
`.nvmrc`, `package.json` `engines`, and the workflow's `setup-node`. Node 22
clears any plausible Next.js 16 floor and matches Vercel's default runtime; pnpm
has the fastest install of the three, which matters when CI is one billed minute.

---

## 7. The name is settled by not being a question

**No rename, no domain purchase.** The ticket asked to verify "Zis" *before the
repo is created*; the repo exists, is named Zis, and nine ADRs and five documents
are branded to it, so the check ran late — and then dissolved rather than
resolving:

- **`npm:zis` is taken** — a 2017 placeholder at v0.0.0 with an empty description.
  **Irrelevant: Zis publishes nothing to npm.** The `package.json` `name` field
  is local to a private application.
- **Domains**: `zis.dev` appears unregistered; `zis.io` and `zis.app` are parked
  for resale; `zis.com` is registered. **Phase 0 has one reader, so
  `*.vercel.app` is sufficient and no domain is needed.** `zis.dev` is the only
  clean option if one is ever wanted.
- **Trademark was not cleared and this document does not claim it was.** It is low
  risk for a private single-user tool and becomes a real question only if the
  product is ever published — which is out of scope.
