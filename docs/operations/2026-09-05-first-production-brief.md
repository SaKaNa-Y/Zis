# First production Brief proof — 2026-09-05

Operational evidence for [#91](https://github.com/SaKaNa-Y/Zis/issues/91), following
the [post-publication disclosure audit](2026-09-05-disclosure-audit.md).

**Status: incomplete.** Stage-0 rejection and restoration passed, but the full
run failed during final persistence. The repair is committed locally; publication
and the next production run await owner authorization. No successful first Brief
is claimed by this record.

## Preconditions verified

- GitHub repository: `SaKaNa-Y/Zis`, **public**. The owner published it before
  this work; the issue's original "still private" condition is superseded by
  that owner action and cannot truthfully be marked as satisfied.
- Production deployment: <https://zis-xi.vercel.app/>. Anonymous `/` returned
  HTTP 401 and `/login` returned 200. The owner's authenticated browser initially
  displayed "Today's Brief has not been cut yet."
- Neon project: `Zis`, project `summer-hat-29072279`, branch `production`
  (`br-wild-scene-b3gzsh9b`), database `neondb`, Singapore, fixed 0.25 CU.
- The manual production snapshot dated `2026-09-02 13:59:35 UTC` still exists.
  Nine migration records and the `item.text` retention column were present;
  migration `0008_retention_and_production_corpus` was already applied, so it
  was not re-run.
- Initial counts: 1 reader, 61 Publishers, 67 Sources, and 0 Items, Interests,
  Signals, Briefs, or Brief Entries. The production credential differs from the
  public bootstrap credential; the verification returned only a boolean.
- The owner explicitly approved initializing the production Interest Profile
  from their existing 20 research Interests. An idempotent insert wrote 20
  records directly into production; only their count is recorded here.
- Both manual runs use `fb98f5d4bf41d8cf16dd599bc02b65dd56ef9c9f`. Its application
  CI `check` passed in [run 33306334537](https://github.com/SaKaNa-Y/Zis/actions/runs/33306334537).

## Expected stage-0 failure and restoration

Stage 0 validates the hosts of **persisted Items**. An empty database would not
exercise that assertion merely by changing a Publisher mapping. To make the
negative proof meaningful, one real Item was imported from the registered
`https://github.blog/feed/`: the article with GUID `https://github.blog/?p=98615`,
published `2026-09-04T16:04:14Z`. Its public title and URL came directly from the
live feed. No synthetic Signal, Citation, or Brief Entry was inserted.

In the same atomic preparation block, `github.blog` was temporarily assigned to
the OpenAI Publisher after checking that its original owner was GitHub. The
original mapping was known before mutation.

[Negative run 33969250624](https://github.com/SaKaNa-Y/Zis/actions/runs/33969250624)
failed at `2026-09-05T13:34:56Z` with `host ownership assertion failed`, identifying
the GitHub Source's Item host as owned by the wrong Publisher. Exit code was 1;
the pipeline stopped before ingestion. The pinned model cache was initially a
miss and its preparation happened before the timed Neon wake.

The exact original Publisher mapping was restored after the failure. A separate
read-only query verified `github.blog -> github`, 20 Interests, and 1 Item before
the next dispatch. The imported Item retains its real Source/GUID identity so
normal feed ingestion can refresh it without introducing a test record.

## Full production run

[Run 33969506887](https://github.com/SaKaNa-Y/Zis/actions/runs/33969506887) was
dispatched after restoration and **failed**, after a job duration of 13m 14s.
At 13:44 UTC, a read-only progress query observed 67 Source outcomes, 5,372 Items,
15,601 Signals, zero persisted Signal/Interest embeddings, and zero Briefs or
Brief Entries. Source transactions had committed independently.

At `2026-09-05T13:52:07Z`, final graph persistence raised HTTP 413:
`request is too large (max is 67108864 bytes)`. No completed-prune timing was
printed, so job duration must not be reported as the measured Neon wake through
prune. The run did not produce a successful Brief proof.

The final graph writer batched Signal rows into SQL statements but still sent
every statement, vector, and match in a single HTTP transaction envelope. The
[Neon driver documentation](https://neon.com/docs/serverless/serverless-driver)
confirms a 64 MB HTTP request and response limit and supports WebSocket sessions
for interactive transactions.

## Repair and local verification

Commit `bf19adac5b5e0e5167fbbc216d0de9ddb6d22d04` keeps small commits over HTTP
and streams large commits through one scoped WebSocket transaction. Statements
are executed between one `BEGIN` and one `COMMIT`; a failure rolls back and
discards the connection. Reader matches and Brief Entries are batched to keep
individual statements below PostgreSQL's bind-parameter limit. The existing
transaction boundaries and `runNeonIngestion()` entry point are preserved.

- A 6,000-Signal fixture with real Drizzle SQL compilation reproduced the HTTP
  413 in 1.3 seconds before the fix and passed afterward.
- Additional cases verify rollback on a streamed-write failure and 12,000
  reader matches without exceeding 65,535 parameters per statement.
- Node 22.23.2 / pnpm 11.9.0: typecheck, lint, no-px scan, environment inventory
  check, all **370 tests in 32 files**, and the production build passed.
- Separate Standards and Spec reviews found zero actionable findings on the
  repair. Neither review substitutes for a live retry.
- Gitleaks found no secret in the two completed production-run logs. Only
  sanitized findings are recorded here; raw logs were not committed.

## Remaining production proof

- Publish the reviewed repair and run `workflow_dispatch` against its exact SHA.
- Require success through prune and record its actual Neon-wake milliseconds,
  model-cache result, and an explanation for any overage.
- Record first Brief entry count, Admission-route split, and authenticated Today
  verification, including any incorrect why-text without publishing Interests.
- Check the post-write Signal response size and verify a subsequent read/run.
  Loading every stored Signal still uses one HTTP response; the pre-write
  null-vector corpus cannot prove it fits after embeddings are present.
- Keep #91 open until the successful production evidence exists. Cadence remains
  deferred to #92.

## Scope boundaries

No schedule trigger, migration step, sealing state, paid service, or additional
pipeline job was added. `workflow_dispatch`, the single sequential job, and
`cancel-in-progress: false` remain intact. Hourly activation and a first-24-hour
budget observation belong to #92. The existing publication cannot be reversed
by describing this proof as private.
