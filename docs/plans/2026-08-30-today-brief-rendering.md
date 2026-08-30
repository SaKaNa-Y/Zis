# Today Brief Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the authenticated Today surface from the persisted Brief, including honest empty and one-entry states, Admission grouping, and working Save and Mark read actions.

**Architecture:** Keep the route as an authenticated Server Component. A server-only Today read model resolves merged Signals and derives the best available plain-text title and summary in one database query; a pure `TodayBriefView` renders that model so the observable HTML can be tested without adding browser-test infrastructure. Server Actions authenticate and authorize against the reader's own Brief Entries before writing Bookmark or Read State rows.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components and Server Actions, Drizzle ORM, Neon Postgres, Tailwind CSS v4, Vitest, React DOM server rendering.

---

### Task 1: Lock the rendered empty and short states

**Files:**
- Create: `src/app/today.test.ts`
- Create: `src/app/today.tsx`

**Step 1: Write the failing empty-state render test**

Render `TodayBriefView` through `react-dom/server` with no entries. Assert the exact empty-state copy, the previous Brief link, the Interests link, and the absence of an `<article>`.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- src/app/today.test.ts`

Expected: FAIL because `TodayBriefView` does not exist.

**Step 3: Implement the minimum empty-state view**

Add the typed Today view model and the exact English empty-state sentence from `docs/ui-and-ia.md`.

**Step 4: Run the focused test and verify it passes**

Run: `pnpm test -- src/app/today.test.ts`

Expected: PASS.

**Step 5: Add the failing one-entry test**

Assert one Entry renders in the ordinary rhythm with its plain-text summary, an external title link using `target="_blank"`, `rel="noopener noreferrer"`, and `↗`, an internal why-text link, plus Save and Mark read forms. Assert there is no convergence heading.

**Step 6: Implement the one-entry slice and rerun the focused test**

Run: `pnpm test -- src/app/today.test.ts`

Expected: PASS.

### Task 2: Render the complete Admission structure

**Files:**
- Modify: `src/app/today.test.ts`
- Modify: `src/app/today.tsx`

**Step 1: Add the failing mixed-Admission test**

Assert interest Entries precede the rule and convergence section, the heading carries both explanatory sentences, convergence titles use the body-size semibold register, and the stored why-text is unchanged.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- src/app/today.test.ts`

Expected: FAIL on the missing convergence register.

**Step 3: Implement the mixed register, responsive actions, desktop rail, mobile footer, and marginalia**

Use only native forms, details, and anchors. Do not add a Card, badge, image, icon, unread count, infinite scroll, client component, component library, or `dark:` utility.
Do not fabricate terminal-IA Tags or recent Saved content before their data-backed retrieval routes exist.

**Step 4: Run the focused test and verify it passes**

Run: `pnpm test -- src/app/today.test.ts`

Expected: PASS.

### Task 3: Load Today from the persisted graph

**Files:**
- Create: `src/lib/briefs/today.ts`
- Create: `src/lib/briefs/today.test.ts`
- Modify: `src/app/page.tsx`

**Step 1: Write a failing read-model row-mapping test**

Cover an empty Brief, deterministic position ordering, nullable summaries, prior-Brief linking, bookmarked/read flags, and rejection of malformed database rows.

**Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- src/lib/briefs/today.test.ts`

Expected: FAIL because the read model does not exist.

**Step 3: Implement the server-only read model**

Use one parameterized SQL statement. Resolve `merged_into_id` tombstones before reading the target Link or reader state. Prefer an own Item's title and summary, then a Citation anchor or non-Aggregator citing Item title, then `Signal.embedding_text` and the target URL. Keep a missing summary absent rather than inventing one.

**Step 4: Connect the authenticated route**

Call `verifySession()`, then the cached read model, then render `TodayBriefView`. The provenance href is `/signals/<resolved-signal-id>`; Issue #77 owns that destination page.

**Step 5: Run focused tests and typecheck**

Run: `pnpm test -- src/app/today.test.ts src/lib/briefs/today.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

### Task 4: Persist Bookmark and Read State safely

**Files:**
- Modify: `src/lib/db/schema.test.ts`
- Modify: `src/lib/db/schema.ts`
- Create: `src/app/actions.ts`
- Create: `drizzle/0007_today_reader_actions.sql`
- Create: `drizzle/meta/0007_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Step 1: Add the failing Bookmark schema and migration assertions**

Assert a `bookmark` table keyed by `(user_id, signal_id)`, a Signal index, foreign keys, and a timestamp. Assert migration and snapshot files exist.

**Step 2: Run the schema test and verify it fails**

Run: `pnpm test -- src/lib/db/schema.test.ts`

Expected: FAIL because Bookmark persistence does not exist.

**Step 3: Add the schema and generate migration artifacts**

Run: `pnpm db:generate -- --name today_reader_actions`

Expected: Drizzle creates migration `0007` plus its snapshot and journal entry.

**Step 4: Implement authenticated Server Actions**

Validate the Signal UUID, call `verifySession()` inside each action, and authorize the resolved Signal through a Brief Entry owned by that reader. Save idempotently to `bookmark`; mark read idempotently to `read_state`; call `revalidatePath('/')`; never redirect.

**Step 5: Run schema, rendered-form, and auth checks**

Run: `pnpm test -- src/lib/db/schema.test.ts src/app/today.test.ts tests/auth-routing.test.ts`

Expected: PASS.

### Task 5: Install the settled type and colour system

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add the Tailwind v4 tokens from `docs/ui-and-ia.md`**

Add the four base sizes, two desktop rungs, the 33rem measure, Entry/Register rhythm, and the existing seven semantic colours. Keep forced-colours and increased-contrast behavior.

**Step 2: Apply the editorial wire-sheet surface**

Use the warm paper palette, restrained display face, precise mono date, and vertical rhythm from the accepted prototype. Preserve content and order across breakpoints.

**Step 3: Run the invariant checks**

Run: `pnpm check:no-px`

Run: `rg -n "dark:|(?:text|bg|border)-(?:red|blue|green|neutral|gray|zinc|slate|stone|amber|orange|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-" src/app/today.tsx src/app/page.tsx`

Expected: no no-px violations and no raw colour or `dark:` utilities.

### Task 6: Verify, review, and commit

**Files:**
- Review all files changed since the starting commit.

**Step 1: Run the full local gate**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm check:no-px`

Run: `pnpm check:env`

Run: `pnpm test`

Run: `pnpm build`

Expected: every command passes.

**Step 2: Inspect the built page at phone and desktop widths**

Verify empty, one-entry, and mixed states against the accepted prototype where local data permits. Confirm keyboard focus, external-link behavior, desktop rail, and mobile footer.

**Step 3: Commit the implementation**

Run: `git add <issue-76 files>`

Run: `git commit -m "feat: render the Today brief (#76)"`

**Step 4: Run the two-axis code review**

Review `git diff e6ed165...HEAD` in parallel for repository standards and Issue #76 compliance. Fix every confirmed finding, rerun the full gate, and commit fixes.

**Step 5: Check the deployment handoff**

If a linked Vercel production project and credentials are available, deploy the verified commit without changing repository visibility or adding a schedule. Otherwise record the concrete missing external state; Issue #78 owns the first full production corpus run.
