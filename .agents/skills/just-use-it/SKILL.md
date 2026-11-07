---
name: just-use-it
description: Experience a source-accessible library or developer tool through outcome-oriented slices before reading its implementation, and report honest coverage and observable findings without repairing or publishing them.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.07"
---

# Just Use It

Use first. Read source last.

Run a **Usage-First Audit** of one source-accessible library, framework, CLI, or developer tool. Exercise its **Capability Surface** through the interfaces a user receives, then inspect the source to find public capabilities and relevant runnable repository environments the hands-on passes missed.

The audit owns experience, coverage evidence, Finding Packets, and coverage persistence. Every actual usage audit retains its version-bound scope and results, including successful runs without findings, partial work, and blocked attempts. Use [assess-findings](../assess-findings/SKILL.md) for evidence qualification and action recommendations, including bounded investigation when a missing fact could change the recommendation. Install it with its `investigate-with-evidence` dependency. If either is unavailable, continue feasible usage and preserve unassessed packets with the missing dependency; assessment remains pending. Product repair and tracker writes require separate authorization. A co-active `$yak-shaving-triage` coordinates finding identity, capture and tracker reconciliation under configured authority. Just remains accountable for saved coverage, with one coordinator integrating shared writes whether Yak is active or not. Formal tracker publication remains separate.

Work **slice-first**. Each execution agent completes one user-outcome **Capability Journey**, its Discriminating Variation, and the applicable exploration within its assigned Capability Group. Independent slices may run concurrently through the delegated workflow below. Opening an entry point or container verifies only that entry point; it does not verify the capabilities inside it.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Frame and Isolate

Identify the target, its intended user, its user-facing documentation, and the environment needed to exercise it. Infer these from the request and workspace; ask only when more than one materially different target remains.

### Establish the outcome scope

At entry, resolve the configured records destination, save authority and target repository through the [record contract](../assess-findings/references/working-records.md). Read [coverage records](../assess-findings/references/coverage-records.md) before selecting routes or creating the batch. Reuse known settings; a missing destination or permission leaves persistence pending while independent usage can proceed.

Under the established history gates, read the project's coverage index and relevant batch evidence before choosing routes. Compare actual execution identity and prior depth to select new use, deeper coverage or affected revalidation. When old reports exist without an index, reconstruct only relevant historical coverage with its original identities and limits; this is record import, not fresh execution. For explicitly independent experience, defer result-bearing indexes as well as finding history, save provisional observations, and reconcile them after the gate opens.

Use the user's explicit scope. On continuation, recover the selected batch and its progress before choosing further work. For an ordinary use request, select a finite batch of substantial Capability Groups organized by project structure or function, each containing user-outcome journeys. Use the primary workflows, recorded depth, uncovered areas and relevant findings to choose multiple groups when meaningful work is available. Announce the batch, necessary dependencies and deferred independent outcomes. Choose a useful batch rather than a fixed count or artificially split groups. An explicit full-surface audit retains full-surface scope; a narrower request retains its own boundary, including co-use with Explore.

Carry the batch through documentation, usage, source reconciliation and assessment. Include new checks that can change its conclusions, explain a blocker or invalidate its evidence. Record independently useful new outcomes in the future backlog. A shared component alone does not justify expansion or revisiting verified work. Completion describes the declared batch; retain the wider coverage map without claiming the whole product is complete.

A user-directed scope change retains earlier coverage and source/tracker exposure. Finding an attractive idea or a difficult block does not silently shrink the batch.

### Establish the artifact and entry phase

