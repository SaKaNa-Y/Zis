# Coverage Records

Use this contract when a workflow records actual engineering usage, including successful use without findings. The [working-record contract](working-records.md) owns destination, authority, project identity, concurrency and saved-state checks. The consuming usage workflow owns completing this record loop; a triage workflow is not required.

## Project navigation and batch evidence

Use a separate directory for each verified target repository within the configured records root. Reuse existing project and batch paths. A branch or temporary checkout is an execution location, not a new project identity. Distinguish independently targeted forks and cross-repository evidence from coverage of the target itself.

```text
<records-root>/<project>/
  README.md                  # project identity and coverage entry
  coverage.md                # current navigation by user outcome
  exploration-coverage.md    # optional exploration decisions, separate from usage
  findings/<number>-<short-name>/record.md  # example item linked by an audit
  evidence/<batch>/
    README.md                # roles, replay and limits
    report.md                # version-bound observations
    <artifacts>              # minimal inputs and results
```

Keep the index compact; it links evidence rather than copying logs or every historical result into a table. Batch observations preserve the detailed account. Only primary items count toward category totals. No-finding coverage needs no invented problem or assessment. Known unexercised, blocked and excluded outcomes belong in the map with their discovery basis and next action; the known map need not enumerate the whole product.

When historical reports exist without an index, import only evidence relevant to the current selection. Preserve its original version, depth and limits; unknown fields stay unknown. Label the import as historical organization, not new execution. Preserve existing report links and avoid a mandatory repository-wide backfill.

Read result-bearing coverage only when the consuming workflow's history gates permit it. An explicitly independent audit resolves permitted configuration and identity without reading historical results, saves provisional observations in an authorized unique location, then reconciles identities and indexes after its gate opens. A new worker does not undo prior exposure.

## Identity and minimum content

Keep these facts distinct:

- **Coverage object:** a stable user outcome with independently assessable behavior boundaries. Use an existing identifier or stable section anchor. A commit or individual command is not its identity. Separate meaningful modes within the object when their results or versions differ.
- **Actual observation:** what a particular batch executed and observed under identified conditions. Bind it to replayable evidence and actual source/artifact identity.
- **Applicability judgment:** whether an older observation can support work on another target revision or artifact, with the checked differences, rationale and remaining uncertainty. This does not create a new executed observation.

A batch records common identity once; individual observations override it if the artifact, source or environment changes. Retain:

| Account | Minimum useful content |
| --- | --- |
| Execution identity | Actual execution date or time range (distinct from import, applicability and save dates); target repository; full commit of the actual executed source when established; material dirty changes or unresolved correspondence; actual executable/package resolution, version and necessary digest/build provenance; relevant environment. Keep the original checkout separate when it differs. |
| Selected scope | User outcomes, modes, why this batch was selected, inherited coverage and reuse basis, exclusions and known remaining scope. |
| Observations | Stable coverage object, initial inputs/conditions, material actions, discriminating variation, actual result/state, evidence and limits. Planned work is Not Exercised; blocked or partial work does not imply a completed journey. |
| Continuation | Linked findings when present, unresolved differences, next useful checks, resource ownership, cleanup and persistence status. |

For example, a batch header can supply repository, full executed SHA, build identity and platform, while each row links its trace. Use an explicit identity override for a later rebuilt artifact. A release version or artifact digest alone does not establish a source SHA; retain unknown correspondence instead of borrowing the checkout's revision. The records repository's commit identifies a save, not the product tested; it need not be embedded in its own commit.

The project index presents each outcome's exercised modes/depth, relevant last actual observations with revision and batch links, applicability judgments where checked, unresolved failures and remaining gaps. Each object can have a small history-links section. For example:

| Outcome / boundary | Last actual target | Execution date | Result and limits | Evidence | Applicability / next action |
| --- | --- | --- | --- | --- | --- |
| Consume a library: ESM | Revision B, identified build | Recorded execution date | Passed within ESM scope | Batch trace | Source comparison supports reuse for target C; not rerun on C |
| Consume a library: CJS | Revision A, identified build | Original execution date | Failed on the retained input | Batch trace and primary record | Recheck after the relevant change |

Organize the current index by stable outcome and independently assessable mode, not by chronological batch sections. Show the last actual observation, including failures, partial execution and blocked attempts. Keep unexplained earlier failures visible beside later passes. A shared batch key can supply dates and identities only when each row resolves them unambiguously. Keep complete SHAs and artifact provenance in linked identity evidence; an index can use short SHAs. Use explicit unknowns instead of inferring execution dates from filenames. Keep historical batches as links.

