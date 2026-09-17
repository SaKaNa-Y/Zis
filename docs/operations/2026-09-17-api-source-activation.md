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

Activation has not yet been performed by this change. In particular, migration
files and a successful test suite are not proof of production ingestion.

## Verification boundary

Tests cover all three adapters through `runIngestion`, edited Item identity,
cross-list Publisher deduplication, partial HN fetch failure, robots rejection,
GraphQL errors and credential-bearing POST redirect refusal. Database tests
exercise two successive runs, including the host-ownership assertion, and apply
the seed migration twice while checking that RSS state remains intact.

Read-only live requests verified the HN list, Bluesky author-feed and GitHub
release response shapes and the three API hosts' robots policies. End-to-end
adapter execution remains to be verified on Actions. Production fetch duration
and transfer must be measured on the runner before claiming operational success.
