---
name: investigate-with-evidence
description: Resolve a bounded factual question through matching sources and, when needed, controlled execution. Use when expansion or claim challenges need evidence, or when the user asks to investigate a concrete fact.
metadata:
  author: sakana
  version: "2026.11.07"
---

# Investigate with Evidence

Resolve the factual uncertainty that could change the current judgment. This is the shared investigation method for `expand-the-frame` and `challenge-the-claim`, and can also answer a direct factual investigation request. The consuming task owns the question, scope, and decision; this skill supplies evidence and its limits. A request to investigate permits bounded, reversible local checks within existing permissions, not product implementation or external publication.

Return evidence to the consuming task. General factual inquiries can finish in the conversation. Before creating a persistent Working Record, apply [record eligibility](../assess-findings/references/working-records.md#establish-record-eligibility); using this investigation method does not itself start a recording workflow.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## Establish the question

Identify the fact to determine, its relevant conditions and version, and what different answers would change. Reuse evidence already obtained when its source, conditions, and freshness still fit. For inherited Working Records, use their [identity and freshness rules](../assess-findings/references/working-records.md#qualify-evidence-on-entry), carrying unresolved source correspondence and relationships into the answer. An adjacent issue becomes a separate direction for the consuming task rather than silently replacing the question.

For a claim about an existing system, identify the relevant entry point or documented contract. Choose the smallest sufficient check below; trace consumers, implementation, and tests when actual execution paths, ownership, or integration behavior could change the answer. For a proposal or unrealized idea, distinguish requirements and assumptions from demonstrated behavior. Match documentation and source to the version under discussion. Resolve accessible facts yourself; ask the user only for unavailable context or user-owned requirements that change what counts as relevant evidence.

For questions about removed or changed capabilities, read [trace a capability change](references/capability-changes.md). Use that route to establish the old effect and its current equivalent before proposing a migration.

## Choose a discriminating check

When a conclusion depends on whether a test can detect a specific wrong behavior, use [test effectiveness](references/test-effectiveness.md). Reuse adequate existing regression evidence; this is a targeted investigation, not a required phase for every test.

Use the smallest check that can settle the uncertainty: primary documentation, source inspection, an existing test, a minimal reproduction, actual UI use, or a controlled measurement. Neither reading code nor executing it is universally sufficient. Runtime ordering, integration behavior, and performance claims may need execution when source alone leaves a material uncertainty.

Before an experiment, state the uncertainty and which possible results would support, contradict, or leave the judgment unresolved. Inspect the relevant code and command effects before running them. Use disposable workspaces or fixtures for generated code and state; preserve the user's working tree and shared environments. Product edits, persistent external changes, deployments, and substantial resource use remain subject to their own authorization. If a decisive check is unavailable or outside scope, preserve the exact unresolved fact and the check that would settle it.

When reconstructing an experiment in a copied or archived workspace, resolve the source location and revision separately from the execution directory. Use the existing setup guidance and chosen entry point to check that required files and dependencies are present and runtime output locations are writable before starting the comparison. Limit this check to that experiment. Reuse prior setup checks when the source revision, entry-point requirements, and execution conditions have no changes relevant to those checks.

Keep the causal mechanism being tested intact. Record substitutions such as mocks, simulated transports, simplified inputs, or a proposed implementation of an underspecified idea. A fixture that assumes the disputed behavior cannot establish that behavior in the real system. A failed prototype constrains that implementation; it does not by itself disprove every implementation of the proposal. A passing run supports the conditions exercised, not all environments or schedules. A resource cutoff establishes an interrupted check. Distinguish setup, permission, and resource limits from product behavior; attribute a failure to the product only when evidence supports that connection. Choose comparisons and repetitions to answer a concrete remaining uncertainty rather than merely accumulating runs.

## Return the supported result

Connect the finding to the original question. Distinguish observed execution, source-supported behavior, inference, and hypothetical scenarios. Give inspectable evidence: the relevant source location or documentation, or the executed check with inputs, conditions, and observed result. Existing test code is evidence of intended coverage; call it a passing test only when a run or trustworthy recorded result supports that statement.

State what the evidence determines, what it leaves unresolved, and whether it changes a premise, the conclusion, or only its scope. Factual consequences can inform a trade-off but do not choose the user's priorities. Keep a description mismatch, an implementation defect, and missing evidence distinct when assessing a proposal.

Stop when the decisive paths and concrete counterevidence leads have been checked and no specific unresolved check could materially change the answer. Missing access to a decisive fact produces an unresolved result, not a negative finding or a reason for unbounded speculation. Reopen only for new evidence, changed conditions, or a revised question. Clean up disposable processes and resources; report retained evidence and any cleanup limitation. Return control to the consuming task without starting repair or another investigation.