Exploration coverage records examined scenarios, alternatives, judgments and their dated basis. Keep it separate from usage verification coverage. Neither an examined opportunity nor a source comparison establishes runtime coverage. Keep usage state, scope exclusions, problem assessment and version applicability separate. A failed journey can be exercised coverage; a reused pass is not new execution. Verification still requires the consuming workflow's positive trace, not an index label.

## Compare before reuse

Before choosing the next route, identify what was actually exercised and what the current target changes. Relevant differences can include entrypoints, configuration loading, dependencies, build settings, resolved artifacts and runtime conditions. File lists are leads, not proof of unaffected behavior. A shared component or changed SHA alone does not require redoing every old journey.

Record a separate applicability judgment for each coverage boundary relevant to the current task and target: reusable with its comparison basis; needs affected revalidation; or not yet assessed because the relevant comparison is missing. Reuse preserves the observation's original execution date and SHA. Prioritize comparisons and reruns that can change the current batch selection, conclusion or active finding. Unrelated historical coverage can retain its recorded version and unknown current applicability.

A source/history gate can postpone the comparison without erasing direct observations. Same source with a different artifact is not automatically reusable; a new source revision with only unrelated changes is not automatically invalid. When correspondence cannot be established, use a bounded fresh execution if needed and feasible, or preserve the exact unresolved check.

## Merge without losing history

At each substantive checkpoint, save the batch evidence, reread the current index, and merge by outcome and comparable mode/conditions:

- Update only the boundaries actually exercised. A new ESM run leaves the CJS observation at its original revision. New depth or another mode extends the object instead of duplicating it for every commit.
- Retain the historical batch links. Repeated results can have a compact index entry, but do not overwrite irreplaceable failed specimens or earlier version-bound observations. Correct a mistaken historical claim explicitly with dated evidence and rationale.
- Keep conflicting observations visible. Compare source, artifact, configuration and environment before asserting a regression or intermittent failure; unresolved conflicts retain both results and a discriminating next action.
- A later pass supports the exercised acceptance boundary, not automatic closure of a broader finding. Link the primary problem account rather than duplicating its current judgment.
- Preserve stable links when names change. If the outcome boundary splits, link the old observations to the resulting boundaries with their actual scope instead of silently reassigning evidence.
- Use a unique batch path when names/dates collide. Integrate concurrent changes from the reread; if a merge cannot be completed safely, save the independent batch and mark index integration pending rather than overwrite another writer.

For example, A verifies ESM and CJS; B verifies only ESM; C's source comparison supports reusing B's ESM evidence. The index retains ESM actual execution at B with a separate C applicability judgment, and CJS actual execution at A. It never labels the whole library outcome freshly verified at C.

## Save and verify the checkpoint

While an independent history gate is closed, save only the unique provisional batch and its evidence; defer result-bearing index reads, merges and navigation updates until the gate opens. Mark that reconciliation gate-pending, not a failed write.

Initialize the active batch after target/scope selection; save each completed group or material observation, pause and final result through the [save checkpoint](working-records.md#save-and-commit-a-checkpoint).

Once the history gate permits index reconciliation, verify the saved checkpoint from the reader's entrypoint:

1. Open the project README. Put its coverage entry beside equivalent project-navigation links, then follow README → coverage index → batch evidence.
2. Match every outcome or mode in the current batch, including partial and blocked work, to an independently readable index entry. Check its result and execution identity against the saved trace using the [identity and minimum content](#identity-and-minimum-content) contract. Confirm that the entry distinguishes actual execution, applicability and remaining work. Compact groups pass only when each boundary remains distinguishable.
3. Follow the retained historical batch links and check that the merge preserved unaffected modes and their original observations. Known older batches may remain dated navigation links; import only the history relevant to the current selection.

For example, “library consumption passed” is insufficient when ESM passed and CJS was blocked. The index must expose both modes and lead to their respective evidence and next actions, even if they share a row.

Accept index reconciliation only when all three checks pass. Otherwise repair the mismatch or record the exact pending integration and resumption condition. Preserve unchanged overview entries and problem counts. In the audit handoff, link the project coverage index and current batch. These checks establish usable navigation and correspondence to saved evidence; they do not independently prove that usage occurred.

Check persistence separately from usage and assessment. A pause stops further product use; retain returned evidence and the next step. Missing authority or destination, failed writes, or unsafe index integration leaves an exact pending update, reason and resumption condition. Preserve necessary evidence within existing authority before cleanup and report retained resources. A successful journey remains observed even when its save is blocked, but the record loop remains incomplete.

Commit only under configured authority, preserve unrelated edits, and report saves, local commits and pushes separately. Every no-finding audit follows the same persistence checks as an audit with findings.
