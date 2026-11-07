# Check test effectiveness

Use this reference when the task's conclusion depends on whether a test can distinguish a specific promised behavior from a plausible error. It applies to generated and manually written tests alike. The consuming implementation or review task owns repairs and acceptance; this method returns evidence about the test. It does not require test-first development, a mutation framework, a coverage target or a new check on every change.

## Establish the claim and reuse evidence

Name the behavior, relevant conditions and error the test is meant to detect. Derive expected results from the agreement, observable contract or an independently supported example. Inspect the actual test entry point, assertions and exercised code. Check whether mocks or copied calculations replace the very behavior being assessed, and whether changed assertions remove a previously promised condition.

Reuse a trustworthy run where the relevant defect fails for the intended reason and its valid repair passes, when its version and conditions answer this question. A red result caused by setup failure does not establish behavioral coverage. If existing evidence is sufficient, return it without manufacturing another error variant.

## Exercise the smallest useful contrast

When a material uncertainty remains, follow [Investigate's setup and authorization rules](../SKILL.md#choose-a-discriminating-check) to choose a bounded experiment. Use disposable copies; keep production files, shared state and unrelated work intact. Record the source/test identities and preserve the test while comparing implementations.

1. Run a valid implementation through the real test entry point. Establish a passing control or identify why the environment cannot yet support the comparison.
2. Introduce one plausible, relevant error in that disposable implementation, or use a known faulty revision. Preserve the causal path and check that the changed code is loaded and the affected behavior is reachable. A syntax error, missing dependency or invented behavior outside the contract is not a useful substitute.
3. Run the same test and inspect why it fails or passes. A relevant behavioral assertion must distinguish the faulty behavior. Import, compilation, permission, timeout and setup failures leave that claim unresolved unless that failure itself is the promised behavior under test.
4. Restore the valid implementation and confirm the control still passes. If the test might enforce incidental structure, try a valid alternative when that comparison would settle the concern. A useful test accepts the promised behavior across valid implementations.

A small property-based check can cover an invariant across varied inputs; a differential check can compare implementations on the same inputs. Use either only when it answers the question. Derive properties independently of implementation, and distinguish intentional behavior changes from regressions before treating the old implementation as an oracle. Preserve the relevant input, seed and minimized counterexample when these explain or reproduce a failure. Neither technique needs a new dependency when existing tools suffice.

## Interpret and return

- A relevant fault triggers the intended assertion while valid controls pass: evidence supports detection of that fault under the exercised conditions, not all bugs or complete correctness.
- The faulty variant passes: first check whether it is equivalent, irrelevant to the promise, unreachable or absent from the actual executed build. If a demonstrated relevant fault reaches the exercised path and remains undetected, report that specific test gap. This alone does not prove the current product implementation is faulty.
- A valid alternative fails: investigate whether the test rejects permitted behavior or whether the supposed alternative violates a real requirement. Keep that distinction explicit.
- Environment or setup failure: retain the unresolved claim and the prerequisite for a discriminating run.

Return the protected behavior, test and implementation versions, contrasts actually run, observed assertion/output and remaining limits. Keep executed evidence separate from suggested tests. Repair the test only within the consuming task's authorization. Stop when the specific coverage question is answered; broader mutation campaigns or unrelated test rewrites need their own scope. Preserve minimal evidence and clean up the disposable changes.
