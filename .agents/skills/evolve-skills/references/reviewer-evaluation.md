# Evaluate a review method

Use this branch when a selected evolution changes a code-review method and adoption depends on the quality of its findings. It specializes [purpose-led validation](validation.md); Evolve still owns selection, evidence, adoption and recovery. Ordinary code review does not activate Evolve or start changing its own instructions.

## Establish the comparison

Name the review capability the change should improve and the behavior it must preserve. Examples include detecting a missed requirement, reducing unsupported findings, recognizing valid alternatives, or carrying resolved findings through a later revision. Preserve the reviewer's intended scope; a standards/spec reviewer is not being evaluated as an exhaustive security auditor.

Identify the baseline and candidate instructions, repository state, available context, model and tools. Record unavailable version information as unknown. Reuse relevant cases and prior results only when their inputs and assumptions still answer the selected question. An instruction-only change can have a narrow check; a broad quality claim needs cases that cover that claim.

## Build grounded cases

Use confirmed defects from actual review outcomes, incidents, fixes or reverts when relevant. Establish each defect and its location from requirements and evidence; a revert or accepted comment alone does not prove the label. Keep ambiguous labels unresolved.

Include controls that can expose the proposed change's failure modes: valid code, intentional behavior that looks suspicious, reasonable alternative designs, or a suggested correction that would break a requirement. For a standards reviewer, distinguish a documented violation from a useful but optional heuristic. A case set containing only bugs cannot show whether the reviewer invents problems in valid changes.

Give the reviewer the change and information available at the review point. Keep confirmed labels, later fixes and the desired verdict separate from its input unless the normal task would supply them. Preserve relevant requirements; withholding them would test a different task. For working-tree support, include staged, unstaged or new files as appropriate. For re-review, deliver the revision and prior dispositions after the initial response rather than supplying the completed story at once.

Reuse the existing evaluation-record helper and retention policy. Add only cases needed for the decision; case maintenance and execution cost matter. Separate cases used to tune a candidate from independent confirmation when exposure could explain success.

## Judge findings against evidence

Match findings to the confirmed problem, not exact wording or a preferred repair. Inspect unmatched findings: a reviewer may discover a real issue the initial labels missed. Resolve it with source or bounded execution evidence before scoring it as wrong or changing the label. Keep that adjudication distinct from the reviewer's own assertion.

For each case, retain detected and missed problems, unsupported findings, justified design concerns and suggestions that would cause a regression. Inspect cases whose outcomes change between versions; an aggregate gain cannot erase a material regression. Count the same problem once while retaining separate standards/spec coverage. Agreement among reviewers does not establish a correct label.

Measure review rounds, latency or resource use only from actual execution that supports those measures. A static scenario response can show a proposed disposition, not a shorter real repair loop. Confirm that a claimed reduction in noise did not come from ignoring an intended review dimension, old but relevant defects, or harder cases.

## Return the adoption evidence

Return the per-case comparison, preserved behavior, regressions, unresolved labels and limits to Evolve. Apply the selected acceptance basis; do not quietly replace a required behavioral gain with cleaner wording. A useful narrow result supports its tested scope, not a general reviewer certification. If the cases cannot decide the claim, identify the missing discriminating case or prerequisite before another run.

Changing a production reviewer, installing CI, publishing comments and expanding a case corpus beyond the selected task retain their own authority. Keep source links and the adaptation rationale in the evolution record rather than requiring every review to read that history.