At entry or resumption, resolve the selected target through [evidence freshness and target selection](../assess-findings/references/working-records.md#qualify-evidence-on-entry). For an explicitly selected installed instance, release or artifact digest, establish that identity directly. For a source target, use its documented build rather than an unrelated installed release.

Before starting a slice, use launch and build metadata to establish which artifact will execute and its correspondence to the selected target. Include the delegated engine when it owns the outcome; a fresh wrapper alone is insufficient. Keep behavioral source closed under the current audit phase.

If launch or build fails, a prerequisite is missing, or artifact correspondence is unknown, read [target recovery](references/prerequisites.md). Make recovery the next task before installation or further usage of that target. Resume its journeys once recovery establishes a runnable target and its identity. Continue independent slices whose own targets are ready.

Use pending outcomes, changed behavior and related evidence to prioritize actual usage, leaving space for new observations. An old Verified result is evidence about its recorded artifact, not the current version. A fresh audit without continuation context starts from public user tasks. When the user requests independent experience, defer historical finding bodies, summaries and tracker research until the audit gate; configuration lookup alone need not expose findings. If history is already known, disclose that limit rather than claiming fresh independence. These choices change provenance and route order, not the declared outcome scope.

Establish the entry phase before planning the passes. For a continuation or known-issue revalidation, recover the existing coverage, evidence provenance, assessment owner, and source/tracker access state. Carry open gates forward and refresh only evidence material to the requested scope; share that state with usage, Assess, and Yak workers. New workers and temporary projects inherit this provenance. The phase-opening steps below apply while their gates remain closed; already-open source investigation and reconciliation may proceed alongside remaining usage. Actual public use still supplies behavior evidence.

For an initial source-blind audit, keep behavioral implementation source and the target project's issue tracker closed during the first two passes. Follow repository instructions and read public documentation plus entrypoint metadata needed to launch the tool. If the documented launch path fails, preserve that result before using operational metadata to make the target runnable; implementation remains closed until the source pass.

Source-closed means behaviorally blind, not safety-blind. Inspect the minimum install hooks, launch scripts, permissions, and external effects needed to decide whether execution is safe, without using them to infer product behavior. If safe execution requires broader source inspection, disclose that the blind sequence cannot be preserved rather than claiming a Usage-First Audit followed it.

For CLI, public API, or package use, read [references/programmatic-experience.md](references/programmatic-experience.md) before consumer setup, installation, or first invocation, including help and version probes.

For journeys whose judgment depends on automatically selected project, workspace, or configuration sources, or on workload size or processing scope, read [context and workload checks](references/exploration-lenses.md#realistic-scale-and-degraded-surroundings) before execution.

Before costly execution or uncertain workload, read [resource control](references/resource-control.md). Apply its aggregate budget across direct work, workers and descendants; filesystem isolation does not bound memory.

Prefer disposable state:

- When the user explicitly opened a browser or tab and asked to use it, select that existing session before creating another.
- Keep the target checkout's tracked files unchanged. Use an existing safe running instance, a disposable copy or worktree, or a consumer workspace outside the target as appropriate.
- Record every temporary path, process, server, and browser context created by the audit so the exact resources can be cleaned on completion, failure, or interruption.
- Keep external effects inside disposable projects, test data, or sandboxes. Preserve every existing authorization checkpoint; mark a capability Blocked when it cannot be exercised safely.

**Complete when:** the records destination and persistence state, outcome scope and exclusions, historical reuse or revalidation basis, target and runtime correspondence or uncertainty, public starting material, entry phase and inherited gates, isolation and cleanup targets, and prerequisite decisions are explicit.

## 2. Map the Documented Surface

For an initial audit, build the Capability Surface from public documentation without reading behavioral implementation source and give every in-scope documented capability the state `Not Exercised`; retain known out-of-scope capabilities as exclusions under the outcome scope. For a continuation, update the existing Coverage Ledger for the requested scope and evidence that needs refreshing.

Organize Capability Groups by project structure or function. Within each group, follow complete user-outcome journeys across required component boundaries. Order the selected groups by the product's primary tasks and relevant recorded coverage. Initialize a uniquely addressable batch record and compact **Coverage Ledger** with each known Capability Group, its intended outcome, interfaces and modes, current state, and next action. Bind observations to the actual execution identity; common identity fields may live in the batch header. Planned work remains Not Exercised. Keep known out-of-batch gaps visible without claiming the map is exhaustive.

While the initial gates remain closed, keep implementation source and the target issue tracker closed. Source-closed means behaviorally blind: public documentation and the entrypoint metadata needed for safe launch remain available.

**Complete when:** every in-scope capability belongs to a user-outcome group, its retained or pending coverage is explicit, and the next Vertical Capability Slice is identified.

## 3. Complete Vertical Slices

Before each slice, choose its executor by whether it can make independent progress with bounded context, whether its resource state can be controlled, and whether delegation's benefit justifies the handoff and integration cost. Keep tightly coupled investigation with the current owner; use a fresh worker when an independent assignment benefits from a separate context. When the boundary is unclear, continue with the current owner until it becomes clear. Read [execution coordination](references/delegated-usage.md) before assigning work, running slices concurrently, or changing ownership. Main-agent execution follows the same journeys and evidence requirements.

An assigned worker follows this skill within its slice; it does not restart the whole audit or delegate again. During the initial source-blind pass, keep implementation source and the target issue tracker closed across all agents. Later assignments retain the audit's established source/tracker phase and provenance rather than restarting the blind sequence. For each assigned Capability Group:

When the group uses an interactive UI, read [references/ui-experience.md](references/ui-experience.md) before controlling it. Follow its **UI Journey Gate** when assigning coverage states to the slice; that reference defines the required observations and the exclusion and `Blocked` paths.

1. Follow its documented Capability Journey exactly through the public interface until it produces an observable user result.
2. Exercise one Discriminating Variation that changes a single input, state, mode, or recovery condition and should produce an observably different result. Record an explicit exclusion when the capability has no material variation.
3. Read [references/exploration-lenses.md](references/exploration-lenses.md), then explore freely inside the active Capability Group. Build a small capability-shaped matrix. Finish the group when its target outcomes and material variations have evidence and its findings have supported judgments. If a judgment needs a later source or assessment phase, hand off its evidence and next check while keeping the group open. Continue feasible work; an unavailable required check follows the stopping conditions below. Finding a bug or finding none is not a completion criterion; a full root cause is needed only when it changes classification, remedy, ownership or scope.
4. Add newly discoverable public capabilities to the Capability Surface. Keep capabilities serving the active outcome in the current slice; classify independently useful outcomes under the [outcome scope](#establish-the-outcome-scope), adding in-scope ones as new `Not Exercised` groups and recording the rest as exclusions.
5. Before assigning the first `Verified` state, read [references/verification-traces.md](references/verification-traces.md). A capability becomes `Verified` only with a complete Verification Trace. As soon as behavior may be a finding, read [references/finding-packets.md](references/finding-packets.md), preserve its evidence, and route it through the coordinator for early assessment. Continue usage while the assessor reviews the packet under the current source/tracker phase.
6. Record each capability state and its target-bound evidence; a delegated executor returns it to the main agent. `Verified` and `Finding` require an exercised target journey. `Observed` records exercised behavior with assessment still pending. `Blocked` records an unmet prerequisite, not a completed journey; `Not Exercised` records other unfinished usage. The main agent checks the evidence, updates the Coverage Ledger and continues the next action for every unresolved outcome. A worker handoff or completed attempt does not complete the user outcome.

At each completed group or material partial checkpoint, follow the [coverage save checkpoint](../assess-findings/references/coverage-records.md#save-and-verify-the-checkpoint): save the batch evidence, integrate permitted index updates, and check the saved result or name the exact pending work. Apply this checkpoint to successful coverage as well as findings. Under a closed independent history gate, save the provisional batch and leave index reconciliation gate-pending.

After the checkpoint, continue to the next selected group under existing authorization. Use slice boundaries for progress updates. Continue other feasible work when one capability is Blocked; a Partial Audit describes incomplete coverage rather than a reason to end the task. Continue authorized recovery and decisive checks while they can resolve an in-scope question. End an incomplete audit only at the user's stop or scope change, or a concrete access, resource or decision barrier that prevents further meaningful progress. Follow the prerequisite workflow before declaring that barrier. Return the specific action needed to unblock it, with completed preparation and its result; preserving evidence does not discharge the remaining work.

On pause or interruption, preserve the current slice, remaining coverage and resumption conditions. Keep the current source/tracker gates unchanged. If the interruption concludes the run with unresolved in-scope outcomes, freeze completed Finding Packets and report a Partial Audit. A separately active recording workflow may reconcile those packets; subsequent audit work, including a later resume, inherits any resulting tracker exposure.

A documentation error is a Finding even when the implementation works through an undocumented correction. Do not use operational metadata or source knowledge to silently rescue a documented journey.

**Complete when:** every in-scope capability discoverable without source has an exercised journey on the selected target, every materially applicable exploration lens has an exercised path or explicit exclusion, every `Verified` capability has a Verification Trace, each selected group meets the depth criterion above; and each completed group has a checked saved checkpoint or exact pending work with its reason and resumption condition, including gate-pending index reconciliation. Independent future groups remain outside this completion claim.

## 4. Reconcile with Source

When implementation source is still closed, open it after the feasible public journeys and variations have been exercised and their evidence accounted for. A remaining genuine blocker can permit this phase transition when source inspection can explain it or advance other selected outcomes; record the blocked journey and preserve its unfinished status. Moving to source reconciliation does not declare usage or the audit complete. Announce that transition to assessment workers; tracker history stays closed until its own gate opens. Match source to the experienced artifact where possible and qualify leads from other revisions until exercised on their own artifacts.

Inspect public exports, routes, commands, flags, feature registration, examples, and tests relevant to the outcome scope and its necessary dependencies for shipped public capabilities missing from coverage. Classify newly found independent outcomes under the same scope boundary. Treat shipped exports, executables, routes, or browser globals as public unless marked internal, test-only, or unreleased; a hidden help entry alone does not establish privacy. Report unresolved public intent explicitly.

Read [references/repository-environments.md](references/repository-environments.md) to discover runnable repository environments that expose additional capability journeys, component states, or integrations. These environments can provide useful experience without themselves being end-user releases. Keep their evidence scope distinct from the product paths they represent.

Map source-discovered capabilities and relevant environments to existing coverage, a justified exclusion, or newly assigned usage. Choose executors for new slices under the same execution criteria and record their source-discovered provenance. Source inspection supplies leads; actual execution supplies usage evidence. When findings or source evidence expose a limit in earlier coverage, [revisit related coverage](references/finding-packets.md#revisit-related-coverage). Assessment workers may now investigate source-dependent questions within their assigned recommendation scope while independent usage continues.

Record source-discovered outcomes and environments with their provenance, observed coverage and remaining gaps. Source leads and applicability judgments remain distinct from executed observations. After every in-scope source-confirmed public entrypoint and relevant environment is accounted for through usage or explicit exclusion, freeze the independently observed packets and open the Audit Reconciliation Gate. Reconcile any provisional coverage with permitted history and the project index at this boundary. A co-active recording workflow can reconcile the batch and return evidence to the assigned assessor. Without Yak, the assessor may perform the bounded read-only tracker check allowed by its method. Reading tracker history marks subsequent work tracker-informed; a new worker does not restore blind provenance.

Public issue history may also be sampled after the gate as a final coverage calibration. Re-exercise relevant public paths; behavior first encountered there is a known-issue reproduction rather than independent discovery.

**Complete when:** source-discovered coverage is accounted for through target execution or justified scope exclusion, and packet provenance and reconciliation eligibility are explicit. Assessment can proceed after this phase transition; pending assessment still prevents overall completion. For an incomplete audit, retain the unresolved work under the stopping conditions above rather than claiming this phase complete.

## 5. Report and Clean Up

Collect assessment results before the final report using [finding handoff](references/finding-packets.md#hand-off-for-assessment-and-reconciliation). Return a conversational audit report containing:

- the intended target, the artifact or instance actually exercised, and the environment;
- the declared outcome scope, its exclusions, and the Coverage Ledger with each in-scope capability state;
- a compact Verification Trace for every `Verified` capability;
- assessed findings, improvement opportunities, unresolved observations, and excluded claims with their evidence and distinct action recommendations;
- Blocked and, for a partial run, Not Exercised capabilities;
- tracker links or identifiers returned by a separately active recording workflow for Reused records or successfully published mutations; and
- cleanup results.

Report completion only when the declared target journeys and their decision-relevant assessments are resolved by applicable evidence. If target correspondence, usage or a material judgment remains unresolved, continue the work under the stopping conditions above. When those conditions require ending the run, report a **Partial Audit**: name the answered outcomes, unfinished questions and concrete unblocking action. Counts of commands, terminal statuses, saved records and disclosed uncertainty do not establish completion. Keep justified scope exclusions visible; only a full-surface audit can claim whole-product coverage.

Keep the final reply conversational; the required coverage record is separate from its presentation. For completed runs, no-finding runs and pauses, follow the [coverage checkpoint](../assess-findings/references/coverage-records.md#save-and-verify-the-checkpoint), including its history-gate branches, saved-state readback and handoff links. Report usage, assessment, persistence and cleanup outcomes separately, naming any pending work. Saving coverage remains Just's responsibility; tracker publication requires separate authorization.

When Explore is co-active, return the completed usage scope, evidence, limits and remaining relevant questions to its discovery decision. Explore owns whether discovery continues or closes; a completed usage batch establishes only its recorded usage coverage. Keep the two coverage accounts independent and link reusable evidence. Further usage retains the established source and tracker exposure.

Before ending the audit, stop or retire all audit workers and collect their resource states. Before deleting disposable state, preserve required inputs and results in the authorized records. If persistence is blocked, preserve recoverable pending evidence within existing authority and report its location and retention needs; a chat summary alone does not replace irreplaceable inputs. Retain the coverage depth and next actions under the shared record contract, including partial or resource-interrupted progress. Then remove only the exact temporary paths and stop only the processes, servers, tabs, or browser contexts created for this audit. Preserve user-owned browser state. Report every cleanup failure with the residual path or running resource.

**Complete when:** the report matches actual coverage; batch evidence, project index and navigation have passed the saved-state check or have an exact persistence blocker; every packet has an assessment or named limitation; and disposable resources are cleaned or reported. Completed usage does not imply completed persistence.
