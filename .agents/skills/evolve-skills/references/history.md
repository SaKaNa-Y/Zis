# History and Recovery

Use this reference when consulting earlier evolution, preparing a candidate, recording an outcome, or carrying out a requested rollback. Records explain what changed and support reversing the specific iteration; they are not a transcript archive.

## Find the history

Resolve an explicit evolution-history root from current instructions, applicable project guidance, then global defaults. A configured central archive is reused across working projects; ordinary Working Records settings do not override it. Resolve the target's verified source repository, identity and the selected archive's ownership and publication policy. Resolve the detailed-record location separately from the public-summary location. Without a configured root or project policy, prefer ignored `.local/skill-evolution/skills/<current-skill-name>/`. For a standalone installation without a source repository, establish a persistent location before candidate preparation and reuse it thereafter. Keep each independent history associated with the skill's verified source identity. For this collection, the owning skills repository can hold that history even when evidence comes from work in another project. External skills can supply context; their own histories belong with their established source, not the repository where they happened to be used.

Generated history is private when no project or user policy says otherwise. In that case, use a narrow ignore rule for the history root, check both ignore behavior and tracked files, and report that ordinary pushes do not preserve ignored records. An ignore rule does not untrack files or erase published history. Where a project publishes summaries, retain the full account locally and select only adopted changes or maintenance decisions with public value. Review the exact summary and necessary evidence before staging; sanitization alone is insufficient. Public summaries must work without private links or inputs. Keep sequence identities across local and public records, allowing gaps in the public index. Resolve sensitive material in already tracked paths without assuming authority to rewrite history. The policy applies to indexes, evidence and recovery payloads alike; source instructions and reusable templates remain shareable.

Keep `README.md` at the history root as the navigation guide. Where situation navigation is enabled, link its generated view and follow [history reuse](history-reuse.md) for association ownership, screening and review metadata. Give each skill an `index.md` identifying its declared name, repository-relative source path, known separate installations, lifecycle status, and rename or successor relationships. Use relative source paths in public navigation; retain machine-specific locations only when necessary and permitted by the storage policy. Update the history directory, index, current source paths and navigation together on rename. Preserve old names in historical prose and original snapshots. An unrelated reuse of a retired name starts a distinct identity.

Retired and transferred skills keep their histories under their last names, with the reason and successor or destination links. Separate their navigation from active skills. For splits and mergers, retain earlier records with their original owners and link the successors; store a shared decision once in `discussions/`. A continuing skill can absorb another without inheriting or duplicating its earlier records.

Read the index first, then relevant iterations. Continue the same hypothesis in its existing directory across dates; a distinct hypothesis or later adoption gets a new linked iteration. Preserve prior outcomes when appending evidence or recording reversal. Allocate a locally unique sequence number and descriptive topic within each parent, such as `001-record-organization/`; dates belong in the record, and matching numbers do not establish relationships.

```text
<history-root>/
  README.md
  skills/<current-or-last-skill-name>/
    index.md
    001-topic/
      record.md
      evidence/                   # necessary evidence only
      recovery/                   # affected-file patches or snapshots
  discussions/001-topic/
    record.md
    evidence/                     # shared necessary evidence, if any
```

Create optional directories only when needed. Preserve relative paths inside recovery snapshots and integrity-bound evidence packages. Record relevant additions, deletions, file types, modes and symlink targets; give resources outside the skill an explicit path mapping. History itself stays outside the target's recovery payload. Legacy package layouts can remain intact inside `evidence/` or `recovery/`; structural consistency does not justify invalidating their recorded identities.

At a completion, abandonment, no-change or pause checkpoint, use [retention and migration](retention-and-migration.md) to finalize state, check durable dependencies and clean task-owned temporary material. Read that reference also before migrating records, publishing sanitized evidence, or deciding whether to retain an execution environment.

## Screening and proposed skills

For repository screening and shared discussions, use `<history-root>/discussions/<NNN-topic>/record.md` under the established storage policy. Reuse an existing scope record for the discussion. For a collection spanning repositories or a proposal without a source repository, reuse an agreed history root or establish a recording location independently of the future skill source. Continue permitted analysis while a recording-location decision is pending, retaining the unsaved account explicitly.

Record the evidence, skills screened, candidates and limits. If screening yields no candidates, close this account as screening complete with no relevant opportunity found in the supplied evidence. Per-skill indexes and deep no-change assessments are unnecessary for that result. Existing skills entering deeper assessment receive their own records linked to this account.

Keep a proposed skill with no agreed source location in the scope record under a stable provisional identifier, with its responsibility, evidence, closest alternatives and open decisions. Source identity and baseline remain unresolved; record file absence only after inspecting an agreed destination. This permits proposal discussion and deferral before source selection.

