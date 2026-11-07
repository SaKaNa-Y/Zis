---
name: challenge-the-claim
description: Test a specific claim with the strongest relevant evidence, distinguish factual disagreement from design trade-offs, and conclude honestly when no supported rebuttal is found.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.02"
---

# Challenge the Claim

Examine whether a specified claim withstands a directed search for counterevidence. Success is an accurate judgment of that claim, including a supported rebuttal, a narrower conclusion, an unresolved fact, a value disagreement, or no supported rebuttal. The user chooses the goals and trade-offs; the skill tests the reasoning and factual commitments.

This is an explicit discussion and investigation entry point. Use [investigate-with-evidence](../investigate-with-evidence/SKILL.md) for factual investigation and controlled execution. Load the installed skill by name, or read its `SKILL.md` when the host has no skill invocation tool. Install both skills together. If the dependency cannot be found, identify it and leave dependent investigation pending; continue only conclusions supported by already available evidence, without claiming that the investigation is complete.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## Fix the claim and its conditions

Restate the actual proposition, relevant conditions, and the judgment it bears on. Use the speaker's words and available context; separate their stated position from a charitable interpretation or your own implication. Preserve the strength of that position: an action being warranted, necessary, or the only possible option are different claims. When the request concerns a decision, preserve its intended outcome and each linked judgment the user asks to examine. Establishing a defect, choosing a remedy, and locating responsibility can require different evidence; state what is supported, refuted, or unresolved at each relevant link and how that affects the action recommendation. When ambiguity materially changes what would count as a rebuttal, resolve it before choosing a target. Keep the request focused: a claim about one failure mechanism does not imply endorsement of an entire PR or implementation.

For a PR, inspect the description and changes relevant to the fixed claim. When the claim concerns the failure's cause, the fix's scope, or the description's accuracy, compare those assertions with the relevant diff, tests, and discussion. Distinguish a misleading description from a defective implementation or missing evidence. A review comment is a position to examine, not authoritative proof or permission to invent the reviewer's intent.

Separate factual premises, the inference to the conclusion, and value priorities. A preference for simplicity over compatibility is a trade-off; a claim that a design preserves compatibility is testable. Facts and logical consistency remain open to examination even when an argument also expresses a design philosophy.

## Investigate the strongest relevant challenge

Generate candidate objections from the relationships that determine the requested judgment. For claims about product behavior or a proposed action, trace the affected user's workflow through the outcome the claim promises. For a proposed mechanism, examine whether existing capabilities or an alternative achieve that same outcome under the stated constraints. Distinguish satisfying that outcome from avoiding the situation that exposes the problem. For an ownership claim or a moved responsibility, follow the boundary and the consumers that depend on it. Use these routes where they could change the claim, rather than as a checklist or an invitation to expand the project.

For each promising candidate, identify which premise, inference, or conclusion it could change and what evidence would distinguish it from the current explanation. When a factual uncertainty could affect the result, use `investigate-with-evidence` to resolve it. For a purely logical question under given premises, check whether the conclusion follows; finish that check once a valid derivation or counterexample settles the inference, or identify the missing premise that leaves it unresolved. Search for the most consequential supported counterexample or reasoning gap rather than collecting criticisms. Examine the strongest reasonable reading of the claim without adding conditions or ambitions the speaker did not assert.

A rebuttal must contradict a factual premise, expose an invalid inference, or show that the conclusion fails within its claimed scope. Evidence that a premise is false is relevant; merely replacing a given condition with a different scenario is not. A limitation outside that scope can inform another decision but does not defeat this claim. An alternative solution directly challenges a claim of necessity or uniqueness, but its existence alone does not disprove a claim that the original solution works.

Carry the proposition and its conditions across follow-ups. New objections must affect that same proposition, or be explicitly introduced as a different question while retaining the earlier outcome. Withdraw an objection when evidence defeats it. The same standard applies to the user, another author, and your own earlier advice.

## Give the judgment and close the claim

Lead with the result for the original claim. When evidence supports a rebuttal, present the strongest point first: the exact premise or inference that fails, the decisive evidence or counterexample, and what consequence follows for the claim. Use direct language proportional to the evidence. One decisive objection is enough; rhetorical force, weak objections, and objection counts do not strengthen the result.

For each objection included in the answer, state its established disposition before describing its reasoning: it refutes a named judgment, has been ruled out for that judgment, or remains unresolved. Follow with the evidence and its consequence. For an excluded candidate, lead with the completed check, such as "I checked whether X; evidence Y rules it out." For an unresolved candidate, lead with the missing fact and the decision it prevents. Present a supported contradiction as a rebuttal. Express these outcomes in natural prose; a fixed table or list is unnecessary.

Assess each judgment the user asks to examine using evidence relevant to that judgment. A defect can be real while a particular patch is unnecessary or incomplete. An objection rejected for one judgment may still inform another, but extending it requires evidence for that judgment. When the request concerns timing or resource trade-offs, or established constraints make them consequential to the requested decision, assess action priority separately. In that branch, a verified workaround can inform deferral when combined with evidence about affected requirements, costs, or competing work. Leave priority choices unresolved where that evidence is missing.

When the evidence supports only a scope restriction, state what remains true and under which conditions. When facts are missing, state the unresolved dependency and what would settle it. An unmet burden of proof may leave a claim unsupported without proving its opposite.

When the facts and consequences are accepted and the remaining difference is a value priority, name the trade-off and who bears its costs. Check consistency with the project's accepted requirements; distinguish changing those requirements from satisfying them. Once the relevant decision owner knowingly accepts a permissible trade-off, conclude that no factual rebuttal has been established. Further preference advocacy requires a separate user request.

When no supported rebuttal is found under the examined conditions, say so plainly and briefly account for the strongest relevant candidate using its established status and evidence. If no evidence-backed candidate emerged, say so without inventing one. Positive evidence can support the claim; failure to find a counterexample alone is not universal proof.

Close after the relevant reasoning checks and any needed factual investigation are complete; apply the shared investigation's stopping condition only when that investigation was needed. Close this line without inventing a broader claim to oppose. Mention a genuinely decision-relevant adjacent issue only briefly as a separate direction for the user to choose; otherwise end.

Keep the conclusion, evidence, and practical limit together. Reopen a closed claim for materially new evidence, changed conditions, or an explicit change of target. This workflow produces analysis, not an external reply or product change; those actions require their own instruction.
