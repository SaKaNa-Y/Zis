# Finding Packets

Read this reference as soon as actual use may have revealed a functional, documentation, visual, interaction, operational, availability, or Capability Gap problem.

## Confirm the Observation

Compare observable behavior with a public promise, a usable-path expectation, or a consistent visible state. Preserve the observation when actual use supplies evidence and a concrete user outcome is at stake. Identify whether the expectation comes from a public promise, consistent behavior, an exercised task requirement, or a proposed improvement. An expectation without an established basis remains provisional. Reproduction establishes occurrence; qualification and action recommendations come from Assess Findings. Keep taste alone and source-only suspicion as notes.

Re-run the same path once when doing so is safe and cheap. A repeat observation is reproducible. An observation that does not recur consistently is an **Intermittent Finding**, not a discarded flake; record every attempt result and the state that may distinguish them.

A Blocked capability becomes a Finding when the product or its documentation creates the block. A limitation caused only by the available audit environment remains Blocked coverage with its reason.

A source-confirmed public capability missing from user documentation is a documentation-discoverability Finding when the shipped interface and project signals establish public intent. When public intent remains ambiguous, exercise the capability if safe and report the ambiguity without asserting a documentation defect.

A **Capability Gap** is a reproducible limitation found through a concrete user path where shipped capabilities cannot be combined, scoped, or controlled finely enough to reach a practical outcome. Record the blocked outcome and operational impact, and describe it as a gap or limitation. Call it a bug only when it contradicts a public promise or consistent product contract. A preference without an exercised path and concrete impact remains a note rather than a Finding.

The usage executor stops after the cheap confirmation and returns to its slice. The coordinator routes decision-relevant gaps to assessment; product repair remains separate.

## Revisit Related Coverage

When a finding or source evidence makes an existing coverage claim uncertain through a shared input, transformation, or output, the main agent revisits that claim in the Coverage Ledger, including previously `Verified` paths. Narrow the claim to what its evidence supports and preserve that evidence. A root result or intermediate step may leave independent outputs or later states unresolved.

Use the existing exploration lenses to identify the public checks still required and record their [coverage states](verification-traces.md#prove-the-journey). Give runnable `Not Exercised` checks an executor and next action under the existing execution criteria and source/tracker gates. Carry confirmed and unresolved scope, with justified exclusions, into assessment while usage continues.

**Complete when:** affected claims match their evidence or stated limitations, and every runnable pending check has an executor and next action.

## Build the Packet

Keep one packet for each independently understandable candidate or assessed finding, with a stable identity and its current assessment or pending state:

- affected capability and scenario: what the user is doing, the observed trigger, actual impact and why a response would help; distinguish possible consequences from observations;
- environment, version, prerequisites, and initial state;
- exact public action path and the material input or state needed to replay it;
- expected and observed behavior, the basis for the expectation, and any concrete counterevidence already encountered;
- reproduction attempts and whether the result is stable or intermittent;
- available screenshot, output, log, viewport, or documentation location; and
- material unknowns, stated without guessing.

For documentation Findings, identify the exact public instruction or claim. For visual Findings, include the rendered state and viewport. For Capability Gaps, identify the independently useful behaviors that cannot coexist and the smallest missing control or composition boundary, without designing the solution. Keep secrets and unrelated personal data out of the packet.

Preserve the failing specimen or an exact creation command when retyping a sample could change the observation. Keep material whitespace, encoding, argument boundaries, and pre-existing state explicit when relevant; a displayed code block or a path to soon-deleted temporary data may not preserve them. Retain the necessary input with the packet before cleanup. Ordinary findings need only the representation sufficient to replay their behavior.

Describe the condition actually observed, distinguishing it from an inferred trigger. Record which dimensions changed in a comparison and leave untested conditions unknown.

Describe concrete user impact. Preserve isolated-environment scope and any known relation to the real consumer. Leave priority judgment to [Assess Findings](../../assess-findings/SKILL.md#assess-suggested-priority), carrying forward the evidence, any project scale, and the caller's request. Preserve its suggested level and limits in the packet. Keep severity separate and use the project's severity scale only when sufficient evidence supports it.

## Preserve and refresh shared evidence

When a record destination and save authority are configured, the coordinator saves the packet under the [working-record contract](../../assess-findings/references/working-records.md), reusing the same identity as Yak and Assess. Historical matching waits for the active gate: retain an unmatched observation until matching is eligible rather than reading old findings early or claiming uniqueness. Copy essential evidence before temporary resources are removed.

If Assess returns a causal, blocking or masking relationship, retain its confidence and supporting evidence, revisit affected coverage above, and update the relevant executor through the coordinator. A relation alone does not merge findings or expand the authorized repair scope.

## Hand Off for Assessment and Reconciliation

At a coherent usage boundary, the main agent retains its directly observed packet or receives the delegated executor’s packet for [Assess Findings](../../assess-findings/SKILL.md). The coordinator assigns one assessment owner for a bounded finding or related set, directly or through a task-fit worker while independent usage continues. Supply the current source/tracker phase and available evidence without presenting the discoverer's label or proposed fix as an established conclusion. Keep one accountable assessment per identity and reuse it across Just and Yak; additional evidence updates that assessment.

During source-blind use, the assessor checks supplied evidence and may request a specific public-interface contrast from the current usage executor, including the main agent during direct use. Source and tracker access follow the audit's global gates. Keep early judgments provisional where the required check is not yet eligible. Source-dependent investigation can start when the source phase opens; reconciliation waits for the Audit Reconciliation Gate.

Coordinate independent work within available slots and shared-resource constraints. Use direct assessment at a safe boundary when it fits the work; retain genuinely queued work with its reason and next checkpoint. If delegation is unavailable, report the actual inline work or pending limitation. A missing dependency leaves an explicit pending assessment rather than a fabricated result. On pause, stop dispatch and interrupt active assessment work, preserve returned evidence, and account for resources; resume under the recorded phase.

Once the audit or an explicitly ended Partial Audit freezes its observations, a co-active Yak may reconcile assessable packets. An early assessment need not wait for tracker results to state supported facts or classification; a new-PR recommendation waits for relevant reconciliation. Yak returns material coverage or resolution evidence to the assessor instead of starting a second assessment. Without Yak, the assessor handles the eligible read-only check; Just does not publish formal tracker records.

Before the final report, collect each assessment and preserve its separate classification, supported action, any assessed priority and its basis, and remaining dependency. When Yak is co-active, use its [outcome reporting contract](../../yak-shaving-triage/references/issue-capture.md#report-the-outcome) for the findings section while retaining this audit's coverage and cleanup report. Early handoff is not final qualification. Report unresolved observations even when they are not ready for tracker recording, and preserve the reason an earlier claim was excluded.

**Complete when:** another agent can replay the observation and inspect its expectation basis and impact; the assessment and search state are explicit; and evidence survives handoff and cleanup.
