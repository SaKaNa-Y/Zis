# Post-publication disclosure audit — 2026-09-05

Requested before the production proof in [#91](https://github.com/SaKaNa-Y/Zis/issues/91).
GitHub confirmed `SaKaNa-Y/Zis` is public; the owner had already changed its
visibility before this audit. The original private-repository acceptance condition
cannot be reported as satisfied. Ingestion remains `workflow_dispatch` only.

## Scope and method

- Baseline: `fb98f5d4bf41d8cf16dd599bc02b65dd56ef9c9f`, a clean `main` checkout.
- Fetched all three remote branches and all 37 pull-request head refs. The
  resulting local refs reach 103 commits and 450 distinct file blobs; the clone
  is not shallow. No remote tags were advertised.
- Gitleaks 8.30.1, downloaded from its official GitHub release and checked against
  the published SHA-256 checksum file, scanned Git with
  `--log-opts='--all --full-history' --redact --ignore-gitleaks-allow`.
  It reported 95 scanned commits, 76 findings, and about 21 MB scanned.
- Independently scanned all 226 tracked files (about 10.6 MB), and all historical
  blobs for database credential URLs, private keys, password-hash patterns,
  environment assignments, and sensitive artifact filenames.
- Downloaded and scanned all 92 issue/PR records, 71 issue comments, zero PR
  review comments, and zero releases, including decoded title/body text. No
  Gitleaks findings occurred in those public records.
- Checked workflow triggers, permissions, and Actions secret **names**. The
  configured names are `DATABASE_URL` and `GH_PUBLIC_PAT`; no values were read.

Raw public-record copies and redacted scanner reports remained in a local
temporary directory. They are not committed as a second disclosure surface.

## Findings and disposition

### Existing real technical Interests: owner-approved public research

`interests.draft.md` is explicitly a real, reader-authored set of 20 technical
Interests. Fourteen tracked files contain exact statement matches, including
derived calibration results. The real profile entered `main` in `bc8fde2`.
The prototype README and linked research discussions also describe its origin.
Consequently, the earlier documentation claim that no real Interest entered Git
was false.

The owner explicitly approved retaining these existing technical Interests and
research outputs publicly on 2026-09-05. ADR-0010 and the repository guide now
record that bounded exception. Future private production Interests must still
remain in Neon and out of source control, issues, and workflow logs.

### Expired third-party article access tokens: removed from the current artifact

The historical calibration `findings.json` contains 18 distinct Bloomberg article
JWTs in 36 `accessToken` URL occurrences. They are third-party article-access
tokens, not Zis session tokens. Their decoded payloads include article and
tracking identifiers; expiry claims range from 2026-07-27 to 2026-08-21 UTC,
all before the audit date. They were
not replayed or used to access content, and signature or server-side validity
was not tested.

Removed those 36 query values from the current JSON while preserving the article
addresses and all other JSON values. Historical commits and existing copies
still contain the expired values; this audit does not claim to retract them.
Future published research outputs must omit credential-bearing URL parameters.

### Test and migration matches: not live production credentials

The four current generic-key findings are fixed strings used by authentication
tests. Production reads `SESSION_SECRET` from its environment and has no fallback
to those test literals. Database URL matches are documented/test placeholders.
The broader blob scan also found Argon2 format checks, test fixtures, and the
public bootstrap hash in migration `0006`; it found no committed private-key or
environment artifact beyond `.env.example`.

A read-only production query confirmed the live reader credential differs from
the public migration seed, by comparing a suffix and returning only a boolean.
No production password hash was selected or exported.

### GitHub secret scanning: disabled at audit time

The secret-scanning API returned `404: Secret scanning is disabled on this
repository`. The local scan is evidence for this review, not continuous coverage.
The workflow with database access is manual, has `contents: read`, and is not
triggered by fork pull requests; CI has no configured application secrets.

## Limits

No live Zis database credential, PAT, or session-signing secret was identified in
the scanned material. This is a bounded finding, not a guarantee that no secret
exists. It does not cover deleted/unreachable remote objects, earlier revisions
of edited GitHub comments, third-party caches or clones, every old Actions log,
private deployment logs, or local ignored files that were never published.
The retrospective audit cannot satisfy ADR-0010's original pre-publication gate.

## Verification after cleanup

- Re-scanning the current tree with Gitleaks left only the four reviewed
  authentication-test literals. No JWT findings remained.
- Parsed the original and cleaned JSON and compared them recursively after
  removing only the identified `accessToken` values: all other values matched.
- On Node 22.23.2 / pnpm 11.9.0, `pnpm typecheck`, `pnpm lint`,
  `pnpm check:no-px`, `pnpm check:env`, and `pnpm test` passed. The full suite
  passed 367 tests in 31 files.
- The first sandboxed test attempt passed 366 tests and failed the `tsx`
  subprocess check because the sandbox disallowed its IPC socket (`EPERM`).
  Running the same suite with local IPC permitted passed all 367 tests.
- `git diff --check` passed. No application source, schema, or workflow changed;
  no new tests or production build were needed for the research/documentation
  cleanup.
