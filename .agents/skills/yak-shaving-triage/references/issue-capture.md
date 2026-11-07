# Issue Capture

Use this reference to qualify and reconcile formal tracker records for problems distinct from the User Problem. Unassessed observations may already be saved under the separate [working-record contract](../../assess-findings/references/working-records.md); this reference does not impose tracker publication approval on those authorized working notes.

## Qualify the Problem

Necessary investigation or repair stays with the active User Problem. For a potentially independent finding, retain concrete observation, its user outcome and expectation basis, actual impact, and existing assessment. A confirmed pre-existing problem qualifies under the same standard as a regression.

During Just Use It or another observational workflow, that workflow supplies usage evidence and owns its assessment handoff. Reuse the result from [Assess Findings](../../assess-findings/SKILL.md); qualification is not established by a reproducible symptom or a discoverer's label alone. Keep supported defects, improvement opportunities, unresolved observations and excluded claims distinct. Recording eligibility and the recommendation to repair are separate decisions.

When no assessment exists and a concrete observation has a user outcome at stake, the coordinator assigns an Assess owner directly or through a bounded worker under the shared coordination method. Reuse the existing owner and evidence; retain unavailable checks with a resumption condition. A suspicion or taste alone does not start an assessment campaign. Stop and preserve assessment work under the same pause/cleanup rules as reconciliation.

An Issue-ready Problem needs an evidenced concern or improvement rationale and an observable acceptance boundary. Preserve unresolved observations in the report without promoting them into issue drafts. If the tracker accepts investigation requests and the user asks for one, label the uncertainty rather than inventing a defect. An unavailable assessment dependency leaves the packet pending; continue unrelated work.

## Capture Enough Evidence

Use evidence already encountered or a cheap reconfirmation such as one focused test rerun, an existing log, a reproduction step, or an exact code location. Stop when an agent without the originating conversation can understand the problem, locate or reproduce the evidence, and verify a future resolution.

A root cause or implementation plan is optional. Assess investigates only missing facts that could change qualification or the action recommendation, within the current authorization and phase. Preserve completed evidence instead of rerunning usage to fill a template.

## Wait for Search Eligibility

Prepare packets with enough scenario, evidence and expectation basis to compare problem identity at a natural Capture Checkpoint for background reconciliation. Assessment can remain provisional pending tracker evidence; search itself does not qualify a problem or create a circular wait for a final recommendation. When another active workflow has an independence gate, preserve the evidence without reading Tracker Guidance or target tracker history until that gate opens. Ordinary results and write proposals are collected after the main task completes.

For Just Use It, the Audit Reconciliation Gate opens after the source-confirmed public surface is accounted for and the independently observed findings are frozen. An explicitly concluded Partial Audit also freezes its completed Finding Packets and opens the gate. Receiving a Finding Packet before the gate does not open it; opening the gate alone preserves behavioral blindness, while reading tracker history marks the remaining current audit work and any later resume tracker-informed. Keep the gate open for new packets from tracker-informed work and batch them at later Capture Checkpoints.

## Reconcile Before Proposing a Write

Reconcile each eligible packet against the canonical tracker before finalizing a new-work recommendation or drafting a tracker creation or update:

1. Read project-provided Tracker Guidance to identify the canonical destination, tool, record type, template, and metadata rules. Follow agent-document pointers to shared guidance, commonly `docs/agents/issue-tracker.md`. Skill activation and repository hosting do not select a tracker. For local Markdown, search the configured issue directory including closed or archived records and follow its file and status conventions.
2. Confirm that the destination can be searched well enough to rule out an existing record. If guidance is missing, access is unavailable, or search is insufficient, assign `Reconciliation Blocked`, retain the Issue-ready draft, and propose no tracker mutation.
3. Search open and closed records when the tracker provides states. Use multiple evidence-shaped queries: the distinctive symptom or error text, the affected capability or component, and the user outcome or evidence location. Inspect every plausible candidate and stop when another materially different query reveals no unexamined candidate, rather than enumerating unrelated tracker history. When the tracker exposes related implementation work, such as pull requests, inspect its current status and compare its stated or evidenced coverage with the observed reproduction and acceptance boundary. Report what is covered, what remains outside the change, and what is uncertain; touching the same component alone does not establish a matching problem.

   Treat an uncovered case as evidence for reconciliation under Problem Identity; it does not by itself justify a new record or parallel repair. Repair remains governed by the current User Problem and the user's authorization.

   With local Markdown as the canonical tracker, also inspect related issues and PRs in an explicitly associated, accessible repository. These supplement the local search; they do not create a second write destination. Preserve useful links in the local draft. A missing local record may still need Proposed New even when a remote issue exists; explain the relationship and keep remote records unchanged. Failure of a supplemental search is a stated limitation, while failure of the canonical search blocks write proposals.
4. Apply Problem Identity before relying on titles or suspected causes. Finding Packets represent one problem when one resolution and acceptance boundary would resolve them together; keep them distinct when one could be resolved while another remains. Group packets sharing one identity before choosing a disposition.
5. Inspect the resolution of a matching closed record. Follow its canonical duplicate when it was closed as duplicate; treat a currently reproduced fixed issue as a potential update or reactivation under Tracker Guidance; reuse a declined or won't-fix decision instead of opening a duplicate. Create a distinct identity only when the acceptance boundary differs.
6. Assign exactly one Reconciliation Disposition:
   - `Reused` when an existing canonical record already captures the problem; return its title, identifier, and link without mutation.
   - `Proposed Update` when a matching canonical record lacks materially useful reproduction, scope, impact, or acceptance evidence supplied by the current packet.
   - `Proposed New` only when completed canonical search finds no matching Problem Identity; link any supplemental remote match as evidence for the proposed local record.
   - `Reconciliation Blocked` when the canonical tracker cannot be identified or searched sufficiently.

