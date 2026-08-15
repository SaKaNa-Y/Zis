# 06 — Specify the security model

Type: grilling
Status: open
Blocked by: none

## Question

The system fetches arbitrary remote URLs by design and feeds the results to an
LLM. That is the whole threat model in one sentence. Registration being disabled
removes a large class of problems (no signup abuse, no enumeration, no reset
flow) but not these.

**1. SSRF — the primary risk.** The fetcher must never reach internal
addresses. Specify a validator covering:

- Scheme allowlist (`http`, `https` only — no `file:`, `gopher:`, `data:`).
- Block private and reserved ranges: `127.0.0.0/8`, `10/8`, `172.16/12`,
  `192.168/16`, `169.254/16` (**cloud metadata — the one that leaks credentials**),
  `::1`, `fc00::/7`, `fe80::/10`.
- **DNS rebinding**: resolve the hostname, validate the *resolved IP*, then
  connect to that IP — not re-resolve at connect time. Specify how, concretely,
  in Node's fetch/undici.
- **Redirects**: every hop re-validated, hop limit enforced. Ties to Ticket 05's
  shortener unwrapping.
- Timeouts, max response size (a feed that streams gigabytes must not OOM the
  function), max redirect count.

Decide: **one validator used by the crawler, the shortener resolver, and the
image proxy alike** — three call sites, one implementation, unit-tested. Confirm
there is no fourth path that bypasses it.

**2. XML parsing.** Feeds are attacker-controlled XML. Disable external entity
resolution (XXE) and guard against billion-laughs expansion. Name the parser
library and confirm its defaults are safe — do not assume.

**3. HTML sanitization.** Fetched content is rendered in the browser. Sanitize
at **ingestion** or at **render**? (Sanitizing at ingestion means storing clean
data but re-sanitizing is impossible if the sanitizer improves; sanitizing at
render is safer but costs on every view — argue it.) Note that Ticket 07 strips
images at ingestion, which removes one large category regardless.

**4. Prompt injection.** An article can contain "ignore previous instructions."
The model reads untrusted text on every run. Mitigations to specify:

- Clear delimiting of untrusted content in prompts, with the system prompt
  stating that content between delimiters is data, never instruction.
- **Treat AI output as untrusted too** — a summary is rendered as *text*, never
  HTML, never a link the model invented.
- The model has **no tools and no side effects** during ingestion — it reads
  text and returns text. This is the strongest mitigation available and should
  be an explicit architectural rule.
- What's the blast radius if injection succeeds? At single-user scale with a
  tool-less model: a wrong summary. Confirm that's genuinely the ceiling.

**5. Secrets and endpoints.** API keys in Vercel env vars and GitHub Actions
secrets, never in the repo, never in a Client Component. The cron endpoint
authenticates by shared secret with a constant-time comparison. Rate-limit the
login route.

Deliverable: a written security model, plus the list of unit tests that must
exist (the URL validator's test suite is the most important code in the project
after clustering).
