# Code and secret security audit — 2026-10-01

## Scope and evidence

Baseline: main `4f2eae4c687726788e47d39e31a3a0d27fc1b7a3`.
The initial audit ran locally. The owner subsequently approved publishing the
patch and adding the hardening recorded below. Local scanner findings were not
uploaded; CodeQL is configured to upload its own analysis to GitHub. No credential
was used to test access, revoked, or rotated.

At baseline, GitHub returned no code-scanning analysis (404), and secret scanning,
non-provider patterns, validity checks, and push protection were disabled. The
initial secret-alert API reported a token-scope requirement; no scope was expanded.
Dependabot is enabled and its dependency findings had already been fixed.

Tools and coverage:

- Gitleaks **8.30.1**, official Darwin arm64 release, archive SHA256 verified
  against its official release checksums. Default rules, full redaction,
  inline allow comments ignored, two decode levels, metadata-only report template.
- Full reachable local history after fetching remote refs: **99 commits**, with
  **98 patch-producing commits** scanned using `--all --full-history
  --diff-merges=first-parent`; main itself contains 98 commits. Also scanned an
  archive of all **302 tracked files** on exact main, without node_modules/build
  output or untracked personal environment files.
- Semgrep Community Edition **1.178.0**, Python **3.12.14**, local official rules
  pinned at `semgrep/semgrep-rules@a84ff9cc2453ca91d581380de4b8b3f272f6f4be`:
  JavaScript, TypeScript, GitHub Actions YAML, and generic rules. Metrics and
  version checks disabled, no login/upload, no remote configuration at scan time.
  The normal CA bundle was supplied; TLS verification was not disabled.
- Baseline scan: **303 paths** (tracked snapshot plus an empty scanner-only ignore
  file), **289 signals**, including **125 security/audit signals**. These are
  review leads, not 289 vulnerabilities. Internationalization/style/correctness
  rules explain much of the remaining output; English-only UI is intentional.
- Supplementary local JWT decoding checked all snapshot files and classified
  algorithms/claim keys/expiry only. No signature or live-token validity probing.
- Manual review covered auth/session revocation and server actions, parameterized
  queries, outbound-request boundaries, feed text processing, robots rules,
  workflow permissions/secrets wiring, and the scanner's security findings.

## Confirmed findings and local fixes

### 1. CPU exhaustion through robots wildcards

`src/lib/robots.ts` compiled remote wildcard rules into expressions containing
repeated `.*`. A 32-wildcard rule and a short nonmatching path blocked an isolated
Node process beyond a two-second deadline. A remote host serving its robots rules
can therefore consume ingestion CPU; the HTTP timeout does not interrupt
synchronous regex execution. This is an availability issue, not demonstrated
credential disclosure or code execution.

The patched matcher searches literal segments forward, preserving `*`, terminal
`$`, literal metacharacters, rule priority, and Allow/Disallow behavior without
regex backtracking. Regression cases include the hostile nonmatch and overlapping
suffixes. A bounded differential check matched the old semantics in **266,321**
small pattern/path combinations.

### 2. CPU exhaustion through unclosed markup

`src/lib/ingestion/plain-text.ts` used global expressions that repeatedly retried
unclosed tag/comment openers. A 100 KB sequence of tag openers blocked an isolated
Node process beyond two seconds. The input is well below the fetch byte cap.

The patched text extractor locates complete comment/tag spans with forward
searches, retaining unmatched text as before. Tests cover repeated unclosed tags
and comments, nested-looking markup, multiline comments, and entity decoding.
No HTML rendering or sanitizer trust boundary is introduced.

### 3. Third-party bearer JWT retained in a published prototype

Two URL fields in `.scratch/zis/prototype/PROTOTYPE-calibration/findings.json`
contained the same RS256 JWT in an `access_token` parameter. The URL host is
Stratechery and the issuer hostname claim is `app.passport.online`; this is not a
Zis session token or identified infrastructure API key. Its **unverified expiry
claim is 2026-08-19 11:02:59 UTC**. It was already past that claim at the recorded
introducing commit time. No attempt was made to authenticate, validate the
signature, or determine actual account entitlement.

The local patch removes that parameter from the record's `id` and `url`, retaining
the article host/path and measurements, and adds a regression guard without
embedding the token in a fixture or failure output. This is a real committed
bearer-token artifact, not a test-fixture false positive. Claim expiry is not proof
of provider-side revocation. It does not establish that a currently usable Zis
production secret was exposed.

History still contains this value at commit
`c1443091b41c830b3a3f3170d83c940cb09fed79`. It also contains **18 distinct Bloomberg
HS256 access-link tokens** (36 repeated URL fields), with expiry claims between
2026-07-27 and 2026-08-21. Those Bloomberg parameters were removed from the current
snapshot in the documented 2026-09-05 cleanup. Historical copies and forks are
not erased by this patch. No history rewrite or credential revocation was done.

## Triage of other scanner signals

- Gitleaks current snapshot: **4 findings**, all explicit signing-key constants in
  `session.test.ts`, `dal.test.ts`, and `tests/auth-routing.test.ts`. Their uses are
  isolated test inputs/environment injection; no production fallback uses them.
  Full-history Gitleaks: **44 reports** = 8 repeated historical test constants
  plus 36 Bloomberg JWT fields. The current RS256 token was caught by Semgrep
  and the supplementary decoder, illustrating why one scanner is insufficient.