**Complete when:** every qualified problem has one disposition, every Reused result identifies its canonical record, and no Proposed Update or Proposed New exists without a completed search.

## Draft Only the Necessary Mutation

Return material tracker evidence to the existing assessor before drafting. Keep unsupported and excluded claims out of mutation proposals. An improvement can qualify on its own stated value without being relabeled a defect.

For `Proposed Update`, prepare only the missing evidence and any exact status action allowed by Tracker Guidance. For `Proposed New`, adapt this template to the destination. A `Reconciliation Blocked` problem may retain the same information as an internal Issue-ready draft, but it is not a creation proposal.

```markdown
# [Outcome-oriented title]

## Observed problem

[What happened, under which conditions.]

## Impact

[Who or what is affected and why the problem matters.]

## Evidence

- [Reproduction steps, failing test, log, request/response, or exact location.]
- [Any cheaply confirmed supporting observation.]

## Expected behavior

[The desired outcome and its basis: established requirement or proposed improvement.]

## Scope and known unknowns

[Known affected area and material facts not yet established.]

## Acceptance criteria

- [Observable condition proving the problem is resolved.]
- [Regression coverage or preservation condition when relevant.]

## Deferred from current work

[Why this is a distinct problem rather than the one currently being resolved.]
```

Keep the issue factual. Mark uncertainty explicitly instead of guessing a cause or solution.

## Request Approval and Write

The main agent performs this step after the User Problem completes and eligible reconciliation settles. Search workers return evidence and drafts without writing.

Present the batch as `Reused`, `Proposed Update`, `Proposed New`, or `Reconciliation Blocked`. Reused results need no approval; include their title, identifier, and link. For every Proposed Update or Proposed New, show the exact destination, action, title, body or patch, and tracker metadata, then request Tracker Write Approval so the user can approve any subset. Apply labels only when Tracker Guidance defines their use.

Perform only approved mutations. Skill invocation, urgency, a writable tool, and prior approval for a different batch are not Tracker Write Approval. Read-only search and reuse need no write approval; creating an issue, adding a comment, reactivating or closing a record, editing tracker metadata or state, and changing a canonical repository Markdown issue all do. Ordinary authorized Working Records follow their separate save contract.

If an approved repository-file mutation would change the checkout that an active workflow is still auditing or validating, retain the exact approved patch and apply it only after that workflow finishes its integrity check and cleanup. Request approval again if the proposed patch changes before it is applied.

When Tracker Guidance uses GitHub, execute approved writes with the project-prescribed GitHub tool; when it uses a repository record, follow the established file conventions. A user may explicitly select a repository Markdown destination, but do not invent its path or format when repository guidance is absent.

When Tracker Guidance is absent and the user has not established a destination, keep the completed template as a Reconciliation Blocked draft. Present blocked drafts together after the current work and ask one combined question about where they should be recorded. Do not invent or configure a tracker as part of Yak Shaving Triage.

## Report the Outcome

For ordinary problems, report the batch's actual dispositions after the main task completes. Order confirmed findings by the assessor's suggested priority, highest first, unless the user requests another presentation. Use the [Assess priority method](../../assess-findings/SKILL.md#assess-suggested-priority) rather than creating a second scale here. If a priority is missing, return that question to the existing assessor; unavailable assessment stays **Priority undetermined** with its blocker and next action.

For each ranked finding, show its level, the problem, a short reason for the level, and the supported next action. Identify the scale once; retain evidence limits and distinguish a suggested level from any existing tracker priority. Keep undetermined findings visible in a separate group without treating them as low priority. Keep optional improvements and unresolved observations distinct from confirmed defects. Preserve separate problem identities even when recommending one combined fix.

Suggested report levels do not create or change tracker labels, priority fields, deadlines, or authorization to repair or publish. Those remain governed by Tracker Guidance and the user's approval. For each result, keep these facts distinct:

- the matching record and its current issue or PR state;
- the observed problem status, including the tested version, implementation coverage and any unresolved verification; and
- the next action supported by that evidence and the user's authorized scope.

A Reconciliation Disposition determines how to reuse or update records; resolution of the observed problem requires evidence covering its acceptance boundary. Retain a still-reproducing problem when its matching PR is closed or unmerged, and carry forward any alternative-resolution or declined-decision evidence established during reconciliation. When the user requests only new findings, state that existing-record matches were filtered from that view rather than treating them as resolved.

For a ranked finding using the fallback scale, use a concise result such as:

```text
Suggested P2 — <problem>: <bounded impact or acceptable workaround>. Reused <title> (<link>): PR closed without merge; still reproduced in <version>; next step is <supported action>.
```

Use `Recorded` only after the mutation succeeds and `Reused` only with the canonical record's title and link or identifier. Name Reconciliation Blocked drafts and their search limitation. For an approved target-checkout patch that must wait for the active workflow, say `Approved <title>; recording is deferred until <named completion boundary>`. When the user does not approve a proposed write, say that the named draft was retained. After a deferred write succeeds, report its final destination. Keep the main task status separate from reconciliation and publication status.

For an urgent problem, lead with the credible risk, say where it was preserved, and state that its repair remains outside the current task. Then return to the User Problem unless the user changes it.
