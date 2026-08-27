/**
 * The corpus schema. Empty in slice 0 — `Source`, `Item`, `Link`, `Signal`,
 * `Citation`, `Interest`, `Brief` and `BriefEntry` arrive with the slice that
 * first writes them, so that no table exists before something reads it.
 *
 * Migrations are generated with `pnpm db:generate` and applied by hand against
 * production, snapshot first, never from a build step (docs/repo-and-ci.md §3).
 */

export {}
