---
name: assess-findings
description: Assess Findings, Improvements and Explorations, preserve evidence and decisions, and recommend scoped next actions. Use for Just, Yak or Explore handoffs, reassessing a specified records folder, and decisions about a fix, improvement or PR.
metadata:
  author: sakana
  version: "2026.11.07"
---

# Assess Findings

Turn an observed finding into a supported judgment and a useful next-action recommendation. Assess the finding's basis separately from the value of a proposed response. A worthwhile optional improvement can justify a PR without being necessary; reproducibility alone establishes behavior, not a defect.

Use [investigate-with-evidence](../investigate-with-evidence/SKILL.md) for factual uncertainties that could change the judgment. Install both skills together. This workflow authorizes analysis and bounded investigation within the consuming task's permissions; repair and publication remain separate actions.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Establish the assessment and its owner

Keep one accountable assessment owner for a bounded set of related findings or opportunities. The coordinator may assess directly or delegate under [coordination](references/coordination.md); reuse that owner and existing judgments across Just, Yak and Explore. Investigations return through the coordinator rather than recursively creating teams. Missing investigation support leaves only the dependent judgment pending.

Use an independent assessment when the user requests it or a concrete judgment risk warrants it: an evaluator would be checking its own selected remedy, material counterevidence remains unexplained, or competing interpretations would change classification or response scope. Name the judgment to recheck and follow [independent assessment inputs](references/coordination.md#independent-assessment-inputs). Ordinary evidence updates stay with the existing owner. Treat supplied labels, diagnoses and remedies as claims to examine against their evidence, not established premises.

Before persistent capture, apply [record eligibility](references/working-records.md#establish-record-eligibility). An assessment can remain in the conversation when no persistent capture is requested or required. For eligible persistent work, reuse the current primary record across workflows, keep observations before final judgment, and preserve its user decisions. Establish missing destination or save authority while continuing permitted analysis; retain unsaved evidence explicitly.

For a request to reassess a records folder or collection, read the [batch assessment procedure](references/working-records.md#reassess-a-records-folder) before selecting checks. A request to arrange fixes or commits also requires the [scope check](#establish-the-affected-scope) and [identity decision](#decide-problem-identities) before choosing delivery groups. Use this same assessment workflow for each distinct problem and its relationships, in the current conversation or a later one. A batch request does not require a separate skill or defer an individually ready finding.

Identify the scenario, affected version and environment, inspectable evidence, expectation basis, demonstrated or proposed value, current response goal, material unknowns and source/history permissions. For an opportunity, a concrete desired outcome takes the place of a claimed behavioral failure.

Keep a concise scenario account through assessment and handoff: user task, trigger, actual behavior and impact, and the value of a response. A supported realistic scenario suffices without a named affected user; label inferred consequences and preserve uncertainty. Repository maintenance can have a concrete maintainer scenario. When shortening an explanation, retain this causal account and avoid inventing the author's experience.

A packet may initially lack some of these facts. Preserve the gaps instead of filling them with inferred certainty. Related observations share an assessment when the same response and acceptance boundary resolve them; independently valuable responses remain distinguishable.

For a batch, resumed work, or several evidence handoffs, turn the original questions and accepted scope into a compact worklist before selecting checks. For each recorded observation, link its original scenario and acceptance boundary, applicable evidence, decision-changing gap, and next executable action or actual limitation. Keep existing identity links as starting claims to check, not fixed units for the recommendation. Reuse record fields and adequate prior evidence. A straightforward single finding can keep this account inline. The worklist guides this task; primary records remain authoritative. At interruption, retain it with the existing checkpoint and reconcile it with current records on resumption. A correction may change the question or identity; preserve the mapping and reason.

When assessing a PR for delivery, use the project’s records and linked audits, where available, to recover its origin, accepted outcomes and prior grouping decisions. Follow concrete leads to other records or PRs that could share the repair. Apply the [identity and grouping method](#decide-problem-identities) to those candidates.

Use [scope comparison](references/scope-comparison.md) for that PR assessment or any comparison with earlier proposals or requirements. Apply it to findings uncovered during review before recommending what belongs in the PR. Follow the active evidence gates and limit retrieval to the question asked.

Proceed when each selected question has applicable evidence or a next action, and scope and permissions are explicit. A follow-up changes only the dimensions it addresses; carry forward the other accepted decisions.

## 2. Respect the evidence phase

Early handoff allows feedback while usage continues. Under a Just audit, assess supplied evidence first and request discriminating public-use comparisons from usage workers. Implementation source remains closed until the coordinator ends blind usage. Once source access opens, source-supported investigation may proceed while source-discovered environments and capabilities are still being exercised. Target tracker history opens only after that additional usage finishes, or the coordinator explicitly freezes a partial audit and its independent findings. Carry these permissions through every delegated task and resumed assessment.

For standalone work, establish the consuming task's access boundaries directly. Obtain missing phase permission from the coordinator rather than assuming that assignment to Assess opens source or tracker history. Mark judgments awaiting a gate as provisional, continue permitted work, and revisit them when the gate opens.

When Yak is co-active, it owns tracker reconciliation and returns its evidence through the coordinator; Assess requests missing decision evidence from that owner without invoking Yak recursively. Otherwise Assess owns the configured read-only search once permitted. Before recommending a contribution route, use [related work and discussion](references/tracker-decisions.md) to check relevant open and closed issues and PRs, their implementation coverage, and the decisions in their discussions. Reuse an adequate returned account instead of repeating the search. Missing decisive tracker evidence limits the contribution recommendation; it does not invalidate independently supported behavior or classification.

Proceed with all currently permitted decisive checks; preserve deferred checks with their reopening condition.

## 3. Judge the finding's basis

Separate what happened from why it matters. Establish the expected outcome from relevant documentation, accepted requirements, consistent product behavior, or the concrete task the interface offers. An implicit contract can be supported by the workflow and a controlled comparison; a written specification is not mandatory. Explain the basis so a reviewer can distinguish it from personal preference.

Trace the affected user path far enough to establish impact. Distinguish observed obstruction or misleading output from possible consequences. A workaround may reduce severity while leaving the original path defective. An isolated component example demonstrates that environment; verify the consumer path when the classification depends on integration. Source anomalies can explain behavior but do not supply missing user impact by themselves.

When a claim depends on a synthetic state, a theoretical edge case, or disputed reachability, trace the supported entry point and check whether the required inputs, configuration and prior state can coexist. Check any constraint offered as an exclusion against the relevant entry points and state sources, including supplied objects, persisted state and later updates. Reuse applicable evidence; send a decision-changing gap through the investigation step below, within the current evidence permissions. A reachability judgment is ready when the evidence establishes a supported path or rules out the claimed path under stated conditions; otherwise retain the specific gap.

For example, validation in the default constructor may leave a supported caller-supplied object unchecked. Check that route before excluding the failure. Conversely, if every relevant supported route enforces the constraint before use and preserves it afterward, a reproduction that bypasses that constraint establishes only the altered environment. Bound exclusions to the checked version and conditions; keep adjacent unknown paths explicit.

Start with the supplied evidence. On each result or handoff, locate the evidence behind the claim and match it to the original question, tested conditions and relevant run or artifact identity. Record what it establishes and which gap remains before revising the judgment. A claim about one execution needs artifacts from that execution; evidence from separate runs can support an explicitly labeled inference. A neighboring symptom gets its own question or relationship, leaving the original acceptance boundary intact.

When new evidence changes a material condition, identify the judgment it affects and the recommendations that depend on it. Carry forward judgments whose conditions still hold. Mark affected judgments for recheck, and withdraw a judgment when evidence defeats it. Keep historical observations tied to their original conditions. Update the existing worklist or inline account with these distinctions.

For example, an earlier release showed a data-isolation defect and the assessment recommended a new upstream PR. A related PR now exists. Preserve the historical observation, check current version and coverage evidence, and reconsider the contribution route. The PR's existence alone changes neither the demonstrated impact nor the suggested priority.

Update the worklist from that result. Reuse evidence that answers the same question under applicable conditions. For a remaining gap, state which possible results would change the judgment, then take the smallest available, authorized discriminating action. Investigate root cause only as far as correctness, remedy, ownership, or scope requires. Return the result through the evidence intake above before choosing another action.

Keep genuinely unavailable evidence with its exact limitation and reopening condition. A queued executable check stays in the worklist until performed or interrupted; it does not become a completed assessment merely by appearing in a recommendation.

Express the supported disposition in ordinary language, optionally using these labels:

- **Confirmed defect:** demonstrated behavior conflicts with a supported expected outcome under the stated conditions.
- **Improvement opportunity:** a concrete user outcome supports a valuable change without an established contract violation.
- **Unresolved observation:** a named missing fact prevents classification or impact judgment.
- **Excluded:** identify the specific problem claim and the evidence that defeats it within the stated scope. Missing documentation, an empty search or an unmatched artifact is not counterevidence by itself.

Before excluding an observation, distinguish an unsupported expectation from use of the wrong interface or artifact. If the agent guessed an entry point, inspect the selected target's public surface and exercise the supported route. If no route exists, establish that absence through applicable interface or source evidence, then judge the unmet user outcome as misuse, a capability gap or an unresolved question. If a material fact remains unknown, continue the available decisive checks; return an unresolved result only with a concrete blocker or user-directed stop. Keep evidence about behavior, cause, and impact distinct.

### Establish the affected scope

Before recommending repair scope or grouping, reuse the established trigger and reachability evidence, and separate the observed failure from its contract and supported mechanism. A title or the first failing entry point does not bound the problem. Within the permitted source scope:

1. Locate the operation that produces the failure. Follow its references outward through callers to the public entry points and affected outputs, across package boundaries where the call path leads. For documentation, include connected public type comments and generated references.
2. For each connected entry point, check the accepted inputs and prior state against the failure conditions. Follow alternative setup paths, including supplied objects or persisted state; the default construction path alone cannot establish an exclusion. Identify the condition that makes each path affected, already correct or still unknown.
3. Keep these paths and evidence in the existing coverage account. Resolve remaining concrete references that could change the scope before declaring the account complete. Finding a second affected caller does not close the remaining paths. Reuse applicable evidence; a successful reproduction or empty text search alone does not establish coverage.

This is a mechanism-led caller and state check, not a repository-wide feature sweep. Similar names or nearby directories alone do not justify expansion. Respect source and history gates; inaccessible or untested paths remain unknown. Local output establishes only that artifact, not a published release.

For an actual repair proposal, record how it addresses each affected behavior or representation: a specific correction, evidence that it is already correct, or an unresolved gap. Check both directions: every required correction maps to a proposed change, and every proposed change serves the agreed outcome, an applicable repository constraint, or an accepted optional improvement. Keep these matches in the existing coverage account and update them when the proposal or evidence changes. A small repair can use a few sentences.

If an unknown surface can change ownership, remedy or grouping, keep that decision pending with the next check and its reopening condition. Otherwise give the bounded recommendation and its limits. Scope is ready when relevant surfaces and material leads are resolved or excluded with evidence.

### Evaluate an opportunity

For an idea, evaluate its concrete user situation, incremental value over the closest working alternative, plausible implementation evidence and meaningful costs. Separate observed demand from hypothesized benefit. Reuse Explore's research and prior-work results; request only decision-changing gaps. Explore owns discovery and user discussion; Assess owns the resulting judgment, not a second discovery campaign. An opportunity need not establish a defect or necessity to be worthwhile.

### Decide problem identities

Use the scope evidence to decide what the problems are before deciding how to submit fixes. For a batch, compare observations across record boundaries as well as within each record. Reuse the worklist; a separate matrix or a root-cause investigation for every pair is unnecessary.

1. Connect each observation's trigger, failed contract or state transition, visible consequence and acceptance condition. Trace downstream consequences back to the failure that produces them. Follow the same contract through the other applicable entry points found in the scope check. This reveals both repeated reports of one failure and missing scope within a single report.
2. Examine candidate matches supported by shared mechanisms, state propagation or overlapping acceptance. Ask what still fails if the suspected shared failure is removed or bypassed. Use applicable evidence first; when the answer could change identity, ownership, scope or grouping, use Investigate for the smallest comparison that distinguishes the alternatives. Check what the comparison changes: a combined correction that changes several behavior conditions cannot by itself establish that the observations are duplicates. Isolate the conditions that distinguish the competing explanations. Do not infer causation from a common file, symptom or proposed patch.
3. Reconcile identities from those results. Multiple symptoms or entry points of the same specific failure share one identity when they need one coherent correction and acceptance boundary. Separate code edits can complete that correction; fixing only one affected entry point is partial coverage, not proof of a separate problem. Distinguish this from independently violated conditions within a shared contract or helper. A shared work item can organize those conditions, but does not establish duplicate observations: preserve their individual failure conditions and acceptance, and justify any identity merger from evidence. Keep independently valuable outcomes separate when satisfying one contract leaves the other unmet. Record supported causal, blocking or masking links between them. An unresolved match stays provisional; it cannot support a definite merger or a claim of independence.
4. Update the primary scope, linked observations and acceptance before proposing delivery groups. Keep an evidence pointer for each material identity decision and explain which observed symptom or entry point it covers. Then decide whether distinct problems benefit from one PR. Preserve each acceptance boundary. When the decision affects submission, save the reason to submit together or separately. Distinguish a PR that delivers an item from a discussion that only mentions it. Notify affected usage or implementation owners when the decision changes their work.

For example, several exporters that ignore the same promised locale can share one problem with acceptance for each exporter, even if their code needs separate edits. An export that fails to open a file can hide a separate encoding error: reaching the encoder successfully and still getting incorrect text distinguishes the two problems.

This step is complete when each observation has an evidence-supported identity or an explicit unresolved match, and each decision-changing scope or relationship lead has a result or a genuine limitation. Report screening separately from verified relationships. A ready independent recommendation can proceed while an unrelated match remains unresolved.

## 4. Recommend a response

Keep reachability, observed occurrence and response value separate: a supported path establishes that a failure can occur, while claims about frequency need their own evidence. Unknown usage frequency leaves the supported behavior intact; judge the response from the affected task, consequences and trade-offs.

Fix the response goal before evaluating a remedy. Connect a proposed change to that goal, its evidence-backed benefit, the responsible consumer or repository, and meaningful costs or existing alternatives. Separate independent goals and remedies: explaining an empty view and correcting a library calculation may each have value without either requiring the other.

When proposed or existing tests affect a repair recommendation or acceptance judgment, use the shared [test-value method](../investigate-with-evidence/references/test-value.md). An assessment without a patch does not require a test-suite audit.

When a dependency boundary affects the remedy, distinguish the evidence-supported defect location from the proposed intervention location. Explain what that intervention resolves and leaves unresolved, including meaningful compatibility or delivery trade-offs. Mark uncertain attribution explicitly; an effective consumer workaround establishes its tested scope, while upstream resolution needs its own evidence.

A positive PR recommendation needs a concrete scenario and goal, a supported defect or reasoned practical improvement value, a plausible change that achieves that goal in the appropriate owner, relevant tracker reconciliation, and no outstanding factual uncertainty that could overturn the recommendation. State reasoned benefits as reasoning when they have not been directly observed. Necessity is a stronger claim than worthwhile improvement; assess it only when the decision requires it. When a finding summary or the requested decision calls for priority, assess it using the method below. Yak requests this assessment by default for confirmed findings; other callers retain their reporting scope.

Recommend the useful next action: a scoped independent PR, contribution to existing work, a specific further check, deferral with its reason, or no change under the assessed conditions. Use the related-work account to justify the contribution route, cite decisive discussion where related work exists, and carry unresolved conditions into the handoff. Distinguish recommending an approach from validating a patch: inspect an actual proposal before claiming its implementation correct. Missing evidence should narrow the recommendation to what is supported, not erase established facts or imply the opposite conclusion.

### Assess suggested priority

Priority recommends how urgently to address a finding; severity describes its impact. Use the project's applicable priority scale when available and identify it. Otherwise use this fallback, label the result **Suggested priority**, and briefly state the scale once per report:

| Priority | Meaning |
| --- | --- |
| P0 | Respond immediately: major harm is occurring or imminent and requires immediate containment or action. |
| P1 | Fix ahead of routine work: a critical user path is severely blocked with no acceptable alternative. |
| P2 | Schedule work: the affected task and response goal justify addressing the finding in routine planned work. |
| P3 | Defer: the assessed product goal and trade-offs support leaving the finding outside planned work for now. |

Before assigning a level, identify whose task is affected, the obstruction or cost under the trigger conditions, and why the response goal supports the proposed timing. Judge scope, recurrence, urgency, and alternatives available to those users together. For P2, state the positive reason to schedule work; bounded impact or absence of P1 urgency alone does not establish it. For P3, explain the deferral trade-off without reducing the stated impact on affected users. A workaround does not make ongoing major harm routine. Labels such as accessibility or documentation do not determine priority, and missing evidence does not establish low impact. An unverified security suspicion does not establish P0. These levels imply no fixed repair deadline.

Return the level, its scale, a short evidence-based reason, and material limits with the existing assessment. If a missing fact prevents a defensible level, return **Priority undetermined**, name that fact and the next check; retain the observation's classification. If the remaining dependency is a product goal or scheduling choice, identify the owner and decision needed rather than requesting another reproduction. When the classification itself is unresolved, a follow-up's urgency is not a confirmed bug priority. Preserve immediate warnings for credible harm while further assessment is pending.

Proceed when the recommendation follows from the assessed goal and evidence, with ownership and decision-relevant limits explicit, and any requested priority has a supported level or an explicit unresolved dependency.

## 5. Preserve the judgment across follow-ups

Reconcile outcomes against the original questions and current worklist: evidence-supported judgments, judgments bounded by genuine limitations, and work interrupted before its checks. For repair scope or grouping, include the [affected-scope check](#establish-the-affected-scope). Worker agreement and a full set of status labels do not establish completion.

When persistent capture applies, the coordinator carries these outcomes through the [save checkpoint](references/working-records.md#save-and-commit-a-checkpoint): primary assessments first, affected overview fields from those saved assessments, then coverage of the actual changed files. Preserve decisive evidence, relationships, accepted goal and scope, acceptance conditions, user decisions and next action; link existing discussion or specs. Readiness to discuss a finding and readiness to implement it remain separate.

Build the return from that reconciled state: scenario, disposition and expectation basis, decisive evidence, response rationale, assessed priority and remaining dependency. When reachability affects the judgment, retain in the existing scenario account the conditions and evidence that establish reachability or exclude the claimed path, with material occurrence or frequency limits. A brief explanation or precise evidence pointer is enough. Account for every original in-scope question, including duplicate links and bounded unresolved outcomes. Report the actual saved/committed state separately from the assessment. The coordinator owns the consuming task's final synthesis.

Before returning or shortening a repair assessment, compare the outgoing text with the coverage account. Use the proposal matches when a proposal exists; otherwise use the derived scope and evidence. Include the basis for required corrections, already-correct connected surfaces, material exclusions and remaining checks, either briefly or through precise evidence pointers. Follow those pointers to check that the recipient can recover the scope and its applicability to the assessed version. The return is ready when this basis is recoverable; fill any gaps using the existing account.

On follow-up, retain the version, scenario, response goal, and previous reasons, including unresolved evidence-backed objections. Identify whether the update concerns the assessment's basis or the owner's handling decision.

For new evidence, corrected expectations or inferences, or changed requirements, determine which judgments are affected. Revise those judgments and explain each actual change; classification can remain unchanged. Retain limits that still apply and drop reasons that no longer apply.

For an owner's choice of scope or timing, record the selected work-item label or priority as a handling decision. Preserve the observed behavior, affected users and any still-supported assessment separately. Explain the trade-off and who bears its cost; deferral alone does not establish lower impact or disprove a defect.

A renewed request for objections invites examination of the same proposition, not an automatic verdict reset. If an objection concerns a different goal, distinguish that question and preserve the earlier result. When accepted facts leave another value trade-off, explain the choice and who bears its cost.

Finish when each requested question has a supported judgment or genuine limitation, no authorized decisive action remains available, and any required saved-state check covers the affected files. An interruption returns the completed portion and exact remaining work. Assessment completion does not authorize implementation or external publication.
