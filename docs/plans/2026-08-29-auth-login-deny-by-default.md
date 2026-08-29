# Auth Login and Deny-by-Default Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the single-reader passphrase login, revocable long-lived sessions, deny-by-default routing, and the authoritative authenticated data-access boundary required by Issue #75.

**Architecture:** A signed `jose` HS256 JWT in a `__Host-zis_session` cookie is the optimistic route credential. `src/proxy.ts` exact-allows only `/login`, rejects unauthenticated non-GET requests with `401`, and redirects unauthenticated page requests; every user-facing data read independently calls a React-cached `verifySession()` DAL that revalidates the token and compares its `sv` claim with the user's persisted `session_version`. The one seeded account stores only an Argon2id hash and serializes login attempts with a Postgres row lock so the lock check, hash verification, and resulting state change share one transaction.

**Tech Stack:** Next.js 16 App Router and Proxy, React 19 `cache`, TypeScript, Tailwind CSS v4, Drizzle ORM with Neon HTTP, `jose`, `@node-rs/argon2`, `server-only`, Vitest.

---

### Task 1: Install the fixed authentication dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Add the dependencies**

Run under the repository's pinned Node 22 runtime:

```bash
pnpm add jose @node-rs/argon2 server-only
```

Expected: the three packages are regular production dependencies and no unrelated package changes appear.

**Step 2: Inspect the lockfile diff**

Run: `git diff -- package.json pnpm-lock.yaml`

Expected: only the requested packages and their platform-specific optional packages are added.

### Task 2: Specify and implement the session contract

**Files:**
- Create: `src/lib/auth/session.test.ts`
- Create: `src/lib/auth/session.ts`

**Step 1: Write the failing session tests**

Test the public `issueSession()` and `verifySessionToken()` boundary with a 32-byte test secret and a fixed clock. Assert the known contract:

```ts
const token = await issueSession(
  { userId: '00000000-0000-4000-8000-000000000075', sessionVersion: 4 },
  { secret: TEST_SECRET, now: NOW },
)

await expect(verifySessionToken(token, { secret: TEST_SECRET, now: NOW }))
  .resolves.toEqual({
    userId: '00000000-0000-4000-8000-000000000075',
    sessionVersion: 4,
    issuedAt: Math.floor(NOW.getTime() / 1000),
    expiresAt: Math.floor(NOW.getTime() / 1000) + 90 * 24 * 60 * 60,
  })
```

Also prove that tampering, a wrong key, expiry, a non-HS256 header, malformed `sub`/`sv`/`jti`, and a too-short signing secret fail closed. Two sessions minted for the same identity in the same second must still differ. Assert the exported cookie descriptor is named `__Host-zis_session` and always sets `secure`, `httpOnly`, `sameSite: 'lax'`, and `path: '/'`, with no `Domain`.

**Step 2: Run the focused test and observe red**

Run: `pnpm test -- src/lib/auth/session.test.ts`

Expected: FAIL because the session module does not exist.

**Step 3: Implement the minimum session module**

Use `SignJWT` and `jwtVerify` with an explicit `algorithms: ['HS256']`, issuer and audience `zis`, numeric `sv`, 90-day expiry, and a seven-day refresh threshold. Read `SESSION_SECRET` only at call time so the ingestion runner never requires it.

**Step 4: Re-run the focused test and typecheck**

Run: `pnpm test -- src/lib/auth/session.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 3: Specify and implement deny-by-default Proxy routing

**Files:**
- Create: `src/lib/auth/routing.test.ts`
- Create: `src/lib/auth/routing.ts`
- Create: `tests/auth-routing.test.ts`
- Create: `src/proxy.ts`

**Step 1: Write the failing route-policy tests**

Define the policy through `isPublicPath()` and table-test exact matching:

```ts
expect(isPublicPath('/login')).toBe(true)
expect(isPublicPath('/')).toBe(false)
expect(isPublicPath('/login-admin')).toBe(false)
expect(isPublicPath('/api/future')).toBe(false)
```

**Step 2: Write the failing HTTP-boundary tests**

Construct real `NextRequest` values and call the exported `proxy()`:

- unauthenticated `GET /`, `GET /future`, and `GET /api/future` redirect to `/login`;
- unauthenticated `POST /`, including a `Next-Action` header, returns `401` instead of a redirect that preserves the POST;
- `GET` and `POST` to exact `/login` pass through;
- a valid token passes the optimistic gate;
- a token older than seven days receives a freshly issued secure cookie;
- `unstable_doesMiddlewareMatch()` confirms the matcher covers every discovered App Router page/handler, future product paths, and `/api`, excluding only framework assets;
- the config has no `runtime` key and no `middleware.ts` exists.

**Step 3: Run both tests and observe red**

Run: `pnpm test -- src/lib/auth/routing.test.ts tests/auth-routing.test.ts`

Expected: FAIL because the policy and Proxy do not exist.

**Step 4: Implement the minimum policy and Proxy**

Keep `PUBLIC_PATHS` closed and exact:

```ts
const PUBLIC_PATHS = new Set(['/login'])
export const isPublicPath = (pathname: string): boolean => PUBLIC_PATHS.has(pathname)
```

In `src/proxy.ts` beside `src/app`, allow exact `/login`, verify only JWT signature and expiry for all other paths, return `401` for unauthorized non-GET/HEAD requests, redirect unauthorized page requests, and default to `NextResponse.next()` only after a valid token. Export a named `proxy` function and a matcher that excludes only `_next/static` and `_next/image`; do not export `runtime`.

**Step 5: Re-run focused tests and typecheck**

Run: `pnpm test -- src/lib/auth/routing.test.ts tests/auth-routing.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 4: Specify and implement the authoritative DAL boundary

