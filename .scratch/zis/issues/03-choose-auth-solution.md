# 03 — Choose the auth solution

Type: research
Status: resolved
Blocked by: none

## Question

Constraints, which are unusually tight and should make this easy:

- **Exactly one user.** No signup route exists at all — the account is seeded by
  migration.
- **Every route auth-gated** except the login route and the cron endpoint (which
  authenticates by shared secret, not session).
- Sessions must survive on **phone and desktop** — long-lived, so the user isn't
  re-authenticating constantly on mobile.
- Next.js 16 App Router compatible.
- No user-facing password reset, email verification, or account management flows
  are needed.

Compare **Auth.js (NextAuth v5)**, **Better Auth**, **Clerk**, and **a
hand-rolled session cookie** on: Next.js 16 compatibility today (not
"planned" — check for known App Router / async-cookies issues), setup weight for
a single-user case, cost, and how much of what they offer is dead weight here.

Specifically evaluate:

- **GitHub OAuth with a hardcoded allowed account** — the login form is one
  button, there is no password to leak, and the identity provider is one the
  user already has. Is this the simplest secure option?
- Whether **hand-rolling** is defensible given no signup, no reset, and no
  multi-user: a signed session cookie plus a seeded credential is a small amount
  of code with a small attack surface. Weigh against the standard argument that
  hand-rolled auth is where subtle bugs live.
- How **middleware-level deny-by-default** is expressed in each — the goal is
  that adding a new route is safe by default, never accidentally public.

Deliverable: a named choice with the deny-by-default middleware pattern
sketched, and a note on how the cron endpoint's shared-secret auth stays
separate from the session path.

## Answer

**Choice: a hand-rolled signed session cookie** — `jose` HS256 JWT in a
`__Host-` cookie, seeded Argon2id credential, plus a `session_version` integer
on the user row for server-side revocation. Runner-up if this is rejected:
**Better Auth**. **Clerk and Auth.js v5 are both ruled out on facts below.**

### The Next.js 16 fact that reframes the whole question

`middleware.ts` is **deprecated and renamed to `proxy.ts`** as of Next.js 16.0.0
(docs version checked: 16.3.1). The export must be named `proxy` or be the
default export. Codemod: `npx @next/codemod@canary middleware-to-proxy .`

Two consequences that most of the tutorial content gets wrong:

- **Proxy defaults to the Node.js runtime in v16**, and the `runtime` config
  option is *not available* in proxy files — **setting `runtime: "nodejs"`
  throws an error**. Better Auth's own Next.js integration page still shows
  `runtime: "nodejs"` in the config export; that snippet is for 15.2+ and will
  break on 16. This is a live docs bug in a library we'd be depending on.
- **Server Functions are not separate routes.** They are POSTs to the route
  they're used on, so *a matcher that excludes a path also skips proxy coverage
  for every Server Action on that path*. Proxy alone is never the security
  boundary — Next's own docs say so explicitly.

### Rulings on the packaged options