Once the user selects a new skill and its destination, inspect the path, reconcile any existing contents and create its per-skill record linked to the provisional entry. Preserve the actual baseline before candidate preparation, including verified absence where applicable. Include newly created resources and changes to existing references in the recovery mapping. Preserve the provisional identifier and decision links rather than starting an unrelated history.

## Current scope for longer discussions

For evolution spanning multiple discussion rounds or targets, keep one compact current scope index in the applicable scope or iteration record. It points to evidence and decisions rather than copying the conversation. A small single-edit review needs no separate index. For a shared discussion, link each target's history to this same index; co-active discussion methods use it as their shared decision frontier.

Keep the following current as user decisions or work state change:

- Each target and candidate, distinguishing selected, open, explicitly deferred and rejected items.
- The user's decisions and source pointers, including preserved behavior and agreed validation.
- Remaining questions, dependencies, and the next action or condition for pending work.
- Co-active methods and the instruction or artifact pointers needed to resume them.
- Adoption and validation status, with links to implemented changes and supporting results.

On resumption after an interruption or context loss, and before candidate preparation, read this index and recover the relevant original decisions and method instructions. Reconcile newer user input and artifacts against those decisions; update only the affected branches. Carry settled choices forward. An omission from a summary does not cancel an item, and an open question stays open until a decision changes it. Historical drafts remain evidence of earlier states, not authority over a later decision. If evidence is unavailable, retain the uncertainty and seek only the decision needed to continue affected work.

The index is ready when every candidate has an evidence-backed disposition, selected work has an identified target and validation basis, and pending work has a next action or condition. During implementation and closure, link each selected item to its actual change or explicit pending outcome. Keep one current index while retaining earlier evidence through pointers; per-target records remain the authority for their exact changes and recovery payloads.

## Reconcile changes since the last run

Identify the most recent recorded active state, including applied trials and completed rollbacks. A later candidate, rejection, or no-change review does not replace that state. Compare it with the actual target files and relevant supporting resources before proposing a new change. Use the recorded versions, snapshots, or manifests to distinguish known differences from paths whose older state is unavailable.

When differences exist, preserve an External Change entry connecting the recorded state to the current baseline. Capture the known before/current states, affected paths, recoverable diffs or commits, and evidence limits. Git history can recover committed states; snapshots may recover endpoints. Neither proves an unrecorded edit sequence, its motivation, or successful validation. Describe only the net change when intermediate states are missing. External Change entries describe changes already present, not edits performed or endorsed by this run.

If no earlier state is available, establish an initial baseline and mark the earlier history unavailable. Persist the reconciled baseline and gaps in the selected target's history even when the review pauses before a change is selected; target edits still wait for selection. For older partial records, identify comparison coverage and unknown paths rather than claiming the whole skill is unchanged. Do not infer unseen changes merely because a version record is absent. Reconcile only the selected targets.

Preserve a current-state manifest with the baseline and after each actual state transition: target-relative paths, file types and relevant modes, content identities, and references to recoverable content where available. Include the target's instructions and supporting resources, recording the scope for external dependencies; exclude generated history. A manifest detects later changes but cannot recreate missing contents. Reuse unchanged payloads or reliable Git references; snapshot recovery remains scoped to the files actually changed by the iteration.

Continue from the reconciled current baseline. Pending patches based on an earlier state need reconciliation and affected validation before adoption. Record gaps honestly; continuous capture while this skill is inactive is outside this workflow.

## Index template

```markdown
# <Skill name> Evolution

Source: <repository and relative skill path, or standalone origin>
Installations: <known separate copies, or none identified>
Lifecycle: <active / retired / transferred; reason and successor links where applicable>
Names: <current name and historical rename relationships>
Current state: <latest known active state and manifest; comparison coverage and gaps>

| Entry | Kind | Date | Purpose or observed change | Adoption | Validation | Record |
| --- | --- | --- | --- | --- | --- | --- |
| <id> | <Evolution / External Change / Baseline> | <date> | <short outcome> | <state or not applicable> | <state or unknown> | [Details](<id>/record.md) |
```

Track adoption and validation separately. Useful adoption states are Proposed, Candidate, Applied, Rejected, No Change, Superseded, and Rolled Back. Validation can be Not Run, Pending Validation, Supported, Unsupported, or Inconclusive. Record the scope and basis of a Supported result; it is not a claim that all future uses improve. An explicitly selected unverified trial is Applied / Pending Validation.

Baseline and External Change entries record observed states; adoption by this workflow is not applicable and historical validation is unknown unless evidence establishes it. Update the current-state pointer when accepting a reconciled baseline, applying a change, or completing a rollback. Preserve earlier entries and their outcomes.

