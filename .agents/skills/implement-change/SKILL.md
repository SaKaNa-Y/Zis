---
name: implement-change
description: Implement an agreed change from findings, a spec, tickets or a concrete request; verify the result, prepare a draft PR and update authorized working records. Use only when the user explicitly selects this skill.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.07"
---

# Implement Change

Use this skill only when the user explicitly selects it by name. A request to implement, verify or deliver a change does not activate it by itself. Once selected, keep it active for the same implementation task and its direct follow-ups. A separate task requires a new explicit selection.

Deliver the selected outcome through code, evidence and a Draft PR, with progress written back to existing authorized Working Records. Honor a narrower requested endpoint such as local changes or a commit. Merging PRs, deploying and releasing are outside this workflow.

Use Assess Findings and its Investigate with Evidence dependency for shared records and decision-changing factual gaps. Reuse an existing assessment; implementing an agreed request does not require running discovery first. Read the [working-record contract](../assess-findings/references/working-records.md) when source records or configured history exist and [coordination](../assess-findings/references/coordination.md) before assigning work. If a dependency is unavailable, report the missing method and continue only work whose scope and evidence remain supported; do not claim its checks occurred.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Recover the agreement and current work

Read applicable repository instructions, the requested record/issue/spec and relevant decisions. Inspect current code, worktree changes and related PR state. Reuse sufficient prior research, checking its revision and material assumptions. The Implementation Agreement states the selected outcome, scope, preserved behavior, observable acceptance and remaining decisions. A small fix may need only its reproduction, expected result and regression boundary; link a larger spec rather than copying it.

