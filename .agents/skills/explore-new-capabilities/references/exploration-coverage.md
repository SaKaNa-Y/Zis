# Exploration Coverage

Use this account to choose and resume discovery, including batches that produce no opportunity. The [working-record contract](../../assess-findings/references/working-records.md) owns destination, authority, problem identity, freshness and safe saves. This reference owns Explore's coverage and continuation rules. Just retains its separate usage account.

## Identify the explored outcome

Organize coverage around a concrete user situation and intended result. Modules and interfaces help locate it; proposed solutions are leads within it. Match the scenario before allocating a new entry. Split entries only when their intended outcomes need independent judgments.

For example, “an agent needs to understand a pending analysis task” can contain shared-state polling and request-bound progress as separate leads. A successful polling check establishes behavior. An existing progress proposal establishes prior work. Neither observation exhausts that user scenario.

Keep three accounts distinct:

- **Exploration coverage:** compact navigation by scenario, examined boundaries, current judgment and next action.
- **Exploration batch:** what this bounded investigation examined, its evidence, limits and continuation or stopping decision.
- **Opportunity record:** the primary account of a presented capability, its discussion and decisions. Link it from coverage rather than copying its current disposition.

Progress describes the investigation: pending, active, completed or blocked. Judgment describes what it established: a candidate, an existing solution, prior-work coverage or an unresolved question. Use ordinary language where it is clearer than a label. Completed means the stated investigation ended; retain unexamined boundaries and conditions for reconsideration.

## Locate and recover records

Within the configured project directory, reuse established exploration paths. For a new layout use:

```text
README.md
exploration-coverage.md
<date>-<topic>-exploration.md
evidence/<batch>/
<existing-opportunity>.md
```

Link exploration coverage from the project README beside usage coverage. Keep its index and batches independent of Just's `coverage.md` and usage audits. Both can link the same evidence. Exploration batches and coverage entries do not increase item counts; those counts follow primary problem and opportunity identities.

Read the index and relevant batch evidence before choosing routes. Compare the actual scenario, constraints, inspected capabilities and relevant prior work with the current task. Retain dated judgments when their conditions remain useful. Reopen only the affected part when new evidence or changed conditions can alter the decision. A new source revision alone supplies neither a reason to repeat everything nor proof that old conclusions still apply.

When older opportunity records or reports exist without an exploration index, import only coverage useful for the current selection. Preserve original dates, versions, limits and decisions, and identify the import as historical organization. An unknown field stays unknown. Creating navigation is not fresh exploration or permission to reopen deferred work.

History gates take precedence over recovery. During an explicitly independent Just audit, save a unique provisional exploration batch without reading result-bearing history or integrating its index. Carry its reconciliation as gate-pending. Once the gate opens, match and merge the provisional coverage. Preserve the actual source/tracker exposure through later batches and workers.

## Keep the minimum useful account

The index points to evidence and decisions. A useful row contains the user scenario and intended result, latest examined boundaries and batch link, current judgment, and next action or reopening condition. Keep independent boundaries distinguishable even when they share a row.

The batch retains:

| Account | Required information |
| --- | --- |
| Identity and scope | Target project; exploration date; relevant source/reference identities and dates; selected scenarios, selection rationale, known exclusions and inherited history gates. Keep the task result and existing-route evidence that guided scope or the first question. If the mapping leaves the initial scope unchanged, retain the reason. Record the actual artifact and execution identity when usage occurred. |
| Examined leads | Question, supporting and contrary evidence inspected or executed, result and its limits. For open exploration, retain the brief basis and outcome of examining existing-task improvements and new tasks, including a route with no candidate or an unexamined boundary. Distinguish documentation, source inference, observed use and community proposals. Preserve successful and failed checks. |
| Judgment and relationships | What each lead establishes, closest existing alternatives, matched prior work and links to any primary opportunity records. For contributions to matched work, retain demand provenance where recurrence matters, the assessed relationship and uncertainty, and covered versus remaining outcomes of a consolidation recommendation. Keep proposed value separate from demonstrated demand. |
| Continuation | Progress, remaining meaningful checks, unresolved prerequisites and next actions. Record why discovery continues, enters one opportunity's discussion or stops, and what can justify revisiting it. |

A record needs enough evidence to distinguish “no independent opportunity found here” from “not examined”. Reading documents can support discovery coverage without becoming verified usage. Link existing execution evidence with its original identity rather than copying logs or claiming a new run.

## Save and resume

Explore owns the record loop even when Just or Yak is absent. Initialize the selected batch before substantive discovery. Save after a material lead judgment, on entering opportunity discussion, and at interruption, blocking or closure. Group incidental notes into these checkpoints rather than writing a transcript.

Execute the shared [save checkpoint](../../assess-findings/references/working-records.md#save-and-commit-a-checkpoint) for saving, index updates, readback, repairs and authorized commits. During its readback, check these exploration-specific relationships:

- README → exploration index → batch → evidence is navigable, subject to the active history gates.
- Each selected scenario's progress, judgment, limits and next action match its batch and any linked opportunity record.
- Material contributions to matched work are reported or explicitly pending, with links to the appropriate primary record when one exists.
- Earlier batch links, unaffected boundaries, prior decisions and independently owned usage coverage remain intact.

On resumption, recover the saved scope, pending checks and actual history exposure. Use the [discovery decision](../SKILL.md#2-find-and-ground-an-opportunity) to choose the next action, then retain that decision and its evidence in the batch.
