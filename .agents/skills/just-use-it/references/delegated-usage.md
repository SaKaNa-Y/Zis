# Execution Coordination

Apply the main workflow’s execution choice to existing Capability Groups and Vertical Capability Slices. Each executor performs real user journeys, variations, and exploration. The main agent retains combined coverage, target identity, phase transitions, and the final report.

Read the shared [coordination contract](../../assess-findings/references/coordination.md) for assignment context, evidence updates and ownership transfer. The usage-specific rules below also apply.

## Assign a Slice

For delegated work, give the worker this skill and its relevant references, its assigned outcome and coverage boundary, public starting material, verified artifact or instance, current source/tracker access state, and authorized disposable resources. Supply only the context needed for that assignment rather than the full conversation. A worker does not remap the whole product, start its own source pass, or spawn more agents.

Keep one named executor responsible for each active slice through completion or an explicit transfer. Completing a slice closes its coverage record, not necessarily the executor’s assignment. Report newly discovered independent outcomes to the main agent instead of expanding into another worker's assignment. The main agent applies the [outcome scope](../SKILL.md#establish-the-outcome-scope) before assigning further work and prevents duplicate assignments.

Apply the [aggregate resource budget](resource-control.md) before choosing concurrency. Use at most two concurrent Just Use It subagents unless the user explicitly requests more; available host capacity may require fewer. Count direct main-agent usage toward the same usage ceiling; separately active assessment and reconciliation keep their own assignments and share the available host capacity. Independently writable consumers may share a verified immutable artifact. Serialize prerequisite-dependent slices and work that would mutate the same installation, project state, browser session, or service. Do not open an extra browser session merely to create parallelism when the user selected an existing one.

## Preserve Audit Phases

Source and tracker boundaries apply to the whole audit, not separately to each worker. Finishing one slice does not open either boundary. The main agent advances the source pass only after accounting for the required hands-on evidence under the main workflow. Newly source-discovered slices retain their provenance regardless of the selected executor. If any agent reads implementation or tracker history early, report the departure and its affected scope; a fresh worker cannot restore independent provenance by forgetting that history.

## Hand Back Evidence

Return a compact result using the existing Verification Traces and Finding Packets:

- Assigned slice and coverage states, including exclusions and unfinished work.
- Observed outcomes, discriminating contrasts, expectation basis, demonstrated impact, and material unknowns; distinguish proposed classification from established evidence.
- Replayable inputs and key evidence, with paths or references for longer artifacts already retained.
- Batch and actual artifact identity, distinguishing newly executed traces from inherited evidence, and any source or tracker exposure that changed the evidence scope.
- Proposed coverage updates for the coordinator to integrate; shared index writes stay with the coordinator, who checks their saved result.
- Resources created, cleanup completed, and anything explicitly transferred to the main agent.

Reference existing artifacts instead of copying full logs or the conversation. Remove secrets and unrelated personal information. The main agent reads additional evidence when needed to evaluate a claim; a concise conclusion alone cannot establish Verified coverage. It routes candidate findings to the responsible Assess owner under [finding handoff](finding-packets.md#hand-off-for-assessment-and-reconciliation). Usage workers continue their assigned slices and return requested contrasts through the coordinator rather than creating further workers.

For an interrupted slice, add its last completed action, current state, and next action. Preserve enough evidence to resume without relying on a temporary path scheduled for deletion. Keep the unfinished work pending rather than marking it Verified to free a worker slot.

## Continue, Transfer, or Retire

At a slice boundary, check the coverage evidence and choose the next bounded assignment using the main workflow’s execution criteria. Retain the owner when continuing related state or investigation; return newly discovered independent outcomes to the coordinator for classification under the [outcome scope](../SKILL.md#establish-the-outcome-scope) before assigning further work. Keep ready assessment and eligible reconciliation from being indefinitely displaced by usage. Retaining context does not reserve all available capacity; preserve the evidence needed to resume if an owner must be retired.

If work becomes coupled after dispatch, stop conflicting actions and preserve the last completed action, evidence, live state, pending work, and resource ownership. Serialize work when only resource access conflicts. When progress instead depends on repeated shared interpretation, consolidate the investigation under the existing executor best placed to continue, including the main agent when appropriate. Confirm that the previous executor has stopped affected actions before the new owner uses its resources. Keep completed coverage and findings distinct through the transfer.

Retire a worker when its assignment is finished and continuity no longer serves pending work, or when capacity requires it. Accept its evidence and account for its resources first. Assign ready independent work without waiting solely to form a batch. Close the worker when the host supports it; otherwise mark it retired. Retiring an agent does not stop its processes; transfer or clean those resources explicitly.

On a user pause or stop, stop direct usage, dispatching, and active workers promptly. Collect available evidence and account for resources, then follow the audit’s cleanup and Partial Audit rules. Missing worker output limits coverage; it does not justify continuing product use after the stop.
