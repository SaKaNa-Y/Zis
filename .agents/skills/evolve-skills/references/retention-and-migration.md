# Retention and Migration

Use this reference at iteration closure or pause, before cleaning an execution environment, when sanitizing evidence for publication, or when migrating existing history. The source repository's established storage policy determines which summaries are tracked and where detailed records remain local; unspecified projects retain the private default in [history and recovery](history.md).

## Retention and checkpoints

Retain decisions, meaningful alternatives and reasons, actual results and limits, necessary evidence, and recovery material for applied changes. Failed experiments and No Change outcomes can explain important decisions. Preserve shared evidence once and link affected records to it. Every iteration must remain understandable; not every historical trial must remain runnable forever.

Keep execution copies, caches, dependency installations, repetitive outputs and intermediate candidates in `.scratch/skill-evolution/<work-id>/` or the established temporary location. A full transcript is not a default deliverable. Retain minimal excerpts and provenance needed to substantiate conclusions. Preserve historical outputs even when the environment can be rebuilt: a rerun does not recreate the original events.

When a necessary input cannot be obtained again, extract that input and its provenance before cleanup. Prefer a package, patch, source revision or bounded fixture over an entire environment. If the environment cannot be reduced safely, present its purpose, size and release condition for a specific retention decision. File age, name or size alone does not authorize deletion.

At completion, abandonment or a supported No Change outcome:

1. Finalize the decision, actual changes, work status, adoption and validation states, limitations and follow-up. Keep their meanings separate.
2. Retain the evidence and exact recovery inputs needed by the record. Verify evidence-package identities after relocation and check the recovery method under [history and recovery](history.md).
3. Check the complete durable tree for broken navigation and dependencies on temporary or local-only files. Confirm recoverable Git objects actually contain the required states; identifiers alone are insufficient.
4. Select public summaries separately from detailed local retention; include only evidence needed to understand the public conclusion. Review the exact candidate file list under the publication policy. Clean only task-owned material confirmed to be reproducible and no longer required. Preserve unresolved unique inputs with a stated disposition.
5. Report the record location, retained gaps, remaining temporary or quarantined inputs, and actual local save, commit and push states. Follow existing authorization for each Git operation; a saved record is not a remote backup.

Apply the same saving boundary at substantive decision checkpoints, combining wording-only updates with the next substantive update. Repair relevant stale references when reopening a record without launching an unrelated full-history audit.

## Pause and resume

A pause checkpoint retains scope, selected decisions and preserved behavior, work completed, the current candidate, actual checks and outputs, open questions, blockers, and the next action or resumption condition. Identify unique temporary inputs and why they remain necessary. Stop task-owned processes and remove confirmed reproducible environments after preserving required inputs; retain unsaved work.

Use explicit work states: active, paused, blocked, abandoned or completed. Pause does not mean rejection or validation failure, and elapsed time does not mean abandonment. On resume, read the saved decisions, compare the current source with the saved baseline and reconcile subsequent edits before applying a candidate or restarting the affected checks.

## Sanitization

Before tracking or publishing records, inspect prose, scripts, patches, structured logs, archives and filenames for credentials, unrelated personal content and unnecessary machine-specific details. Prefer repository-relative paths in current navigation. Automated scans identify review candidates; they cannot prove that a record contains no sensitive information.

Label sanitized evidence as a derivative, describe the removed or generalized material, and compute its own integrity information. Preserve original verification claims with their original scope; a derivative is not an exact original or an exact recovery snapshot. If safe publication removes necessary evidence or recovery content, state that limitation and keep the necessary original in the agreed ignored quarantine pending disposition. Do not claim complete recovery from sanitized files that no longer reproduce the original state.

## Migration and quarantine

Use `.local/skill-evolution-quarantine/` unless the project establishes another location. Keep it separately ignored from the ordinary temporary workspace, outside formal history. Its `manifest.json` accounts for each retained item's original path, current location, reason, size, content identity and unresolved disposition. Group external histories under `external-skills/` and uncertain or unsafe material under `unresolved/`. An ignored unique copy is not backed up through repository commits or pushes. Quarantine is a pending decision, not a permanent unclassified archive; final transfer or deletion follows the applicable authorization. Move resolved retained material into the detailed local archive and retain disposition mappings; close the quarantine when no decisions remain.

Migrate in related batches:

1. Inventory source material, ownership and dependencies. Distinguish retired repository skills from external skills that never belonged here. Establish an old-to-new path mapping, including retained, temporary and quarantined material.
2. Assign locally unique sequence numbers in recoverable historical order. Keep uncertain dates and outcomes explicitly unknown. Move standalone discussions and `_scopes` accounts to `discussions/`, linking affected per-skill records.
3. Move records with necessary evidence and recovery inputs. Preserve integrity-bound package layouts and original paths inside snapshots; use the mapping to explain them rather than rewriting historical content.
4. Check contents, navigation, identities, state and recovery dependencies. Record sanitation and pre-existing gaps; migration neither supplies missing historical proof nor upgrades validation claims.
5. Review the candidate Git file list for sensitive content and oversized or environment files. Export the complete candidate tree to a clean directory and run the applicable documentation and history checks there, including unchanged reference sources. Do not rely on hidden local files to satisfy tracked-history checks.
6. Remove superseded locations only after their contents and unique dependencies are accounted for. Report record counts, cleanup size, quarantine items, unresolved historical gaps, and actual save, commit and push states.

Acceptance requires accounted-for sources, the agreed structure, correct ownership and lifecycle links, valid navigation, retained content integrity, explicit derivative and history limits, and available recovery inputs where claimed. Rerunning every historical trial is unnecessary. New missing files or broken references are migration defects to repair. Main migration can finish with explicit quarantine decisions outstanding; overall cleanup then remains incomplete.
