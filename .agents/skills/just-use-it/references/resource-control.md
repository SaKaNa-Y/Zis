# Resource Control

Use before a costly operation, uncertain workload, or relevant change in configuration, dependencies or links. Reuse established checks while their conditions hold.

## Bound the work

Establish the actual files, workspace, dependencies and symlink scope through public file listings, dry runs, resolved configuration or a small control. A small fixture directory does not prove a small scan. Retain default behavior separately from a comparison bounded by explicit exclusions.

Choose and announce memory, concurrency and duration boundaries from current machine capacity, task needs and prior evidence. Budget all audit-owned operations and descendants together, including assessment work. Initially serialize builds, installations and large scans; cheap independent reads can overlap. Increase concurrency only when observed consumption supports it. Available worker slots are not a resource budget; there is no universal numeric cap.

## Control execution

Use reliable process or container limits when available. For sampled monitoring, record the measured scope, threshold, sampling interval and termination action; account for possible overshoot and processes outside the measurement. Establish ownership of descendants and background services before launch. If a risky operation cannot be bounded, reduce the workload or mark it Blocked with the missing control.

Distinguish startup readiness, a stalled interaction and the intended lifetime of a persistent service. Choose timeout or no-progress criteria for the operation rather than requiring every server to exit.

## Recover from a cutoff

Stop the affected owned process tree, verify resource release and retain the operation, threshold, observed consumption and cleanup result. Distinguish excessive fixture scope, an inadequate budget and possible product behavior; a cutoff alone proves none of them.

Retry only a concrete lower-risk discriminating alternative, such as fewer files, reduced concurrency or a separate build. If progress requires a higher budget, present its concrete cost and uncertainty for a user decision. Continue other feasible selected groups. Save the interrupted state and resumption condition; it is incomplete coverage, not a verified result.
