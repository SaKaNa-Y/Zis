# Working record presentation

Use these templates when creating or updating working-record navigation and current summaries. The [working-record contract](working-records.md) owns identity, evidence, lifecycle and checkpoint rules. Apply one template per directory role; retain historical evidence and test fixtures as evidence rather than rewriting them to match navigation.

## Root overview

Keep the repository purpose, reading instructions and a Projects table:

`Project | Findings | Improvements | Explorations | Archived records`

Link each project name to its README. Each category column counts its active items, including deferred work. Archived records count all archived items. Count each indexed identity once. In a legacy store with several items in one file, use their individual entries. Keep item-level conclusions in the project overview and primary record.

## Project overview

Start with the project title, repository link and link to the root overview. Use this section order in every project:

1. Findings
2. Improvements
3. Explorations
4. Archived records
5. Coverage and supporting material

Keep empty sections and write `None recorded.`. Active items use:

`Item | Current assessment | Handling status | Next action`

Archived records use:

`Item | Type | Outcome and reason | Related delivery`

Link each Item to the current summary of its independent primary record. Type is the item’s category at archival. State whether the accepted problem or outcome is resolved and why the item was archived in Outcome and reason. Use a concrete explanation such as `Resolved: first migration preserves workspace membership; applicable verification covers the accepted scope.` or `Not implemented: user chose the existing manual workflow.` A bare `Archived`, `Done` or `See record` leaves the reason missing. Keep detailed dates, acceptance evidence, limitations and reopening conditions in the primary record.

Coverage and supporting material links the existing usage and exploration indexes. Link a support packet here only when it supplies a distinct navigation need. Primary records and coverage indexes own their detailed evidence links. Keep batch narratives, assessment history and repeated aggregate counts out of the project introduction. A coverage index is optional when no coverage account exists. The project README owns the item inventory.

## Delivery notation

When a recorded relationship affects submission, include its reason with the relevant item, such as a shared fix, separate acceptance, or a suggestion discussed on another PR. In active rows, place delivery with Handling status; in archived rows, use Related delivery. Give each PR a clickable link and its last verified state: draft, open, merged or closed without merge. For several PRs, state each role, such as `Fix: PR #123 (merged); documentation: PR #124 (merged)`. Record the check date, provenance and covered acceptance in the primary record. Distinguish merged changes from released or deployed behavior when that affects the outcome.

For work without a PR, state the actual route: a linked commit, local implementation, an existing alternative, an assessment without repair, or no implementation selected. An unknown link or state stays explicitly unknown or last-known. Formatting work reuses dated evidence; it does not refresh remote status.

## Current summary

Keep one top-level Current summary for the single problem or opportunity in each primary record. Include its next action and applicable evidence links. For each archived item, explain:

- **Outcome and reason:** whether it was resolved, satisfied by an existing alternative, left unimplemented by decision, excluded after assessment, duplicated or superseded; explain why active follow-up ended.
- **Decision basis and date:** the user decision or acceptance evidence supporting archival, with its recorded date. The editor is not automatically the decision owner.
- **Delivery and verification:** linked PRs or other changes, each covered scope, and decisive evidence. Existing applicable verification may suffice.
- **Remaining scope and limits:** unverified claims, excluded scope and links to independent remaining problems.
- **Reopening condition:** a short condition relevant to this outcome, when known.

Preserve missing historical reasons, decision owners or dates as `Not recorded` or `Pending verification`; a documentation update date is separate from the actual archive date. Missing metadata alone does not reverse an existing archive decision. If summaries disagree, reconcile their evidence before choosing a conclusion.

Put superseded assessments under History and label old status headings Historical status or Historical handoff. Retain dated observations, decisions and evidence. Update incoming heading links when renaming headings; preserve source artifacts and fixture contents. Historical recommendations describe their own checkpoint, not current instructions.

## Evidence guide

An authored evidence README uses Scope and related records, Artifacts, Replay, and Results and limits sections. Identify the supported records, artifact roles, recorded execution conditions, replay entry point, observed results and limitations. Distinguish actual execution, source assessment and unpublished drafts. A batch with no finding links its coverage entry instead of inventing a primary record. Link an existing detailed account rather than duplicating it; explicitly state unavailable replay inputs. Historical snapshots, imported evidence and deliberately broken test fixtures retain their original contents. Their enclosing guide supplies navigation.

## Check the saved result

Read the saved primary summary and derive its project row from it. Compare the lifecycle, resolution claim, archive reason and delivery links between them, then reconcile affected root counts. Verify local links across the complete candidate tree, including unchanged incoming references to renamed headings. A complete checkpoint has consistent summaries and counts, valid navigation, and explicit evidence gaps; document edits make no new product-verification claim.
