# Zis security model

Settled by [#7](https://github.com/SaKaNa-Y/Zis/issues/7). This is reference
material — read it before writing anything that makes a network request, parses
a feed, or renders fetched content. The *why* behind each rule is in #7's
resolution comment; this document is what you check against.

The threat model is one sentence: **Zis fetches arbitrary remote URLs by design
and feeds the results to an LLM.** Registration is disabled and there is exactly
one account, which removes signup abuse, enumeration, and reset flows — and none
of what follows.

---

## 1. Egress: `safeFetch` is the only way out

**Every outbound HTTP request in the system goes through one module.** Not "every
untrusted request" — every request, including curated Sources like HN Firebase
and GitHub GraphQL. There is no exemption list, because an exemption list is the
shape a bypass path takes.

This is enforced by lint, not by review:

- `no-restricted-globals` bans `fetch`
- `no-restricted-imports` bans `undici`, `node:http`, `node:https`

with a single exception for the `safeFetch` module itself. A new adapter that
calls `fetch` directly fails CI. Auditing for a fourth call site is a one-time
act; the fourth call site arrives in six months.

### 1.1 URL validation

- **Scheme allowlist**: `http` and `https` only. No `file:`, `data:`, `gopher:`,
  `blob:`, or anything else.
- **Resolve, then validate every returned address.** Not the first — all of
  them. A hostname with three A records where one is private must be rejected.
- **Blocked ranges (IPv4)**: `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`,
  `169.254.0.0/16` (**cloud metadata — the range that leaks credentials**),
  `172.16.0.0/12`, `192.168.0.0/16`, plus multicast and reserved space.
- **Blocked ranges (IPv6)**: `::1`, `fc00::/7`, `fe80::/10`, and
  **IPv4-mapped addresses** (`::ffff:169.254.169.254`) — evaluated by their
  embedded IPv4 value, not as opaque v6. This is the standard bypass.
- IPv6 is validated, **not blocked wholesale**. Refusing AAAA records entirely is
  simpler and wrong: it silently drops hosts as the web moves to v6, and the
  failure presents as "the crawler mysteriously can't reach this host."

### 1.2 DNS rebinding: connect to the pinned IP

Validating a hostname and then handing that hostname to `fetch` is not
protection. The resolver runs again at connect time and can return a different
address.

**undici — which backs Node's global `fetch` and therefore Next.js's — silently
ignores the `agent` option.** A guard built on a Node `http(s).Agent` with a
custom `lookup` compiles, runs, looks correct, and does nothing. Budibase shipped
exactly this bug ([GHSA-v42f-v8xc-j435](https://advisories.gitlab.com/npm/@budibase/server/GHSA-v42f-v8xc-j435/)).

The working shape:

```ts
// dispatcher, NEVER agent — undici ignores `agent` silently.
const dispatcher = new Agent({
  connect: {
    lookup: (_hostname, _opts, cb) => cb(null, [{ address: pinnedIp, family }]),
    servername: hostname, // TLS still validates the NAME, not the IP
  },
});
```

- **A fresh dispatcher per validated request.** undici's `Agent` pools per
  origin, so a shared global instance leaks pins between hosts. One allocation
  per fetch is free at this volume.
- **`servername` is set explicitly** so certificate validation still checks the
  hostname. Connecting to a raw IP without it either breaks TLS or, worse,
  weakens it.
- **The resolver is injected, not imported.** `safeFetch` takes a resolver as a
  dependency rather than calling `dns.lookup` directly — this is what makes the
  rebinding test (§7, test 2) possible to write at all.

### 1.3 Redirects

- **Maximum 3 hops**, matching the shortener unwrapper in #6.
- **Every hop is fully revalidated** — resolve, check, pin. Hop 1 landing
  somewhere public says nothing about hop 2.
- Redirect loops are detected and terminated.

### 1.4 Limits

- **20s** total timeout per fetch.
- **8 MB** maximum response for article fetches, enforced by **streaming and
  aborting mid-transfer**. Not by downloading the body and then truncating —
  that is the OOM this limit exists to prevent, and it is what the #6 prototype's
  `net.mjs` does. A feed that streams gigabytes must never be fully read into a
  serverless function's memory.

### 1.5 Politeness is part of the fetch policy

These were found investigating specific sources (#2, #16) but they are general
fetch-policy rules, not source-specific lore. They live here so they get applied:

- **Parse and obey `robots.txt` per host, before fetching** — including article
  fetches from the open web, and including `Content-Signal` directives such as
  `ai-input=no`.
- **`robots.txt` must be served as `text/plain`.** A response of 200 with
  `text/html` is not a robots file. `openhome.bilibili.com` returns exactly that,
  and a parser trusting the status code finds no `Disallow` and concludes
  "allowed" — a **fail-open** bug.
- **HTTP 200 is necessary but not sufficient** proof of content. A robots-allowed
  page returned 200 carrying a captcha interstitial. This applies to feed
  validation generally.
- Conditional requests (`etag` / `last-modified`) everywhere, byte-identical
  query params so 304s actually fire, serial rather than concurrent fetching,
  honor `retry-after` and `x-poll-interval`, and send a descriptive User-Agent
  with a contact URL.

### 1.6 Known call sites

`safeFetch` currently has **two** callers: the crawler and the shortener
resolver. A third — an image proxy — exists only if #17 decides thumbnails are
proxied rather than hotlinked. **The security input to that decision is a
constraint, not a verdict**: if you proxy, it goes through `safeFetch` like
everything else; if you hotlink, there is no SSRF surface but the reader's IP and
referrer leak to every publisher.

---

## 2. XML parsing

Feeds are attacker-controlled XML. The **rule** is settled here; the **library**
is #8's choice, since #8 decides feed parsing anyway. Whatever it picks must:

- **Reject DTDs / `DOCTYPE` outright** and disable external entity resolution
  (XXE).
- **Disable entity expansion**, guarding against billion-laughs.
- **Enforce a hard byte cap before parsing**, not after.
- Have these properties **verified against the library's current primary docs, not
  assumed**, and locked by the tests in §7.

The #6 prototype hand-rolled regex parsing with zero dependencies. That is not a
production candidate, but it does mean nothing is currently locked in.

---

## 3. Content rendering

**No publisher-supplied HTML is ever stored or rendered.** Extraction produces
plain text. See [ADR-0005](adr/0005-no-publisher-html-is-ever-stored.md).

This is not a sanitizer configuration — it is the absence of a sanitizer, because
there is no untrusted markup on any path.

---

## 4. Prompt injection

An Item can contain "ignore previous instructions," and the model reads untrusted
text on every run.

**Mitigations:**

- Untrusted content is **clearly delimited** in prompts, and the system prompt
  states that content between the delimiters is data, never instruction.
- **The model has no tools and no side effects during ingestion.** It reads text
  and returns text. This is the strongest mitigation available and is an
  architectural rule, not a configuration.
- **AI output is untrusted output.** A summary renders as plain text — never
  HTML, never auto-linkified — so a URL the model invented cannot become
  clickable.
- **The Interest Profile never appears in a DeepSeek prompt** (#3 — DeepSeek
  trains on inputs by default and stores them in the PRC). It therefore cannot be
  exfiltrated by injection.

**Blast radius, confirmed:**

Detection is deterministic — URL co-citation, no LLM — so injection **cannot
manufacture a Signal or alter Strength**. The why-text is the matched Interest,
not generated prose, so it **cannot be forged**. The profile is never sent, so it
**cannot leak**. What remains is a hostile or wrong **name/summary**.

One correction to the naive "just a wrong summary" framing: Briefs are **sealed**
(#14), so a hostile summary is **permanent** in that day's Brief. This is
accepted. The one-click kill acts on the Signal for *future* Briefs; a sealed
Brief is a record of what you were actually shown, and a Brief that can be edited
retroactively is no longer evidence. At single-user scale the harm of a bad
sentence in yesterday's brief is approximately zero, and the alternative reopens
the invariant that makes the whole boundary structural.

---

## 5. Secrets, endpoints, and auth

- **API keys live in Vercel env vars and GitHub Actions secrets.** Never in the
  repo, never in a Client Component.
- **There is no cron endpoint.** This originally specified one authenticating by
  shared secret, as the only route besides login that was not session-gated.
  [Specify the ingestion pipeline](https://github.com/SaKaNa-Y/Zis/issues/8) removed
  it: the pipeline runs as a Node script **inside the GitHub Actions runner**,
  connecting to Neon directly, so no route exists to authenticate. The deciding
  argument was this section's own logic — an exemption from the auth boundary is
  the shape a bypass takes, and removing a route beats hardening one. **`login` is
  now the only route that is not session-gated.** The runner's own credentials are
  Actions secrets, and `safeFetch` binds it exactly as it binds the app.
- **Login is rate-limited by Postgres**, not by Redis or a platform feature:
  `failed_attempts` and `locked_until` columns on `User`, checked and incremented
  in the same transaction as the password verify. No new infrastructure, survives
  redeploys, and does not tie a security property to a hosting vendor. Argon2id at
  a real cost factor is itself a throttle, but a public login route with no
  lockout is the one thing a scanner will find. The transaction holds the sole
  reader row `FOR UPDATE` through Argon2 verification, so a stale success cannot
  clear failures recorded by a later request. Five consecutive failures lock the
  row for 15 minutes; the first attempt after expiry starts the count at one.
- `verifySession()` in the DAL is the auth boundary, **not `proxy.ts`** — Server
  Actions POST to the route they are used on, so a proxy matcher that excludes a
  path also un-gates its Server Actions (#4).

---

## 6. The passphrase: a generated secret, and no in-app recovery

Settled by
[#18](https://github.com/SaKaNa-Y/Zis/issues/18). This section refines #4's
"Argon2id passphrase" and is the whole of Zis's credential-recovery story.

**Zis has no in-app credential recovery, deliberately.** There is no reset route,
no recovery-code table, no break-glass environment variable, and no second route
that can mint a session. §5's rule is the reason: an exemption from the auth
boundary is the shape a bypass takes, and a mechanism that can grant a session
without the passphrase is live on every request forever, while the loss it
insures against costs one `UPDATE` to undo.

### 6.1 The credential is generated, never chosen

The passphrase is a **high-entropy random secret held in a password manager**,
not a memorable phrase. This is what makes having no recovery flow respectable
rather than lazy: "lost passphrase" stops being a Zis failure mode and becomes a
password-manager failure mode, with the same blast radius as losing
`DATABASE_URL`.

**The human generates it; the seed migration only ever sees the Argon2id hash.**
Generate in the password manager, hash locally, paste the hash into the
migration. The plaintext never leaves the machine and never enters git.

**The migration must never generate or print the plaintext.** The repo is public
(ADR-0010) and migrations are manual (`docs/repo-and-ci.md`), so a printing
migration puts the credential one shell history — or one accidental Actions run —
away from a public build log.

**The committed hash is not a leaked credential**, and it looks like one to the
next reader. Argon2id at a real cost factor is what makes committing it safe.

### 6.2 Recovery is a `UPDATE`, and it bumps `session_version`

Recovery is the deploy path, not an app path: connect to Neon with credentials
already held and replace the hash.

Generate the replacement digest locally without putting plaintext in a command
argument or shell history. On PowerShell, the committed helper accepts stdin
only and prints only the Argon2id PHC digest:

```powershell
(Read-Host 'Generated passphrase' -AsSecureString |
  ConvertFrom-SecureString -AsPlainText) |
  pnpm exec tsx scripts/auth/hash-passphrase.ts
```

Then run this **single statement** in the Neon SQL editor, replacing the sample
digest with that output:

```sql
UPDATE "user"
SET
  "passphrase_hash" = '$argon2id$v=19$m=65536,t=3,p=1$<salt>$<digest>',
  "session_version" = "session_version" + 1,
  "failed_attempts" = 0,
  "locked_until" = NULL
WHERE "id" = (SELECT singleton."id" FROM "user" AS singleton);
```

The scalar subquery deliberately fails if the one-reader invariant has been
broken; a successful recovery must report exactly one updated row. The new
plaintext stays in the password manager, while only its digest reaches Neon.

**The same statement must bump `session_version`.** This is required, not
optional. A re-seed cannot distinguish "I forgot the passphrase" from "someone
else has it", so every live session dies.

**Recovery leaves no application-side record, by construction.** It is a SQL
statement, not an app event — Sentry and `source_fetch_log` never see it, and
there is nothing to build. Neon's own query history is the only trace.

### 6.3 The standing requirement on the operator

**Neon access is the recovery path, so it must not share a failure domain with
the Zis passphrase.** If Neon sign-in and the passphrase ever end up in the same
vault, the recovery path is gone and nothing in the app will say so. Recovery
codes would not fix this — stored in that same vault they die with it, which is
insurance sharing a failure domain with what it insures. The cheap offline backup
is to **print the passphrase**: same survival property, zero app code, no new
route. That is a password-manager habit, not a Zis feature.

---

## 7. Required tests

The URL validator's test suite is the most important code in the project after
clustering. In priority order:

| # | Test | Proves |
|---|------|--------|
| 1 | IPv4-mapped IPv6: `::ffff:169.254.169.254` is rejected | The standard bypass is closed |
| 2 | **Injected resolver returns a public IP on the first lookup and `169.254.169.254` on the second; the connection still goes to the first** | The pin works. **This is the only test that would have caught the Budibase bug** |
| 3 | Multi-record DNS where one of several addresses is private → reject | Every address is validated, not just the first |
| 4 | Redirect hop 2 points at `127.0.0.1` → reject | Per-hop revalidation |
| 5 | `file:`, `data:`, `gopher:` schemes rejected | Scheme allowlist |
| 6 | `0.0.0.0`, and decimal/octal-encoded IPs (`http://2130706433/`) rejected | Encoding tricks |
| 7 | A response exceeding 8 MB aborts mid-stream | Streaming abort, not post-hoc truncation |
| 8 | XXE and billion-laughs payloads against the chosen parser | §2 rule holds for the actual library |
| 9 | Redirect loop and hop-limit exhaustion terminate cleanly | §1.3 |

Test 2 is the one most likely to be skipped as "hard to test." It is the reason
`safeFetch` takes an injected resolver (§1.2) — that is a design consequence of
the test list, not a testing detail.
