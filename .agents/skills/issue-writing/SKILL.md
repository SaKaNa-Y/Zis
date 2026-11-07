---
name: issue-writing
description: Clarify an idea or problem and help write, revise, and retain an issue draft for the user to submit.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.02"
---

# Issue Writing

Help the user think through an issue and express it in their own terms. Start with a rough idea, an existing discussion, or a draft. Work at the depth the current request needs. A sentence edit needs a sentence edit, not a new interview.

This explicitly invoked skill ends with discussion or a draft for the user to use. Keep tracker access read-only. Do not create, submit, edit, or comment on issues, change labels or state, or offer a publication approval step. Local draft saving follows step 5. Product implementation and PR writing belong to other tasks.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Recover the current intent

Read the available conversation, supplied material, and latest draft. Carry forward accepted wording, decisions, examples, and open questions. Identify what the user needs now: help thinking, a first draft, a focused revision, or a complete current version.

For a new draft, establish the intended audience and the response the user wants. Distinguish an invitation to discuss an idea from a defect report or a request with settled acceptance conditions. Recover these facts from context before asking. For a local edit, preserve the surrounding draft and work only on the requested change.

Continue when the next useful action is clear. If the purpose remains ambiguous, ask the smallest question that would change that action.

## 2. Clarify only what changes the message

Connect the concrete situation, current behavior, difficulty or opportunity, and desired outcome. Separate observed facts, inferred effects, proposed solutions, and unresolved choices. Help compare meaningful alternatives, while leaving the user's position and commitments to them. Do not invent personal experience, demand, a root cause, or an offer to implement.

Use focused questions or a provisional passage to expose a gap. Explain options and their consequences when the user needs to choose. A proposal can leave its solution open. Return to discussion when writing reveals a material ambiguity, rather than filling it with an invented decision.

Reuse available evidence. When a factual gap affects the text, use a bounded read-only check of relevant repository guidance, supplied links, documentation, or code within the task's access limits. Inspect the applicable issue template and user-supplied examples when available. Issue conventions are distinct from PR and commit conventions. Cite the basis of material claims without treating a title match as proof of duplicate coverage.

When resolving a gap requires deeper investigation, describe the gap and a useful next check. Continue supported writing with that uncertainty, or ask whether the user wants a separate investigation. A writing request does not start a repository audit, reproduction campaign, or mandatory tracker search.

Continue when the current purpose can be expressed faithfully, including any open questions. Complete product design is not a prerequisite for an initial suggestion.

## 3. Shape the draft for its purpose

Follow the destination's required fields and the user's requested format or example. Select content by what the reader needs to understand or decide:

- For an initial suggestion, explain the situation, the gap, the proposed direction, and questions worth discussing.
- For a defect report, retain the trigger, expected and actual behavior, available reproduction evidence, and impact.
- For an implementation request, state the intended outcome, scope, acceptance conditions, and behavior to preserve.

These are content guides, not mandatory headings. Keep unknown fields honest. When destination guidance is unavailable, provide a provisional draft and name the limitation without claiming conformity.

Keep conditions that change the proposal's meaning, even in a short draft. Detailed design can remain in an existing supporting record. For example, omitting button placement can simplify a query-sharing proposal, while omitting the link between a result and its original query changes the capability.

Present a copyable title and body when the user asks for a complete draft. For a focused edit, return the changed passage at the requested scope. The draft is ready when its claims match the available evidence and choices, and its detail serves the current purpose.

## 4. Revise from the latest version

Apply each correction to the latest draft and accumulated user decisions. Preserve accepted content outside the requested change, including parentheses, tentative language, and the author's voice. Translation and shortening preserve scope, conditions, and certainty.

If requested wording changes a factual claim or commitment beyond the evidence, explain the specific difference and offer the smallest faithful alternative. Present optional wording as an alternative until selected. An unselected alternative does not replace the current draft.

Finish the revision when the requested change is present and unaffected meaning remains intact. Ask further questions only when their answers change this revision or the user's position.

## 5. Deliver and retain the current draft

Without an established saving request and destination, deliver in the conversation. Reuse an existing agreement to maintain a local draft without asking again. Each time you deliver a complete current version under that agreement, synchronize it to the agreed file and read it back before reporting it saved. A snippet or an unselected alternative does not overwrite that file.

Before saving, read the current file and reconcile external edits with the conversation's latest accepted changes. Preserve unrelated content. If the file and conversation contain conflicting decisions, resolve that conflict before overwriting it. Keep the agreed title and body together or in their established locations.

Keep detailed engineering decisions in their existing record. Pure wording changes belong to the draft. If discussion changes an engineering decision, identify that change for the active record owner in the conversation. Record maintenance belongs to that separate workflow. This skill creates no automatic engineering log or Git commit.

When saving fails, deliver the complete text in chat and name the pending destination and limitation. Finish at the requested scope: a discussion outcome, a revised passage, or the complete current draft. Report save state when an agreed local file is involved, without a submission prompt. The user decides when and where to use it.
