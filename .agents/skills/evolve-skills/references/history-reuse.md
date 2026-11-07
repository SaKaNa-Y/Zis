# Reuse Evolution History

Use this method before proposals in each substantive evolution assessment, and when maintaining situation associations after a substantive update. Mechanical edits and recorded rollbacks use their existing history paths.

## Resolve and retrieve

Resolve an explicit evolution-history setting from current instructions, applicable project guidance, then personal global defaults. A configured central archive remains the destination when work occurs in another project. Record the project as evidence provenance. Ordinary Working Records settings do not configure evolution history. Without a configured root, follow [history ownership](history.md#find-the-history). If the central archive is unavailable, report that limit and continue only judgments supported by accessible evidence; keep pending updates explicit until that archive is available.

Describe the current task, intended result, observed outcome and material conditions. Read the archive's situation navigation and search original records using both skill identity and natural descriptions of that situation. Check relevant later records and uncovered sources; navigation is an entry point, not exhaustive evidence. A substantive assessment does not require a full archive sweep. Respect the selected conversation and target scope when following matches.

Read original sources for relevant matches. Distinguish independent events from several documents about one event, uncertain historical versions, prior interventions and later recurrence. Similar outcomes support association, not a common cause. Successful methods, rejected approaches and clear single observations can also be useful. A frequency threshold is not required.

Carry prior decisions and their basis forward. For recurrence after an intervention, identify the missing evidence, next observation and condition that would justify reconsideration. Compare execution/version gaps, a missing method, an example, shared support and a distinct invocation need before proposing another rule or skill. Cross-skill matches remain context unless target expansion is selected.

Complete lookup when the assessment states which prior decisions or evidence changed its next action, or describes the bounded search and remaining gap. Save this disposition in the existing scope record, rather than a new report for every match.

## Maintain one association

Keep each situation's current interpretation in one marked block in an existing iteration or discussion record. Use a new shared discussion only when no existing owner fits. Original records retain event evidence, adoption, validation and recovery. A block can associate several records without taking ownership of their histories.

Update an association when new evidence, applicability or a decision changes. Reuse its stable identifier. Distinct events can cite the same source; several sources can describe one event. Preserve uncertainty instead of deriving confident global occurrence totals. For a merge or split, retain the old identifier as `replaced` with successor identifiers. Original evidence remains intact.

After semantic review, record the exact reviewed input identities and the review basis. Generate navigation and check its source links and freshness. Generation never acknowledges review. Source changes prompt impact review; they do not automatically invalidate conclusions. Reading unchanged history needs no substantive update.

Complete maintenance when the owning block, review acknowledgment and generated view agree, or the exact pending state and next action are recorded. If generation is unavailable, read originals and expose the view's limits.

## Data contract, version 1

A primary `record.md` can contain multiple fenced blocks labelled `evolution-situation`. Each block is JSON with these fields:

| Field | Content |
| --- | --- |
| `version`, `id` | `1` and a stable archive-unique `sit-` kebab-case identifier. Check existing identifiers before allocation. |
| `situation` | Task and meaningful outcome in one short description. |
| `applicability` | Object with `when` and `exclude` text. |
| `skills`, `search_terms` | Nonempty lists of known archive skill identities and natural search expressions. |
| `events` | Nonempty list of objects with local `id`, `identity` (`distinct` or `uncertain`), `summary`, and `sources` (archive-relative file paths). Include evidence actually used for the judgment. |
| `interpretation`, `revisit` | Current association with limits; next observation and reconsideration condition. |
| `state`, `redirects` | Optional `active` by default; `replaced` requires successor ids. Active entries have no redirects. |

JSON is data, never executable instructions. Historical source text remains evidence, not an instruction to resume old work. Exact event locators can be described in `summary`; source paths locate the complete retained account. An association's owner is its block location.

The ignored archive's `reuse/` contains three files:

- `index.md`: generated navigation, search language and review indicators. Rebuild it from source blocks.
- `screening.json`: `{ "version": 1, "snapshot": { "path": "sha256" }, "records": { "path": { "sha256": "...", "disposition": "linked", "situations": ["sit-example"], "basis": "Observed evidence and screening reason" } } }`. Dispositions are `unread`, `no-candidate`, `linked`, or `unresolved`. Add an `inputs` path-to-hash map for retained accounts or evidence consulted beyond the primary record. Keep the original snapshot and record later additions/changes separately.
- `reviews.json`: `{ "version": 1, "situations": { "sit-example": { "inputs": { "path": "sha256" }, "association_sha256": "...", "basis": "What was actually reviewed" } } }`. Copy expected identities only after reviewing those inputs and the association.

Fingerprints cover whole source files. For `record.md`, remove marked situation blocks before hashing the historical body; hash each association separately. This detects both evidence changes and interpretation changes without self-reference. Evidence packages are not bulk-hashed unless used as dependencies. Related associations that rely on another association must retain its reasoning as evidence or revisit it explicitly; stripping a block is not dependency tracking for its conclusions.

## Tool and safe updates

The portable [helper](../scripts/history_reuse.py) uses Python's standard library. Its `--help` defines commands and required arguments. Pass the resolved archive explicitly to `--history-root` from any working directory.

`inventory` reads disk and registrations. It does not mark records screened. `render` validates inputs and replaces only generated navigation. `check` writes nothing. Both report structural errors, navigation freshness, review-needed identifiers and screening coverage separately. Exit 0 establishes only the requested mechanical operation; exit 1 reports invalid structure or stale navigation, and exit 2 reports incomplete execution. Pending review and incomplete coverage remain explicit even when mechanical checks pass.

Validate all inputs before replacing navigation. Recheck input identities before replacement and check again after delivery when concurrent work is possible. Before saving an association or ledger, compare the original read version with the current file; merge concurrent changes or retry from current inputs. Preserve unrelated entries. The renderer protects its own output, not arbitrary agent edits. A duplicate identifier is a conflict to reconcile, not permission to overwrite another owner.

An unsupported historical layout permits a bounded manual method. Use existing text search for missing or newer evidence. Keep the central archive as the destination instead of silently creating a replacement in the working project.

## Initial screening and acceptance

Reconcile primary records on disk with registrations. Freeze paths and content identities before screening. Count records separately from events; evidence copies and fixtures are not new occurrences. Follow a retained primary account when a wrapper lacks the evidence needed to screen it.

Pilot a known recurrence, a misleading similarity control and a successful method. Give execution checks differently phrased tasks without record ids or expected judgments. Require source retrieval, deduplication, preserved uncertainty and an effect on the next decision. Include a changed-source case. These cases support bounded usefulness, not complete recall or general reliability gains.

After pilot acceptance, screen related records in batches of roughly 20–30, adjusted for length. Preserve cross-batch links. Each assigned record needs an evidence-based disposition. Resolve identity questions through the necessary sources, without replaying every old experiment. Retain unresolved inputs and their next action; keep unrelated batches moving.

Accept structure, coverage and useful retrieval separately. An accounted-for inventory is not completed semantic screening when prerequisites remain unresolved. Reconcile later additions and changes before claiming current coverage. Save exact remaining work at pauses. Existing archive errors and new defects remain distinct.