- Semgrep's 88 HTML-template security signals are test payload construction,
  not production HTML sinks. The two dynamic-method signals in safeFetch invoke
  the fixed `Symbol.asyncIterator`, not attacker-selected property names.
- Remaining dynamic regular expressions use fixed canonicalization names,
  validated local env-variable names, or trusted archived-prototype definitions.
  The remote robots expression was the exception and is patched above.
- Health-report replacements escape Markdown/HTML/workflow-control characters;
  they are not a browser HTML sanitizer used to trust fetched markup.
- **7 action references use mutable version tags** across `ci.yml`/`ingest.yml`
  (9 overlapping rule reports) at baseline. The approved hardening pins all seven
  to verified official release commits and also pins the new CodeQL workflow.
  This is preventive hardening, not evidence that an action was compromised.
- The intentional committed Argon2id credential digest is documented in the
  security model; a digest is not a plaintext credential. Password entropy and
  live secret-store values cannot be established from this repository scan.

## Patch validation and remaining limits

Fresh checks pass: typecheck, ESLint including egress enforcement, no-px,
env-example, **568 tests / 57 files**, and production webpack build for the final
patch including both workflow-boundary tests. Remote PR checks must also pass on
the reviewed commit.
The artifact regression test failed against the unsanitized baseline and passes
after cleanup. Both CPU-exhaustion reproductions were terminated locally; no
production target was exercised.

Post-patch Semgrep scans **305 paths** and reports **286 signals**, with no JWT
finding and no robots dynamic-regex finding. The remaining secret-severity
signals are the four documented test constants. One test file,
`src/app/earlier/earlier.test.ts:14`, has a Semgrep partial-parse limitation around
a typed Vitest import callback; it was manually inspected and passes TypeScript
and Vitest. The baseline also had a partial parse in plain-text extraction; that
production file parses after the patch. A transient default-timeout on the large
prototype JSON was resolved by rerunning with a 30-second rule timeout.

This is not a complete penetration test or proof of no vulnerabilities. CE
analysis lacks the full cross-file analysis of commercial engines. Patterns can
miss unknown credentials and business-logic flaws. GitHub-hosted deleted refs,
other clones, production databases, Vercel/GitHub secret values, runtime logs,
and live authorization boundaries were not exhaustively scanned. Subsequent
security integrations were explicitly approved by the owner.

## Approved hardening and use impact

On 2026-10-01 the owner approved publication/merge after passing checks, secret
scanning/push protection, CodeQL, and Action SHA pinning.

- GitHub confirmed secret scanning and push protection **enabled**. Non-provider
  patterns and validity checks remain disabled. No scopes or credentials changed.
- Enabling access exposed **7 open `openvsx_access_token` alerts**, all introduced
  at `e26e94bccd3e65334df3eb55a8acc56db2a18416` on 2026-09-05. Alerts 1–2 point to
  `src/lib/signals/provenance.test.ts` lines 40/43; alerts 3–7 point to
  `src/app/signals/[signalId]/provenance.test.ts` lines 90/75/151/148/108. Each
  matched value is a UUID used as `publisher_id` or `origin_publisher_id` in
  injected fake query results with example-domain URLs. A tracked-tree search
  found them only in these test files. These are classified as fixture false
  positives based on their use, not assumed safe because of absent execution.
  GitHub validity remains **unknown**. No provider authentication probe, alert
  dismissal, or credential action was performed.
- CodeQL uses `security-extended`, JS/TS, build mode `none`, and only source-read
  plus security-result-upload permissions. It runs on PR/main changes without
  secrets or a scheduled production wake. Remote analysis results must be checked
  after publishing; adding the file alone does not prove successful analysis.
- Existing Action majors are retained at their current verified official release
  commits. Version comments and manual update procedure are documented in
  `docs/repo-and-ci.md`; version-update PRs remain off under the existing policy.
- Login, reading, saving, and production credentials are unchanged. Existing
  robots/text semantics have regression coverage; hostile input no longer relies
  on the affected backtracking expressions. No live production ingestion or
  database mutation was used for verification.
- The cleaned [Stratechery article](https://stratechery.com/2026/whos-afraid-of-chinese-models/)
  was opened without a token or account on 2026-10-01 and its public article body
  was readable. Only two archived prototype URL fields changed; article identity
  and calibration measurements were retained. Audio/account-only features still
  follow the publisher's normal login rules.
- Push protection may block future commits containing recognized credentials.
  CodeQL adds PR-analysis time, not page-load work. Existing deployment and daily
  ingestion triggers remain unchanged; no extra manual deployment is introduced.

Historical bearer-token copies remain in Git history. Any third-party revocation,
rotation, or history rewrite still requires a separate owner decision. The seven
fixture alerts are deliberately left open with triage evidence, rather than
using dismissal to present a zero-alert result.

## First main-branch CodeQL result

PR #100's CodeQL analysis had zero results. The first complete main analysis
(`546de48a34b41ab7577ff1c3e2e0fcdeee60163b`, analysis `1871233056`) reported one
`js/incomplete-url-substring-sanitization` finding at
`src/lib/ingestion/aggregator-hydration.test.ts:84`. It was an assertion that no
MDN reference survives aggregator hydration, using a hostname substring anywhere
in the URL. It was not a production URL allowlist or request-routing boundary.
The follow-up uses parsed hostname equality, preserving the intended host-wide
assertion without matching an unrelated path or a lookalike hostname. No query
exclusion, scan suppression, or manual alert dismissal was added. GitHub's
post-merge analysis must confirm the finding is fixed.