**Files:**
- Create: `src/lib/auth/dal.test.ts`
- Create: `src/lib/auth/dal.ts`
- Modify: `src/app/page.tsx`

**Step 1: Write the failing DAL tests**

Test a factory-produced verifier through dependency-injected cookie and user-version boundaries. Prove:

- a valid token whose `sv` equals the database version returns only `{ userId }`;
- a missing, malformed, expired, or unknown-user token is refused;
- bumping the stored version from `4` to `5` invalidates the already-issued version-4 token.

The production export remains the required public boundary:

```ts
export const verifySession = cache(createVerifySession({
  readToken: async () => (await cookies()).get(SESSION_COOKIE_NAME)?.value,
  readSessionVersion,
  unauthorized: () => redirect('/login'),
}))
```

**Step 2: Run the test and observe red**

Run: `pnpm test -- src/lib/auth/dal.test.ts`

Expected: FAIL because the DAL does not exist.

**Step 3: Implement the verifier and protect the existing page**

The real database lookup explicitly selects only `id` and `sessionVersion`. Mark the DAL `server-only`, cache it with React `cache`, and call `await verifySession()` in `src/app/page.tsx`. Do not put the check in the root layout because `/login` must remain reachable and layouts are not the data boundary.

**Step 4: Re-run the focused test and typecheck**

Run: `pnpm test -- src/lib/auth/dal.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 5: Specify and implement passphrase authentication

**Files:**
- Create: `src/lib/auth/credentials.test.ts`
- Create: `src/lib/auth/credentials.ts`
- Create: `src/lib/auth/postgres.test.ts`
- Create: `src/lib/auth/postgres.ts`
- Create: `scripts/auth/hash-passphrase.ts`

**Step 1: Write the failing credential tests**

Exercise `authenticatePassphrase()` through an injected credential store and Argon verifier. Prove that a matching Argon2id credential returns the seeded user's current session version and every invalid, locked, or malformed case produces only a generic failure. Exercise the Postgres transaction adapter separately: it must acquire `FOR UPDATE` before Argon2 work, record failure before commit, skip Argon2 while locked, and roll back database failures.

**Step 2: Run the focused test and observe red**

Run: `pnpm test -- src/lib/auth/credentials.test.ts`

Expected: FAIL because the credential service does not exist.

**Step 3: Implement the application service and atomic Neon store**

`authenticatePassphrase()` accepts a bounded non-empty string and delegates one generic authentication operation to the store. The Neon implementation opens a per-request WebSocket `Pool`, starts an interactive transaction, selects the sole reader `FOR UPDATE`, checks the persisted lock, runs `@node-rs/argon2` while the row remains locked, then records failure or clears lockout state before commit. The pool is always released and closed within the request.

The helper script reads the passphrase only from stdin, hashes with explicit Argon2id `m=65536,t=3,p=1`, prints only the digest, and never writes or logs plaintext.

**Step 4: Re-run tests and typecheck**

Run: `pnpm test -- src/lib/auth/credentials.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 6: Add the Server Action login page

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Implement the Server Action**

The sole unauthenticated action reads the one `passphrase` field, calls `authenticatePassphrase()`, mints a brand-new JWT with a random `jti` on success, writes the `__Host-` cookie, and calls `redirect('/')` outside any `try/catch`. Failure returns to `/login` without validation UI or details that distinguish a bad credential from a lock.

**Step 2: Implement the native form**

Use only semantic HTML and Tailwind v4:

```tsx
<form action={login}>
  <label htmlFor="passphrase">Passphrase</label>
  <input id="passphrase" name="passphrase" type="password" autoComplete="current-password" required />
  <button type="submit">Enter Zis</button>
</form>
```

