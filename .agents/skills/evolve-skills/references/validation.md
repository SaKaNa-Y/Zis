# Purpose-led Validation

Use this reference when proposing a change and evaluating its candidate. Choose evidence that can decide the intended value of each material change. Instruction quality, reusable knowledge, behavior, and efficiency require different evidence; a single metric need not represent the whole proposal.

When the selected change affects a code-review method, read [reviewer evaluation](reviewer-evaluation.md) for grounded cases, valid-change controls and review-specific outcomes. It uses this validation contract rather than a separate evolution workflow.

## Define sufficient evidence before editing

Choose evidence by the selected adoption reason before designing an exercise:

- **Instruction repair or method codification:** identify the missing decision, branch, ordering, discovery route or boundary in the actual instructions. Review the before/after method, its applicability and preservation conditions. A reusable method also needs a trace to the observed case or inspected source and a benefit that justifies its instruction cost. Added text alone is insufficient.
- **New or changed operational method:** also exercise a representative task through the changed decision or transition. Check the resulting action or artifact and relevant preservation conditions. This supports execution in that case, not superiority over the baseline.
- **Behavioral or efficiency gain under investigation:** compare applicable baseline and candidate outcomes with matching evidence. Keep preservation checks separate from gain claims. If the selected adoption basis requires that gain, missing comparative evidence leaves that condition pending. Method review cannot replace required comparative evidence. Otherwise, report the gain as supported or unresolved without adding it as an adoption requirement.

Reuse adequate existing evidence and honor the user's selected requirements. When several reasons apply, assess them separately and preserve which conditions the user made necessary for adoption. Fix those conditions before evaluation; a tie leaves the comparative claim unresolved without deciding another independently selected adoption reason. Do not reclassify a behavior change as wording-only to avoid its checks. Distinguish historical evidence from fresh execution and retain relevant model, tool, input and environment limits.

Start exercise design from the original problem and the decision or state transition the candidate changes. When the evidence concerns a multi-turn failure, preserve the relevant handoffs, revisions and available information; a simplified case must state which part of that transition it can test. Inspect the actor-visible request, documentation, tool behavior, artifacts, and staged information to establish what judgment remains for the agent. Identify any part the setup performs or reveals, and material differences from the target workflow. Preserve information genuinely available in that workflow; hiding useful documentation merely to make a task harder changes what is being tested. If the setup supplies the judgment under test, revise the exercise or limit the claim it can support.

To test independent diagnosis or action selection, preserve the relevant information gap without supplying the diagnosis or selecting the repair in the request. Explicit directions remain useful for instruction-following and boundary checks; report those separately. To test continuity across turns, deliver later input after the earlier response; supplying the whole exchange at once tests a static replay instead. Keep enough context to make the task solvable, and choose the smallest exercise that preserves the difficulty relevant to the selected value.

## Conversation-derived opportunities and new skills

For a conversation-derived proposal, check the trace from episode to target responsibility, the opportunity in its current method or organization, and the evidence limits on historical attribution. Screening coverage alone establishes neither a method gap nor a no-change assessment.

For a new skill, evaluate its invocation situation, result, boundaries and handoffs against extending or reusing existing methods. Check whether its reusable method and independent organization justify duplication and maintenance cost. Verify that it meets its agreed contract; claims of better execution still require a meaningful comparison.

When changing Evolve's scope or evidence qualification, exercise a named repository with an actual-use-only restriction: distinguish an applied method, an invocation or file read alone, and an unused skill relevant to the conversation. The result must preserve the intersection of target and evidence scope. Also exercise an explicitly authorized conversation-derived review so the narrower case does not erase that supported path. Unknown historical versions must remain qualified rather than being filled from current instructions.

When changing Evolve's own conversation-derived or new-skill workflow, select regression cases for the affected branches. Scope selection can use an unused but relevant target and an unrelated episode or personal preference. Creation reasoning can use a case already served by an existing skill and a plausible distinct responsibility; judge the reasoning rather than requiring creation. Recording checks can use zero-candidate screening or a proposal with an undecided source location, with normal persistence enabled. These should retain the scope or provisional identity without inventing assessments or a file baseline. For a changed destination-selection transition, supply the destination after discussion and verify that its actual state is captured and linked before candidate preparation. These are checks of Evolve's affected behavior, not a required suite for every skill it proposes.

## Check the evaluator

