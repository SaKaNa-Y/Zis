# Daily cadence acceptance — September 17, 2026

Closes the operational observation for [#92](https://github.com/SaKaNa-Y/Zis/issues/92).
The accepted scope is the existing daily **06:17 Asia/Shanghai** schedule, not
hourly activation. No code, retention, Admission, cloud configuration, or schedule
changed during this check.

## Live evidence

At approximately 15:10 Asia/Shanghai, authenticated Neon Console inspection
confirmed Zis (`summer-hat-29072279`), production
`br-wild-scene-b3gzsh9b`, on Free with 0.25 CU default compute. Its production
Overview reported month-to-date **1.6 CU-hours**, **583.87 MB network transfer**,
**101.97 MB storage**, and **85.68 kB history**. The organization project list
reported **102.14 MB storage for Zis across its two branches**. Organization-wide
compute was 1.76 CU-hours across four projects; that is an upper bound, not Zis
usage. The dashboard warns of an hour of metric delay and no refresh for inactive
projects. Today's scheduled run finished over six hours before inspection.

[Neon's official plan documentation](https://neon.com/docs/introduction/plans)
was checked on this date: Free includes 100 CU-hours/month, 5 GB/month public
network transfer, and 0.5 GB storage per project. Transfer covers the project's
products, not just ingestion. The current readings are well below these limits.

All nine scheduled runs for local dates September 9–17 succeeded on deployed
revision `117731f`, and all nine restored the pinned model cache. Pipeline runtime
ranged from **49.253 to 115.837 seconds**, averaging **75.258 seconds**, under the
120-second target on every observed run. The nine ingestion jobs consumed
**944 seconds** elapsed in total (20 whole minutes if rounded up per job).
The repository is currently PUBLIC and the workflow uses standard ubuntu-latest
runners; the former private-repository Actions allowance is not the operating
constraint. These totals describe these ingestion jobs, not all account activity.

| UTC run start date | Evidence | Pipeline seconds | Decoded JSON bytes |
| --- | --- | ---: | ---: |
| 2026-09-09 | [run 34294231433](https://github.com/SaKaNa-Y/Zis/actions/runs/34294231433) | 77.514 | 8,039,514 |
| 2026-09-10 | [run 34420519875](https://github.com/SaKaNa-Y/Zis/actions/runs/34420519875) | 115.837 | 9,917,341 |
| 2026-09-11 | [run 34545402432](https://github.com/SaKaNa-Y/Zis/actions/runs/34545402432) | 84.261 | 10,418,244 |
| 2026-09-12 | [run 34661201891](https://github.com/SaKaNa-Y/Zis/actions/runs/34661201891) | 91.574 | 10,674,189 |
| 2026-09-12 | [run 34726822510](https://github.com/SaKaNa-Y/Zis/actions/runs/34726822510) | 57.738 | 7,955,497 |
| 2026-09-14 | [run 34791951071](https://github.com/SaKaNa-Y/Zis/actions/runs/34791951071) | 49.253 | 6,411,444 |
| 2026-09-15 | [run 34914026967](https://github.com/SaKaNa-Y/Zis/actions/runs/34914026967) | 56.659 | 5,452,305 |
| 2026-09-16 | [run 35039640353](https://github.com/SaKaNa-Y/Zis/actions/runs/35039640353) | 71.896 | 6,105,772 |
| 2026-09-17 | [run 35167008063](https://github.com/SaKaNa-Y/Zis/actions/runs/35167008063) | 72.587 | 6,710,904 |

The September 12 23:59 UTC run belongs to September 13 in Asia/Shanghai.
Actual starts were delayed beyond nominal 06:17; the existing GitHub scheduler
remains approximate. Successful jobs are not proof that every Source succeeded:
today reported 60 outcomes for 67 configured Sources, with 5,777 persisted Items.
The existing Source failure/backoff and Dormant behavior is not erased by closure.
Current CI and Vercel deployment status for `117731f` both report success.

## Observation boundary and budget decision

The intended September 9 first-24-hour checkpoint was not captured. This check
**does not reconstruct or invent its exact counters**. Instead, the longer
September 8–17 observation supersedes that waiting gate: nine real scheduled runs
and actual delayed provider counters demonstrate that the deployed daily cadence
fits the resource budget. The September 8 integrity checks and full test/review
record remain the evidence for sealed Briefs, provenance, and reader isolation;
no database-content export or new migration was needed for this read-only check.

Against September 8's rounded 0.45 GB / 1.28 CU-hour baseline, the increase is
approximately **133.87 MB transfer and 0.32 CU-hours** over roughly 8.8 days.
That aggregate includes remaining rollout warmups, UI/operator/preview use and
other project traffic. It is not an isolated per-ingestion egress measurement.
As an intentionally conservative daily bound, charging the entire increase to
nine scheduled wakes gives about **14.9 MB/wake**, below the worksheet's
32.26 MB daily allowance. At the same observed mixed-use pace, a 31-day period
would add approximately **0.48 GB transfer and 1.14 CU-hours**. These are planning
projections, not guaranteed bills.

Retain the earlier explicit monthly envelopes: **1 GB ingestion + 1 GB UI/preview
+ 1 GB growth/maintenance + 2 GB margin**; **2 CU-hours ingestion + 10 CU-hours
UI/preview + 88 CU-hours margin**. Current actual transfer includes existing UI
activity; the additional UI and growth allocations are allowances, not separately
metered usage. Even conservatively adding a full 0.48 GB observed-period projection
and 2 GB additional UI/growth reserves to the current 0.584 GB leaves the September
plan near **3.07 GB**, below 5 GB. Compute has much larger headroom, including the
organization-wide upper bound. Unusual activity requires reassessment.

Zis storage is about **0.102 GB**, below the 0.4 GB planning boundary and 0.5 GB
limit. Relative to the rounded September 8 0.1 GB reading, the visible difference
is about 2.14 MB, too coarse to assert an exact growth rate. Allowing **0.1 GB of
additional growth this month** still stays near 0.202 GB. Permanent provenance
continues growing, so this is a current-month budget decision, not an indefinite
storage guarantee. Do not shorten retention or delete provenance to fit a budget.

The incremental transfer implementation, production verification, longer-than-
24-hour usage observation, and daily monthly budget are accepted. **#92 can close
for the daily scope.** Hourly remains unqualified and requires a separate owner
decision and workload-specific budget evidence. No follow-up automation was
created, and no additional cron was enabled.

Validation: live Neon UI, official quota documentation, GitHub run logs/status,
remote branch comparison, and Markdown diff checks. No source code changed;
no new test run was needed for this documentation-only acceptance record.
