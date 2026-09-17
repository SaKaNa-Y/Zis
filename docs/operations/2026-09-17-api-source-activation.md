# API Source activation

## Reason for the change

Read-only production checks on September 17 found 67 RSS Sources, seven disabled
after repeated failures. The register also contains 29 API Sources that the
production runner did not support: two HN lists, 18 Bluesky author feeds and nine
GitHub release watches. Completing that registered coverage is the owner's
requested change. Repairing the disabled RSS Sources is a separate task.

The saved September 9–17 Brief sizes were **1, 3, 2, 2, 1, 0, 1, 1, 2**.
All nine scheduled runs succeeded; this does not imply every Source succeeded.
Using the current graph and the September 17 cut time, the admission funnel was:

| Stage | Signals |
| --- | ---: |
| Live identities in the current corpus | 18,030 |
| Strength at least two | 237 |
| Also within seven days | 17 |
| Also not previously briefed / read | 13 |
| Interest admission | 1 |
| Convergence admission without an Interest match | 1 |

The remaining 11 had Strength two and did not match an Interest above the
existing threshold. This query used the current graph, not a historical graph
snapshot, and cannot attribute every earlier day's losses. New API Sources
can add independent Citations but do not guarantee those candidates pass.

## Change and activation order

The adapters share the existing normalization, Citation, Strength, matching and
sealing path. Fetch windows and their limits are specified in
[the pipeline contract](../ingestion-pipeline.md#implemented-api-sources).
No Admission threshold or cron changes are included.

1. Deploy the adapter code and the Actions mapping from `GH_PUBLIC_PAT` to
   `GITHUB_PAT`. The secret name was confirmed present; a local GitHub login
   cannot prove that the Actions secret has working permissions.
2. Take a fresh production snapshot, then apply `0011_api_sources.sql` through
   the normal migration process. Replacing an existing snapshot requires
   explicit approval because that recovery point is permanently removed. It adds
   exactly 29 Sources idempotently, retains RSS failure/disabled state, and
   removes the obsolete `github.com` host ownership assignment. Existing sealed
   Briefs and their entries are not changed.
3. Run Ingest manually and inspect per-Source outcomes, new Items, Citation
   counts, wake duration and transfer. The new Source configuration invalidates
   the incremental checkpoint configuration hash, so expect one bootstrap read.
4. Verify the following daily Brief and compare newly eligible Signals. A run
   after today's Brief was sealed cannot add entries to that same Brief.

## Production activation on September 17

The adapter commit passed [CI](https://github.com/SaKaNa-Y/Zis/actions/runs/35195743230)
and Vercel deployment. After explicit owner approval, the September 8 manual
snapshot was replaced by `production at 2026-09-17 07:41:57 UTC (manual)`.

The four statements in `0011_api_sources.sql` were applied manually through the
Neon SQL Editor in one transaction, with the matching Drizzle hash and timestamp
recorded in `drizzle.__drizzle_migrations`. This did not invoke `drizzle-kit`.
The transaction checked the previous migration baseline, exact Source counts,
unchanged RSS rows, and unchanged full-row digests of all 13 Briefs and 96 entries
before committing. An independent query confirmed 12 journal entries and 96
Sources: 67 RSS, two HN, 18 Bluesky, and nine GitHub.

The first [manual Ingest](https://github.com/SaKaNa-Y/Zis/actions/runs/35196370285)
completed successfully after the migration. Its Source commits confirmed all 18
Bluesky feeds (1,393 new Items) and eight GitHub release feeds (799 new Items).
React failed because GitHub now resolves `facebook/react` to `react/react`.
The adapter now checks release URLs against the canonical repository URL returned
by GraphQL; transferred-repository and unrelated-release regression cases pass.
All 448 tests in 43 files passed in the fix's
[CI](https://github.com/SaKaNa-Y/Zis/actions/runs/35196932423), and
[a second Ingest](https://github.com/SaKaNa-Y/Zis/actions/runs/35196992531)
confirmed all nine GitHub Sources successful, including 100 new React release
Items, and all 18 Bluesky Sources successful with no duplicate new Items.
The complete second run also succeeded.

The API corpus now contains 2,292 Items and 6,941 Citations. The full-row digests
of all 13 historical Briefs and their 96 entries still match the pre-migration
baseline. These corpus counts are not an Admission or next-Brief forecast.

Both HN Sources remain blocked by an upstream robots response with conflicting
Content-Type values: `application/octet-stream, text/plain`. Production recorded
an ambiguous, non-authoritative verdict; a separate live request reproduced the
two headers. The body contains JSON-path Allow rules, but the current robots
contract requires an unambiguous `text/plain` response. No bypass or cached allow
was introduced. The adapters are deployed, but HN is not yet delivering Items.

The first run took 1,305,863 ms from the first Neon query through prune, exceeding
the 120,000 ms budget. It reported 4,375 recomputed matches, 17,802 reused matches,
34,063,072 decoded read JSON bytes, 45,197 committed SQL statements, and
109,713,139 compiled write JSON bytes in one WebSocket commit. These JSON sizes
are instrumentation measures, **not billed Neon transfer**. The bootstrap run
completed but does not pass the wake-duration budget; steady-state cost remains
to be established.

The second run took 258,837 ms, also exceeding the wake budget. It included the
100 React Items and the first persisted-vector rematch after the bootstrap:
4,648 matches recomputed, 1,623 reused in the loaded scope, 35,456,251 decoded
read JSON bytes, 8,237 SQL statements, and 31,537,663 compiled write JSON bytes.
No third manual run was added solely to seek a better performance number.

## Verification boundary

Tests cover all three adapters through `runIngestion`, edited Item identity,
cross-list Publisher deduplication, partial HN fetch failure, robots rejection,
GraphQL errors and credential-bearing POST redirect refusal. Database tests
exercise two successive runs, including the host-ownership assertion, and apply
the seed migration twice while checking that RSS state remains intact.

Read-only live requests verified the HN list, Bluesky author-feed and GitHub
release response shapes and the three API hosts' robots policies. Actions
confirmed end-to-end
execution for the successful Sources described above. HN remains unverified
beyond its deliberate robots refusal. Billed transfer was not measured, and
the next daily Brief has not yet been produced; today's sealed Brief cannot
be enlarged by these manual runs.