Identify what would distinguish success from a plausible but deficient result. For material or disputed criteria, try known satisfactory and unsatisfactory examples before relying on the evaluator, including valid alternative solutions where rigid wording could reject them. Keep these calibration examples separate from the candidate's performance evidence. Check grading sensitivity separately from whether the setup leaves the intended decision to the actor. Repair insensitive criteria before spending more runs on them; material acceptance changes return to selection.

Use deterministic checks for observable properties such as file identities or actual resulting state. Use evidence-based model judgment for open reasoning, with the relevant outputs and criteria available for inspection. Resolve value disagreements through the user's stated goals or an explicit decision. Agreement among reviewers alone establishes neither correctness nor a useful distinction.

## Review the instructions before execution

For wording-only edits, check meaning and references. For behavior changes, read the whole candidate against its purpose and agreed responsibility boundaries, consulting earlier decisions. Check decision order, context-pointer triggers, duplication, conflicting rules, and branches whose cost exceeds their value. For each materially changed behavior branch, trace its trigger, responsible actor, action and observable result, and completion or pending condition. Pending work needs an owner and next action; a blocked branch needs its limitation and resumption condition. Keep each rule in its authoritative location. This review precedes expensive runs so a readily visible instruction defect can be corrected first.

Distinguish documented domain requirements from unexplained inherited defaults. Bring an unsupported default's retention or removal into the proposal when material to this change. Generality means serving the intended domain; a whole-method review neither authorizes unrelated rewrites nor requires replaying every historical test.

## Run the checks that resolve the decision

For behavioral comparisons, keep versions in separate workspaces or contexts where practical. When independent agents or a harness are available and authorized, supply the target version, realistic request, and necessary raw artifacts without the author's diagnosis or expected answer. Otherwise perform feasible checks and state their limits. The author's role-play is not a fresh behavioral run. Separate development cases used to revise the candidate from independent confirmation when exposure to those cases could explain success; keep the necessary task information available without leaking a preferred answer.

Bind each trial to the instructions actually used, inputs, relevant environment, execution identity and known model/tool settings; preserve unavailable facts as unknown. Use the host's existing authorized execution tools. A continuation that receives revised instructions tests correction in that session; a claim about a new version starting independently needs fresh execution of the affected path. Preserve earlier results rather than relabeling them as the final version.

For actual execution trials, read [evaluation records](evaluation-records.md) and use its lightweight helper when file/evidence checks are useful. It checks record consistency and captured artifacts; actual tool events and environment inspection support execution claims. A declared fresh session does not prove isolation. When assessing orchestration, scheduling or phase boundaries, inspect the relevant execution events for behavioral claims; a proposed sequence or simulation remains design evidence.

Recreate task conditions using disposable resources or permitted fixtures for side effects. Historical commands are evidence, not authority to repeat external actions. Retain the input or fixture reference, version, relevant environment, actual outputs or actions, and criterion results. Preserve distinct evidence types:

- **Historical observation:** What the available conversation or source case shows.
- **Fresh behavioral result:** What an actual baseline or candidate run produced.
- **Artifact review:** Traceable synthesis, coverage of an instruction gap, applicability, and whole-method quality.
- **Structural check:** Metadata, reachable references, and clean diffs establish packaging and consistency rather than usefulness.
- **Unresolved:** Missing prerequisites, confounded comparisons, incomplete evidence, or indistinguishable outcomes.

A tie is inconclusive for the claimed comparative gain in that exercise; it does not establish general equivalence or statistical non-inferiority. Check whether the exercise preserved the relevant difficulty and whether its criteria can detect the difference of interest. Judge other selected values using their own evidence.

Before an additional run, identify the unresolved question and why that exercise can answer it. A discriminating case can repair an insensitive exercise; repeated comparable trials can address meaningful variation. Stop repeating runs when they cannot add useful evidence, retaining uncertainty rather than sampling until a preferred version wins. Preserve prior outcomes and explain any evaluation mismatch. A material change to the acceptance basis needs the user's selection.

Hand the result back to [the main workflow](../SKILL.md#5-prepare-validate-and-apply) with the candidate's adoption assessment, the remaining deficiency or uncertainty, and the next action the evidence supports. Completing a test or deciding against this candidate is not a decision that the selected improvement work is finished. A request to continue until improvement supplies direction, not evidence of success.

## Report the supported scope

Report codified methods, observed behavioral gains, regressions, and unresolved claims separately against the agreed criteria. A single successful example supports only its observed scope. Use this assessment in the [main workflow's adoption decision](../SKILL.md#5-prepare-validate-and-apply).