Before editing, apply [evidence freshness and target selection](../assess-findings/references/working-records.md#qualify-evidence-on-entry), including for direct repair requests without a Working Record. For prior findings, restore the scenario, impact, acceptance, related evidence and uncertainty, rejected explanations and existing work. State which evidence remains usable, what needs refresh and what this repair will validate. Load related records by demonstrated relevance rather than copying the entire history.

Before editing, use the proposed mechanism to identify affected behavior. When changing a shared transformation, comparator, cache or derived state, trace how relevant inputs are created, transformed, updated and consumed again. Use those paths to identify preservation conditions and discriminating checks in the existing agreement. Stop at the paths needed to establish the change's impact; a local wording edit needs only proportionate inspection.

Investigate factual gaps. Ask the user only about unresolved behavior or scope decisions that block correct implementation. A positive Assess recommendation alone is not authorization to select new product behavior. A direct, sufficiently clear implementation request can supply the agreement without a Working Record or a new spec.

Check relevant claims, branches, commits and PRs before starting duplicate work. If a matching PR already exists, reconcile its coverage and continue the authorized work there when appropriate. Distinguish others' related work from this task's deliverables. Keep unavailable remote evidence explicit.

**Ready when:** the outcome, affected behavior and checks are actionable, current work is accounted for, and material unresolved decisions are named rather than silently chosen.

## 2. Claim and plan proportionately

For recorded work, save the owner, execution location/branch, last known progress and next action under existing record authority. Reread before writing the claim. If another owner is active or its state is uncertain, resolve continuation, collaboration or handoff before overlapping edits. Age alone does not release ownership. Inspect available task/process/branch state; ask for direction only when the conflict cannot be resolved from evidence and existing authority. Claims are advisory, not a distributed lock.

For an interrupted task, recover the last action, evidence, pending checks and owned resources; confirm the former executor stopped affected actions before transfer. If a side-effecting request has no reliable result, use [external-action recovery](references/external-action-recovery.md) before repeating it, including when the current session continues after a timeout. Preserve unrelated user changes. Use an isolated checkout when needed for parallel writable work, following repository and host rules; do not reset or clean an existing checkout to obtain isolation.

Keep small or tightly coupled changes with one executor. For larger work, split by independently demonstrable results and genuine dependency edges, not simply by file or technical layer. A broad migration may need expand, migrate and contract stages. Dispatch only ready work and also check shared-file, interface, environment and service conflicts: absence of a graph edge does not prove safe concurrency.

Before expanding parallel implementation, account for contributions awaiting integration, review or verification and who will resolve them. If returns accumulate faster than those checks can finish, prioritize that pending work and reduce new dispatch until verification can keep pace. Keep unaffected work moving. Apply this to actual coordination pressure; small tasks need no separate queue or fixed worker quota.

Read [roles and handoffs](references/roles.md) when delegating or integrating multiple contributions. Retain scope, shared-record writing and final delivery under one coordinator. No fixed team size is required.

**Ready when:** ownership is clear and each active unit has an outcome, allowed changes, dependencies, acceptance and an executor; blocked units have a next condition.

## 3. Implement and integrate

Follow the repository's design and validation conventions. When deciding whether a change needs new or updated tests, use the shared [test-value method](../investigate-with-evidence/references/test-value.md). For a new capability, check the agreed outcome and preservation conditions. Low-impact wording edits need proportionate checks, not artificial tests.

Before reusing a build or validation entry point, identify the executable that will run and its startup or persistent write effects. When those effects are uncertain, use the [investigation setup method](../investigate-with-evidence/SKILL.md#choose-a-discriminating-check). Wait for the build that produces a required artifact before running it; independent work can continue. A separate checkout does not isolate shared build outputs or user-level installation state.

Workers return changes, inspected code state, actual checks, new evidence and remaining limits. Integrate dependency-ready contributions while preserving unrelated work. Resolve conflicts against the agreement, then validate the integrated state. If new evidence changes a shared assumption, update the record and affected owners before they continue dependent work.

When the repair changes mechanism or intervention layer, revisit the affected paths and preservation checks before relying on the earlier validation plan.

Handle in-scope defects discovered during implementation. Preserve independently actionable side findings through co-active Yak or the authorized working-record method without silently adding their repair to the task. A deeper cause can change the proposed repair unit; keep separate acceptance boundaries and return genuinely new product scope to the user.

**Complete when:** the agreed implementation is integrated, affected assumptions are reconciled, and remaining limitations or blockers are explicit.

## 4. Review and verify the actual result

Keep three questions distinct: does the change implement the agreement, does it follow repository standards, and does the behavior work under the tested conditions? Use [Review Change](../review-change/SKILL.md) when available for the Standards and Spec review of the selected change. Give it the agreement, examined state and relevant guidance; it returns evidence and findings for this workflow to handle. It does not replace execution. If unavailable, perform proportionate review inline and state that the shared method did not run. Activate explicit-only alternatives only when the user selects them.

When repairing runnable commands or configuration examples, use the [documentation verification example](references/documentation-verification.md) to check the edited document from its stated starting conditions.

Choose independent review or verification when complexity, risk or hidden author assumptions justify it and delegation is available. Give a verifier the acceptance conditions, delivered artifacts, setup and safety constraints, not a preferred verdict. Inline checks remain valid where proportionate but are not labeled independent.

Record each meaningful review finding's disposition: repair a supported in-scope issue, explain evidence against an unsupported claim, or return a scope-changing choice to the user. Recheck affected behavior after repairs or integration changes. Bind evidence to the examined code state and environment; an earlier worker branch passing does not establish that the final integrated result passed. Missing execution access remains an explicit verification limit.

For follow-up reviews, use [Review Change's revision method](../review-change/SKILL.md#5-review-a-revision) when available. Otherwise, review inline: retain finding dispositions and examined revisions, recheck changed or affected behavior and unresolved findings, and widen for risk or new evidence. If inline review rounds add little evidence or undo earlier fixes, resolve the cause before continuing. In either path, the implementation owner handles findings and scope decisions; completing a review pass does not mean its findings are fixed.

**Complete when:** material findings are resolved or explicitly pending, and the final change has proportionate evidence for its acceptance and preserved behavior without claiming unrun checks.

## 5. Deliver and write back

Inspect the final diff, repository commit/PR conventions, target branch and existing PR before publishing. Prepare an accurate description of the scenario, trigger, impact, change value, evidence and limits. Include an issue or PR reference when it directly concerns this problem, is a necessary dependency, or explains correctness or compatibility relevant to review. Retain useful adjacent work and excluded matches in authorized Working Records; each published reference should have a clear role in assessing this change. Preserve that scenario account when producing a shorter author explanation; describe supported use without inventing personal experience. Under the user's implementation request and applicable authorization, commit and create a Draft PR, or update the matching PR without creating a duplicate. Preserve an existing PR's draft/ready state unless a change is authorized. Attach the PR to the current task when the host requires it. Never merge it as part of this skill.

Write the actual PR link, provenance, coverage, checked state/date, final-state verification evidence, changed relationships or affected conclusions, and remaining work to each affected existing Working Record under its recording authority. Changes to a formal issue or spec follow that source's own authorization; a direct implementation request does not require creating a Working Record. Update claims and next actions: waiting for review is not resolved acceptance. Complete authorized record commits under the shared contract; code commits and record commits belong to their respective repositories. Keep publishing and local writeback as separate outcomes. A failed writeback does not undo a successful publish. When the external result is uncertain, use [external-action recovery](references/external-action-recovery.md) to reconcile it before retrying; retain the specific pending action and its evidence.

Clean or transfer only task-owned resources, preserving required evidence and unfinished work. Return the actual delivery link or local result, relevant verification, record paths and any blockers. Do not mark the change fully delivered while a required PR or record update remains pending.