| | Verdict | Decisive fact |
|---|---|---|
| **Clerk** | **Ruled out** | Free tier has a **fixed, non-configurable 7-day session lifetime**; configurable duration is Pro ($25/mo). That directly fails the "long-lived on phone" requirement. Also unremovable branding, 1-day log retention. `@clerk/nextjs@7.7.6` does peer-dep Next 16 fine, and there's an open issue (clerk/javascript#8302) where `auth.protect()` in a Next 16 proxy redirects to the current URL instead of sign-in — i.e. silently fails open. |
| **Auth.js / NextAuth v5** | **Ruled out** | Still `5.0.0-beta.32` — **beta.1 shipped Oct 2023, so ~33 months in beta**, and only three releases in the last ten months (beta.30 Oct 2025, .31 Apr 2026, .32 Jul 2026). Peer deps *do* now include `next@^16` (the #13302 install failure is fixed; `next-auth@latest` 4.24.15 also allows ^16), so the common "it won't install" claim is stale. It's ruled out on maintenance velocity and on the fact that ~all of its value here is OAuth providers, adapters, and account-linking we don't use. |
| **Better Auth** | **Viable runner-up** | `1.6.29`, published 2026-08-14 — genuinely active. Peer-deps `next@^16`, first-party Drizzle support, configurable `expiresIn` for long sessions, DB-backed revocable sessions. The Next 16 `better-auth/cookies` resolution bug (#5672) is **closed**. Costs ~4 extra tables and a config surface we'd use maybe 15% of. |
| **GitHub OAuth, one hardcoded account** | **Attractive, but not chosen** | Genuinely appealing: one button, no password to leak, no credential to seed. Two problems. (1) Doing it properly means the OAuth code exchange + `state` + PKCE — that is *more* security-critical code to hand-roll than the cookie is, so in practice you pull in Better Auth to do it, and you're back to the runner-up. (2) It makes GitHub a hard dependency for reading your own daily brief: a misconfigured OAuth app, a revoked grant, or a GitHub outage locks the single user out with **no fallback**, because there is no other credential and no reset flow. For a personal tool that's a real availability regression for no security gain over a strong passphrase. |

### Is hand-rolling defensible here? Yes — genuinely, not as contrarianism

The standard warning against hand-rolled auth is correct, but it is about the
parts we do not have. Subtle auth bugs live in **signup, password reset tokens,
email verification, account linking, multi-tenant authorization, and OAuth state
machines**. This project has *none* of those. What is left is:

1. compare a submitted passphrase against a stored Argon2id hash — `@node-rs/argon2` does the crypto,
2. mint a signed token — `jose` does the crypto,
3. verify that token and read one claim.

We are not writing crypto; we are calling two vetted libraries in a straight
line. And this exact pattern is **first-party Next.js documented guidance** —
`/docs/app/guides/authentication` walks through `jose` + `cookies()` stateless
sessions and a `verifySession()` DAL. Be honest about the tension: that same
page *also* says "we recommend using an authentication library." The
counterweight is that every library-shaped benefit it's pointing at (social
logins, MFA, RBAC) is dead weight here, while the cost — a beta dependency or a
paid tier that caps session length at 7 days — is live.

**The real risks, and what handles each:**

- **No revocation (stateless JWT).** Real. Mitigated by a `session_version`
  integer on the user row, embedded as a claim and compared on verify. Bumping
  it invalidates every device. One column, one comparison.
- **Session fixation.** Structurally absent — there is no pre-auth session, and
  the server never accepts a client-supplied session identifier. The rule that
  makes it stay absent: *mint a brand-new token on every successful login*.
- **Cookie flags.** `__Host-` prefix (forces `Secure`, `Path=/`, forbids
  `Domain`, so no subdomain can inject a cookie), `httpOnly`, `sameSite: 'lax'`.
  Works on `http://localhost` in dev because browsers treat localhost as secure.
- **CSRF.** `SameSite=Lax` blocks cross-site POSTs from carrying the cookie, and
  Next 16 Server Actions do a built-in Origin/Host check. The gap is *mutating
  Route Handlers*, which get neither — so any non-GET route handler must call an
  explicit origin check. Called out in the sketch.
- **Timing attacks.** `argon2.verify` is constant-time. The sharper edge is the
  cron shared secret; see the constant-time compare below.
- **Brute force.** One account, one endpoint. A 32+ char generated passphrase
  plus Argon2id makes online guessing hopeless; add a simple failed-attempt
  counter on the user row if desired. No Redis needed, consistent with the map's
  no-queue-infrastructure constraint.

**Reconsider and switch to Better Auth if** any of these stop being true: a
second user appears, passkeys/MFA are wanted, or social login is wanted. The
migration is contained because everything reads sessions through one DAL.

### Deny-by-default: the pattern

The failure mode to design against is a *list of protected routes* — Next's own
docs example uses `const protectedRoutes = ['/dashboard']`, which means every
route you add later is **public until someone remembers to edit the array**.
Invert it: a closed, exact-match allowlist of public paths, and a default branch
that denies.

Three properties make "accidentally public" unreachable:

1. **The matcher excludes only Next internals — never `/api`.** Excluding `/api`
   is the classic hole, and per the Server-Functions note above it would also
   silently un-gate Server Actions on those paths.
2. **`PUBLIC_PATHS` is exact-match, not prefix-match.** Prefix matching means
   `/login` accidentally opens `/login-admin-backdoor`.
3. **The cron path is not in `PUBLIC_PATHS`.** It's in a separate set with a
   *different* gate. It is never "public" — it is "authenticated by another
   mechanism."

```ts
// proxy.ts  (repo root — NOT middleware.ts; Next 16 renamed it)
import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/session'
import { verifyCronSecret } from '@/lib/auth/cron'

// Closed allowlist. Exact match only. Adding a route does NOT add it here.
const PUBLIC_PATHS = new Set(['/login'])

// Gated by shared secret, NOT by session. Deliberately a separate set.
const CRON_PREFIX = '/api/cron/'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Path 1 — shared-secret. Never touches session code.
  if (pathname.startsWith(CRON_PREFIX)) {
    return (await verifyCronSecret(req))
      ? NextResponse.next()
      : new NextResponse(null, { status: 401 })
  }

  // Path 2 — public allowlist.
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  // Path 3 — session. Optimistic check only; the DAL is the real boundary.
  const token = req.cookies.get('__Host-zis_session')?.value
  if (token && (await verifySessionToken(token))) return NextResponse.next()

  // Default: DENY. Every new route lands here.
  const wantsHtml = req.headers.get('accept')?.includes('text/html')
  if (!wantsHtml) return new NextResponse(null, { status: 401 })

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(url)
}

export const config = {
  // Note: /api is deliberately NOT excluded.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
// No `runtime` key — proxy is Node.js by default in 16 and setting it throws.
```

**Make it enforceable, not just conventional.** Add a Vitest case that walks
`app/**/page.tsx` and `app/**/route.ts`, derives each route path, and asserts it
is either in `PUBLIC_PATHS`, under `CRON_PREFIX`, or covered by the matcher via
`unstable_doesProxyMatch` from `next/experimental/testing/server`. A new public
route then requires an explicit, reviewable test diff. This fits the map's
"Vitest unit tests that earn their keep" line — no Playwright needed.

**Second layer (the actual boundary).** Proxy is optimistic; per Next's docs it
must not be the only defense. Every Server Component, Server Action, and Route
Handler reads through one `verifySession()` DAL, memoized with React `cache`,
which re-verifies the token *and* checks `session_version` against the DB:

```ts
// lib/auth/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const verifySession = cache(async () => {
  const token = (await cookies()).get('__Host-zis_session')?.value
  const claims = token ? await verifySessionToken(token) : null
  if (!claims) redirect('/login')
  // Revocation check — cheap at single-user scale.
  const user = await db.query.users.findFirst({ where: eq(users.id, claims.sub) })
  if (!user || user.sessionVersion !== claims.sv) redirect('/login')
  return { userId: user.id }
})
```

Session shape for the phone/desktop requirement: **90-day expiry, rolling** —
re-issue the cookie only when the token is more than ~7 days old, so we're not
writing `Set-Cookie` on every request. Fully under our control, which is exactly
what Clerk's fixed 7-day free tier could not give us.

### How the cron endpoint stays separate from the session path

They share no code, no cookie, and no module. `verifyCronSecret` never reads
cookies; `verifySession` never reads headers. The cron branch returns before the
session branch is reached, so a valid cron secret can never mint a session and a
valid session can never satisfy the cron gate.

The compare is constant-time, and both sides are SHA-256'd first so that
`timingSafeEqual` always gets equal-length buffers — comparing raw secrets of
differing length either throws or leaks length. Web Crypto is used rather than
`node:crypto` so the code is runtime-agnostic even though proxy is Node by
default:

```ts
// lib/auth/cron.ts
import type { NextRequest } from 'next/server'

const sha256 = async (s: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

export async function verifyCronSecret(req: NextRequest) {
  const presented = req.headers.get('x-zis-cron-secret')
  const expected = process.env.CRON_SECRET
  if (!presented || !expected) return false          // fail closed

  const [a, b] = await Promise.all([sha256(presented), sha256(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]  // no early exit
  return diff === 0
}
```

The route handler calls `verifyCronSecret` again itself rather than trusting the
proxy — same reasoning as the DAL. GitHub Actions sends the header from a repo
secret; the value is a 32-byte random string, and rotating it is a one-line env
change with no user-visible effect, because it is not on the session path.

### Dependencies added

`jose`, `@node-rs/argon2`, `server-only`. No auth service, no monthly cost, no
beta dependency, no session-length cap.