Use a restrained editorial security-gate treatment with semantic paper/ink/accent tokens, a characterful serif stack, one obvious action, keyboard-visible focus, and no motion, image, icon, client state, component library, headless primitive, or pixel-sized type/spacing/measure.

**Step 3: Run the repository UI invariants**

Run: `pnpm check:no-px`

Expected: PASS with the login page included in the scan.

Run: `pnpm lint`

Expected: PASS.

### Task 7: Add auth schema, the seeded account, and revocation-safe recovery

**Files:**
- Modify: `src/lib/db/schema.test.ts`
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0006_auth.sql`
- Create: `drizzle/meta/0006_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify: `docs/security-model.md`

**Step 1: Wait for Issue #74's migration to commit**

Confirm `git status --short` no longer contains the #74 schema/migration work and `0005_brief_admission` is in `HEAD`. The auth migration must be ordinal `0006`.

**Step 2: Write the failing schema and migration assertions**

Extend the exact `user` column contract with:

```ts
'passphrase_hash',
'session_version',
'failed_attempts',
'locked_until',
```

Assert non-negative counters, a non-empty Argon2id digest, journal ordering, an exactly-one-reader seed, and a committed hash beginning `$argon2id$`. Assert recovery documentation contains one `UPDATE` that sets the new digest and increments `session_version` in the same statement.

**Step 3: Run the schema test and observe red**

Run: `pnpm test -- src/lib/db/schema.test.ts`

Expected: FAIL on the missing columns and `0006` migration.

**Step 4: Add columns and generate migration metadata**

Add `passphraseHash`, `sessionVersion`, `failedAttempts`, and `lockedUntil` with checks. Generate `0006_auth` locally with a placeholder database URL; do not connect to or migrate any database.

**Step 5: Add the human-provided hash and safe seed logic**

The migration must fail loudly if more than one reader exists, update the sole existing reader or insert the fixed seeded reader when none exists, and leave exactly one account. Only the human-provided Argon2id digest enters the file; plaintext never does.

**Step 6: Document the only recovery operation**

Add one English Neon-side statement that replaces `passphrase_hash`, increments `session_version`, clears `failed_attempts`, and clears `locked_until`. State that generating a new digest happens locally and that Neon access must not share the passphrase's failure domain.

**Step 7: Re-run the schema test and typecheck**

Run: `pnpm test -- src/lib/db/schema.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 8: Keep credential material out of ingestion

**Files:**
- Modify: `src/lib/ingestion/postgres.test.ts`
- Modify: `src/lib/ingestion/postgres.ts`

**Step 1: Write the failing projection regression test**

Assert that the pipeline's reader load returns only domain fields (`id`, `timezone`, `cutHour`, `createdAt`) and never `passphraseHash`, `sessionVersion`, `failedAttempts`, or `lockedUntil`.

**Step 2: Run the focused test and observe red**

Run: `pnpm test -- src/lib/ingestion/postgres.test.ts`

Expected: FAIL because the current all-column `user` selection exposes auth fields after the schema change.

**Step 3: Replace the all-column selection with an explicit projection**

Keep authentication data local to `src/lib/auth`; no pipeline graph or Actions log may carry it.

**Step 4: Re-run the focused test and typecheck**

Run: `pnpm test -- src/lib/ingestion/postgres.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

### Task 9: Verify, review, fix, and commit

**Files:**
- Review every file changed since the fixed point established immediately before Issue #75 edits.

**Step 1: Run focused auth tests**

Run: `pnpm test -- src/lib/auth/session.test.ts src/lib/auth/routing.test.ts src/lib/auth/dal.test.ts src/lib/auth/credentials.test.ts tests/auth-routing.test.ts src/lib/db/schema.test.ts src/lib/ingestion/postgres.test.ts`

Expected: PASS.

**Step 2: Run all required checks**

Run in order:

```bash
pnpm typecheck
pnpm lint
pnpm check:no-px
pnpm check:env
pnpm test
pnpm build
```

Expected: every command passes. The build specifically validates the Next.js 16 Proxy convention.

**Step 3: Run the required two-axis review**

Pin the fixed point, confirm `git diff <fixed-point>...HEAD` is non-empty after a temporary implementation commit if necessary, then dispatch Standards and Spec reviewers in parallel using Issue #75 plus the repository standards and smell baseline. Fix every confirmed finding and rerun all checks.

**Step 4: Commit only Issue #75**

Inspect `git status`, `git diff --cached`, and the commit file list. Do not include another task's work.

Commit message:

```text
build: add single-reader authentication (#75)
```
