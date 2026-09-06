# First production Brief proof — 2026-09-05

Operational evidence for [#91](https://github.com/SaKaNa-Y/Zis/issues/91), following
the [post-publication disclosure audit](2026-09-05-disclosure-audit.md).

**Status: production proof and historical routing verified.** The first successful
run persisted 79 entries. After repairing stored-vector reads, the follow-up run
completed through prune in 175 seconds and persisted an empty September 6 Brief.
Authenticated Today renders that empty Brief; its repaired Yesterday link renders
the September 5 Brief with all 79 entries. The repository's public visibility is
an owner-approved exception to the original private-repository precondition.
The 120-second budget is exceeded, with observations recorded below; hourly
activation remains deferred to #92.

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
  was not re-run. The September 2 provisioning record states that the manual
  snapshot was created before running migrations. This ordering is carried
  forward from that operator record; the September 5 check independently
  verified their presence, not a migration execution timestamp.
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

## Acceptance status

The snapshot and migration were already present; the negative ownership proof,
restoration, successful full run, first-entry split, and authenticated current-day
render have been verified. The original private-repository condition is explicitly
superseded by the owner's publication and approved disclosure scope. Authenticated historical
rendering of the nonempty first Brief is also verified below.

The 120-second budget was exceeded on both successful runs. This record explains
the observed intervals without asserting an unmeasured cause. Cadence and its
first-day budget observation remain deferred to #92.

## Scope boundaries

No schedule trigger, migration step, sealing state, paid service, or additional
pipeline job was added. `workflow_dispatch`, the single sequential job, and
`cancel-in-progress: false` remain intact. Hourly activation and a first-24-hour
budget observation belong to #92. The existing publication cannot be reversed
by describing this proof as private.

## Authorized retry and RSS publication repair

The owner approved pushing the three reviewed commits and retrying production.
`origin/main` advanced to `dd60dd90eb422dd5a40a44d3c96c5a4e02677be5`; its
[CI run 33971450256](https://github.com/SaKaNa-Y/Zis/actions/runs/33971450256) passed.
[Retry 33971462524](https://github.com/SaKaNa-Y/Zis/actions/runs/33971462524) failed
at Stage 0 on `2026-09-05T14:20:40Z`: an existing CSS Weekly Item used a
`feedpress.me` tracking address, owned by nobody. No final graph write was reached.

A read-only corpus query found 31 mismatched Item addresses: 24 CSS Weekly
tracking links, 6 Console reviews linking to the reviewed projects, and Josh
Comeau's one guest article on Smashing Magazine. Public feed contents and the
guest article's byline confirmed three distinct publication cases. The owner
explicitly chose to retain the Sources and separate reviews from their outbound
Citations, with a separately curated rule for the guest article.

[ADR-0021](../adr/0021-rss-publication-addresses-and-curated-guest-articles.md)
records this limited amendment. Commit
`a513de94ad53510e401810f8772483d7486353c6` implements it; all 380 tests in 33 files,
typecheck, lint, no-px, environment inventory, and production build passed on
Node 22.23.2. Both review axes found zero remaining actionable findings; its
[CI run 33972602020](https://github.com/SaKaNa-Y/Zis/actions/runs/33972602020) passed.

At 14:43 UTC, the reviewed
[one-off repair](../../scripts/operations/2026-09-05-repair-rss-publications.sql)
committed in Zis production. Its guards confirmed no Brief, 24 tracking Items,
24 corresponding self-Citations, 6 review Items/self-Citations, and no existing
corrected Link collision. The result showed 24 Link and Item URL corrections and
6 Citation-kind and Item-URL corrections, followed by COMMIT. No Item, Citation,
or Signal was deleted; existing identities and raw Citation addresses survived.
Josh's Item required no data rewrite. The next manual run is
[33972653363](https://github.com/SaKaNa-Y/Zis/actions/runs/33972653363), against the
same `a513de9` revision.

## Successful first cut and response-size regression

Run 33972653363 finished successfully at `2026-09-05T15:12:32Z`. The measured
first-query-through-prune interval was **1,660,981 ms (27m 40.981s)**, exceeding
120,000 ms. This was a cold initial graph computation: no Signal or Interest
embeddings had been persisted, and the pinned model cache was a miss (the model
download precedes the timed wake). All 67 Source outcomes spanned
`14:44:51.930Z` through `14:45:07.725Z`; the remaining time was downstream graph
computation, embedding, matching, and persistence. There is no per-stage profile
to attribute that interval exclusively to model inference. The model cache was
successfully saved at `15:12:29Z`.

Read-only checks on September 6 verified the September 5 Brief contains **79
entries: 65 Interest and 14 convergence**. Every Interest entry's why-text names
an exact statement owned by the reader; zero unowned Interest names or
inconsistent convergence descriptions were found. This checks provenance, not
a claim that every semantic match is subjectively useful. No statement content
is copied into this record.

The corpus contained 15,601 Signals, including 15,579 with embeddings.
`sum(octet_length(row_to_json(signal)::text))` was **83,080,990 bytes**; this is
the row-JSON measurement, not an exact HTTP-wire measurement. Subsequent
[run 34031850655](https://github.com/SaKaNa-Y/Zis/actions/runs/34031850655) restored
the model cache but failed on the single full Signal SELECT before ingestion.
Thus the successful initial write did not establish repeatability.

Commit `ed8441f4cd646ba9facb24e1b27f06e3cfb8827e` reads Signals in 1,000-row
primary-key pages. A real-Drizzle 10,000-vector regression reproduced the same
query failure with a simulated 64 MiB response ceiling before the fix, then read
the complete graph afterward. All **381 tests in 33 files**, typecheck, lint,
no-px, environment inventory, and build passed on Node 22.23.2; both review axes
reported no actionable findings. Its
[CI run 34032200037](https://github.com/SaKaNa-Y/Zis/actions/runs/34032200037) passed.
Production [run 34032200438](https://github.com/SaKaNa-Y/Zis/actions/runs/34032200438)
completed successfully on September 6 at `12:11:29Z`, with **175,000 ms** from
Neon wake through prune: **55 seconds over** the 120-second budget. The pinned
model cache was a hit. All 67 Source outcomes were stored; the corpus reached
5,381 Items and 15,632 Signals. A read-only query verified that all 15,579 previous
Signal embedding timestamps survived and 31 new embeddings were persisted.
The final Source completed at `12:09:14.305Z`, roughly 132 seconds before the
completion log. This bounds the downstream graph/match/persistence cost; no
finer stage profile is available. Cached embeddings improved the cold-run time
substantially but did not establish compliance with the target budget.

The September 6 Brief has zero entries. Its authenticated Today page displays
that date and the intentional empty state; previously admitted entries are not
repeated simply to fill the page. Gitleaks rescanned the three downloaded run
logs on September 6 with zero findings. Raw logs remain outside the repository.

## Historical Brief route correction

The owner's Yesterday link led to `/earlier/2026-09-05`, which returned 404 because
the application had no Earlier routes. Commit `51e183c` adds authenticated
`/earlier` and `/earlier/[date]`, reusing the existing reader-scoped Brief and
Signal projection. Invalid calendar dates and missing Briefs return 404; saved
local dates are not shifted through UTC. The archive displays dates and lead
titles, including the specified empty-Brief wording, rather than entry counts.
Read/save actions also revalidate dated pages.

All **388 tests in 34 files**, typecheck, lint, no-px, environment inventory, and
production build passed on Node 22.23.2. One initial sandboxed test run could not
create tsx's local IPC pipe; the complete suite passed when that runtime operation
was permitted. Standards review caught and resolved an archive-count design
violation; final Standards and Spec reviews both have zero actionable findings.
[CI run 34033193918](https://github.com/SaKaNa-Y/Zis/actions/runs/34033193918)
passed. Vercel reported a successful deployment of `51e183c` to production. On September
6, an authenticated browser followed Today -> Yesterday's Brief and rendered
`/earlier/2026-09-05` with the correct September 5 date, all 79 entries, and the
65 Interest / 14 convergence sections. A screenshot confirmed the reading layout.
Opening `/earlier` executed the archive query successfully and showed the same
date and first entry title, with its link back to that Brief. Anonymous requests
to both history routes returned 401. Read/save revalidation is covered by tests;
this verification did not mutate the reader's saved or read state.
