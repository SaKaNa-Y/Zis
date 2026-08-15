# 11 — Set up the repository and CI

Type: task
Status: open
Blocked by: none

## Question

Single repo, one Next.js app. No monorepo. Establish the engineering baseline.

Settle and set up:

1. **Repo visibility.** Public or private? This is not cosmetic:
   **GitHub Actions minutes are free and unlimited for public repos, metered for
   private ones** — and Ticket 07 may put the entire ingestion pipeline in
   Actions. A public repo also means the source list and prompts are public,
   while secrets stay in Actions secrets either way. Decide deliberately.
2. **`antfu/eslint-config`** — adopt as-is, per the user's preference. Confirm
   Next.js 16 compatibility and what, if anything, needs overriding.
3. **CI** — typecheck, lint, `vitest run` on PRs. Fast, so it's never skipped.
4. **Deployment** — Vercel preview deploys on PRs, production on `main`.
   Confirm the cron secret and DB URL differ between preview and production, and
   that **previews cannot write to the production database** (a preview deploy
   pointed at prod is the classic way to corrupt a corpus).
5. **Migrations** — `drizzle-kit`. Do migrations run automatically on deploy, or
   manually? With one user and a free-tier DB with no backups on Neon Free, a
   bad auto-migration is unrecoverable. Argue for manual, or for a backup step
   before auto.
6. **Env var management** — the canonical list, `.env.example`, and how Vercel
   env vars and GitHub Actions secrets stay in sync (both need the AI keys and
   the DB URL if the cron runs in Actions).
7. **Dependabot / Renovate** — worth it at this scale, or noise? Security
   updates only might be the right middle ground.
8. **Testing baseline** — Vitest configured. The tests that must exist per the
   map: URL canonicalization, the SSRF validator, feed parsing. Playwright is
   out of scope.
9. **Name check for "Zis"** — verify availability before the repo is created:
   npm package name, GitHub org/repo, `.dev` / `.io` domains, and any obvious
   trademark collision. Report if it's taken so an alternative can be picked
   before anything is branded.

Deliverable: an initialized repo with CI green on an empty app, plus a written
note on the visibility decision and the migration policy.
