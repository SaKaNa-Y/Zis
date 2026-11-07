# Choose tests worth keeping

Use this method when choosing verification during implementation, reviewing changed tests, or assessing a repair whose test coverage or cost affects the recommendation. Stay within the consuming task's scope. Reuse its accepted requirements, inspected tests and applicable results; a new caller does not need a new assessment.

## Identify the protection and existing evidence

Name the observable behavior or contract, a supported triggering condition, and the relevant error a check must detect. Trace the input through the supported entry point when reachability matters. A contract can justify a test before any reported failure. A reproduced bug supplies useful evidence, but does not by itself require a new test file or case.

Inspect nearby tests, assertions and applicable runs. Compare the behavior and failure conditions they distinguish, rather than counting tests or matching names. State what remains unsupported and what another check would add. Derive expectations from the agreement, contract or an independent example, not the production calculation repeated in an assertion.

## Choose the smallest sufficient verification

Respect required repository gates. For the remaining question, choose among these options:

- Reuse existing checks or trustworthy results when they cover the relevant behavior at the examined state.
- Extend an existing test when a supported condition is missing and fits its behavior and setup.
- Add a test when it protects a distinct outcome or boundary that existing tests cannot express clearly.
- Use a one-time reproduction, inspection or manual check when it supplies sufficient evidence and a durable test would add disproportionate setup or maintenance cost. Preserve the result and its limits in the task's existing evidence account.

Weigh the additional protection against fixtures, mocks, dependencies, runtime, flakiness and maintenance through valid changes. Required checks and material unsupported behavior still need resolution. An expensive harness is a reason to seek a cheaper valid check, not proof that the behavior works. Separate this repair's verification from a broader testing-infrastructure proposal.

When reviewing or assessing tests already present, apply the same comparison before recommending retention, extension, replacement or removal. A passing duplicate can add little protection. A precise assertion can enforce a real contract: snapshots, empty results, constants and mock calls are clues to inspect, not automatic defects. Ask whether a valid implementation change would fail the assertion for an irrelevant reason. Keep genuine wire formats, defaults and boundary obligations intact.

If detection ability remains uncertain and matters to the decision, use [test effectiveness](test-effectiveness.md). Reuse an applicable failure on the known defect followed by success on its valid repair. Additional fault injection is useful only for a remaining question.

## Carry the decision forward

Return the selected check or test change, the behavior it protects, its incremental value or sufficient existing coverage, and material limits. Keep this in the consuming task's existing reasoning or evidence; a small change needs only a brief explanation. Reading this reference creates no separate report, approval step, universal test phase or authority to rewrite unrelated tests. Revisit the decision when requirements, implementation, coverage or costs change, rather than repeating it at each workflow handoff.
