# Discovery Lenses

Use these methods to make a concrete clue testable or to explore a user-requested scope. Select by the behavior under examination; the lenses are alternatives, not a mandatory checklist.

## Set the Boundary

For an ordinary-work probe, turn the unresolved clue into an observable expectation and choose a comparison from the table below. Keep the check bounded to evidence already available or cheaply obtainable. If it would require a separate investigation, retain material uncertainty in the task report and resume the User Problem.

When exploration is explicitly requested, derive a finite set of relevant outcomes and boundaries from the request and available product contracts. Before the first probe, briefly tell the user which outcomes and boundaries you will exercise and what will end the pass. Select discriminating probes for those outcomes, then stop when each has evidence or an explicit execution limitation. Further scope needs a new basis in the User Problem. Report unexercised areas without implying complete coverage.

A co-active workflow keeps ownership of its coverage, sequencing, and evidence. Use these lenses within that work, reusing completed observations. Existing audit independence gates also apply to exploratory tracker reads; historical research is not a prerequisite to probing.

## Choose a Discriminating Probe

| Lens | Trigger or relevant boundary | Smallest useful comparison |
| --- | --- | --- |
| Contract and outcome | An example, success message, or documented promise disagrees with the result. | Follow the promised path through its downstream consumer. Compare the actual output or state with the promise, including defaults that could hide a skipped operation. |
| State transitions | Behavior depends on previous work, partial completion, retries, or stored results. | Keep input fixed and compare the relevant before/after states: fresh versus partial, first versus repeated, or cold versus warm. Check whether the transition preserves existing data and reaches the intended result. |
| Representation and precedence | Multiple formats, layers, or consumers express the same intent. | Trace reading, updating, and reading again through the affected consumers. Vary one representation or conflicting layer to expose a stale value, shadowed write, or inconsistent precedence. |
| Side effects and recovery | An operation changes unrelated state, fails midway, or reports success before its lifecycle ends. | Compare relevant state before and after the operation and one subsequent use. Include persistent changes, leftover resources, termination, and whether failure leaves recovery possible. |
| Execution boundaries | Equivalent entry points, adapters, modes, or actors may transform the same request. | Hold the intent fixed while changing one boundary. Observe preserved options, output, errors, or completion; use missing input to distinguish an interactive path from an unattended one when relevant. |
| Delivery and environment | Development works but consumption fails, or equivalent versions differ by origin or environment. | Inspect the delivered artifact or actual failing component and compare a supported reference under controlled conditions. Isolate ambient dependencies; follow evidence to platform, permissions, runtime, or hardware differences as needed. |
| Shared resources | Failures correlate with overlap or multiple operations using the same state. | Compare isolated and overlapping use of that resource. Observe ownership, contention, and cleanup in an environment that represents the relevant semantics. |
| Repair coverage | Eligible history or a regression test establishes a fix with a narrower boundary than the present scenario. | Identify what the fix actually covered, then vary the uncovered structure or state while holding the intended outcome constant. Respect prior product decisions and distinguish a supported alternative from an unsupported configuration. |

Prefer one-variable controls. Record confounding differences when a clean comparison is unavailable. Use disposable state for probes that mutate data; real external effects still require the task's authority. Native-platform or production-only behavior remains unverified when that environment is unavailable.

## Stop and Classify

End the individual probe when the expectation is met, an observable discrepancy is established, or a concrete limitation prevents a useful comparison.

Preserve the triggering evidence, expectation, material conditions, action, observed result, and control or retry when used. Distinguish observed behavior from an inferred mechanism and historical reports from fresh execution. An intermittent observation retains its attempt results and uncertainty. A blocked probe is a coverage limitation, not a confirmed product problem.

Then [return the evidence to Guard the Next Branch](../SKILL.md#1-establish-capture-and-guard-the-next-branch). Necessary investigation and verification continue under the active workflow to the depth the User Problem requires. Independently deferrable problems follow the existing [issue-capture process](issue-capture.md); unsupported hypotheses return to the main task. Exploration can finish with no findings; finding count is not a completion criterion.