## Iteration record template

Use the following as a substantive record, replacing placeholders with observed facts and omitting inapplicable subfields. Detail should let a maintainer without the conversation understand the change, assess its evidence, and recover the earlier state.

```markdown
# <Iteration id>: <Change intent>

## Identity and state
Created and updated dates; skill identity; actual edit target; source and installation relationship.
Entry kind; previous active-state reference; external-change reconciliation and gaps.
Work state (active, paused, blocked, abandoned or completed); adoption and validation states; related prior or subsequent iterations.
Historical skill version if known; actual pre-change baseline and candidate identity.

## Purpose and source evidence
The target's intended outcome and relevant boundaries.
Conversation scope and retrieval limits; references to relevant turns, tools, or artifacts.
The user's task, meaningful actions or adaptations, feedback, and observed result.
For external learning: original source links and access limits, the specific borrowed idea or case evidence, the proposed adaptation and its connection to the target. Distinguish source claims, inference, and demonstrated results.
Minimal excerpts or reproducing details needed to understand the opportunity.
Separate facts, inference, and unknowns; identify contributions from co-used skills.

## Hypothesis and decision
The opportunity, proposed change, and why it may improve the target's purpose.
Applicability conditions, personal preferences left in usage context, and whole-method findings.
Intended value and sufficient evidence per material change; preserved behavior, alternatives, and trade-offs.
The user's selection and scope; deferred or rejected alternatives and reasons.
Links to earlier attempts and the new evidence supporting any revisit.

## Exact changes
Affected paths and before/after behavior; relevant instruction or resource differences.
Links to the exact patch, version references, or snapshots, including added/deleted files.
Actual target files changed; separate candidate-only work and installed-copy updates.

## Validation
Criteria and scenarios; baseline and candidate versions; actual runs and outputs.
Source synthesis and artifact review; behavioral comparisons and transfer probes when required by the claim.
Structural checks separately; regressions, limitations, and checks not run.
Supported benefit or uncertainty within the tested scope.
For blocked validation: attempted checks, missing prerequisite, and resumption condition.

## Recovery
Recovery method; baseline identifier; payload locations; path and file-state mapping.
Post-change identity needed to detect later edits.
Current-state manifest and the scope of states recoverable from retained content.
Specific procedure to reverse only this iteration and verify the restored state.
Whether recovery was exercised, what was checked, and any remaining limitation.

## Follow-up
Pending evidence, conditions for revisiting, and next action.
Append later results and link superseding or rollback iterations without erasing the original.
```

Follow the [sanitization rules](retention-and-migration.md#sanitization) before publishing excerpts or payloads. Keep evidence pointers with enough context to understand their meaning if the original conversation is inaccessible. Sensitive recovery material needs an appropriate private location; its absence must not be described as complete recovery support.

## Preserve the actual baseline before changing it

Git is sufficient only when a recoverable revision contains the exact pre-change states of the affected files. Confirm that relationship for those paths; the presence of `.git` or a clean-looking final diff is insufficient. Record the repository and full revision, precise candidate patch, relevant paths, and post-change identity. Verify that the referenced objects and patch are available. A version label alone is not a recovery payload, and an uncommitted baseline is not represented by `HEAD`.

When the exact baseline is uncommitted, untracked, unavailable in Git, or otherwise not reliably recoverable, preserve before/after snapshots of the affected files, including explicit absence for newly created or deleted files. An exact file digest can identify a state but cannot replace its contents. Record the path mapping and verify the snapshots match the intended states before relying on them.

This workflow does not require a commit. Use Git references already available or the snapshot fallback; commit, push, and installation operations follow the user's actual authorization. Keep unrelated pre-existing edits out of this iteration's delta.

Before adoption, check that the recovery material is present and usable: for a patch, check its applicability against the captured baseline in a disposable copy and compare the result with the candidate; for snapshots, check contents and the creation/deletion mapping. Report these mechanical checks separately from any end-to-end rollback rehearsal.

## Reverse an iteration when requested

Resolve the requested iteration and target from the index, read its exact recovery record, and compare current files with its recorded post-change state. If they match, reverse that iteration's delta or restore its affected-file snapshots. Restore recorded absence only for files created by that iteration. Verify the resulting state against the baseline and run relevant structural checks.

If later edits exist, preserve them and reconcile the inverse change against the current files. Inspect dependencies on later iterations; when intent conflicts or reversal would remove later work, present the specific conflict for a user decision rather than resetting a directory or repository. Whole-file restoration is appropriate only when it preserves the required current work.

Record the actual rollback as a linked follow-up, update the index, and retain the original iteration and payloads. Distinguish an exact restoration from a reconciled reversal that intentionally retains later changes.
