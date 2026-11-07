---
name: expand-the-frame
description: Expand a project's decision space through informed questioning, uncovering relevant perspectives, explaining unfamiliar concepts, and tracing the implications of your answers.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.02"
---

# Expand the Frame

Help the user recognize project-relevant questions they did not know to ask, understand the knowledge needed to judge them, and trace the implications of their answers. Improve project decisions and the user's ability to recognize similar questions elsewhere. More questions, agreement with the agent, and additional features are not measures of success.

This is an explicitly invoked exploration and discussion entry point. One invocation lasts through the current discussion until the user ends it. It uses the shared `investigate-with-evidence` skill for factual investigation and controlled execution. It supports an existing project or an unrealized idea and may examine the project's goals as well as its design. The user owns goals and trade-offs; broader agent knowledge is a responsibility to investigate and explain, not authority to decide for them.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Ground the discussion

Establish the intended outcome, affected users, current proposal, the decision under discussion, and known constraints from the conversation and available project material. For an existing project, read its guidance, vocabulary, relevant documentation, and enough source to understand the proposal. For an idea, work from the stated context and label untested assumptions. Ask for missing user-owned context only when it changes which questions are relevant.

Broaden understanding and improve the decision through overlooked perspectives, constraints, opportunities, and defects, including defects in a PR. Apply the same scrutiny to proposals from the user, another agent, and your own earlier recommendations. Correct relevant factual conflicts encountered while investigating a direction and explain their effect on that direction. A sustained test of a specified proposition belongs to the separate `challenge-the-claim` entry point; discovering a conflict does not itself switch this exploration into that workflow.

When the starting point is a pull request, use its stated outcome, diff, tests, and available discussion to ground the proposal. Compare the description’s claimed trigger, cause, and scope with the behavior supported by the diff and tests. Before recommending changes, distinguish an implementation problem, a description mismatch, and missing evidence; these can coexist. Keep the reviewer’s stated concern separate from possible interpretations of it. Follow relevant relationships beyond the diff when they could change a decision; an existing review comment is evidence to examine, not a prerequisite for exploration or an authoritative conclusion.

When a factual uncertainty could change a direction, its options, or the recommendation, use [investigate-with-evidence](../investigate-with-evidence/SKILL.md). Load the installed skill by name, or read its `SKILL.md` when the host has no skill invocation tool. Install both skills together. If it cannot be found, identify the missing dependency and leave dependent investigation pending; continue only directions supported by already available evidence. Reuse established findings rather than repeating their collection. The investigation may use controlled execution; it returns evidence to this discussion without taking ownership of the project decision.

Preparation is targeted: start discussing once the current questions have enough grounding. Later branches can require later investigation; a whole-project audit is not a prerequisite.

## 2. Surface perspectives beyond the initial framing

Look beyond the user's stated question for relevant assumptions, affected people, consequences, and alternative ways to achieve the outcome. Consider technical behavior, user experience, product goals, maintenance, cost, and operation where the project warrants them. Challenge the goal itself when there is a concrete reason; use personal or organizational context only when the user has supplied it.

Trace the affected user’s relevant workflow, including how the state or output created by the proposal is subsequently used. Distinguish the boundary of the original reproduction or implementation step from the boundary of the user’s outcome. Investigate concrete continuations that could change the judgment; a successful intermediate step does not resolve those questions, and a different entry point does not by itself make them irrelevant.

Generate questions from concrete relationships in the proposal. Where a behavior crosses a boundary, examine who should own it and what that boundary protects. Where a new mechanism is proposed, distinguish evidence that it works from evidence that the outcome needs it. Trace whether existing capabilities or information could achieve the same outcome under the relevant constraints. Assess reuse against the conditions it depends on and whether they hold at the new use site. Where something is moved, replaced, or removed, follow its other consumers and the assumptions or promises they rely on, including whether its meaning changes in the new context. For example, a lower average processing time may reflect a shift toward easier tasks rather than faster processing. Comparing the same task types could change a rollout decision. If comparable workloads and conditions already provide sufficient evidence for that decision, a more elaborate analysis would not by itself add a useful perspective. Use the relationships relevant to this proposal; these examples are starting points, not a required checklist.

Connect each finding to an affected use path, an accepted requirement, or a concrete scenario that could change the decision. Distinguish a demonstrated defect from a possible risk, an additional capability, or a different value priority. Keep hypothetical scenarios available for early design discussion with their assumptions explicit. A design preference alone does not establish a defect. Carry each direction’s conditions and current conclusion forward; explain what new evidence changes rather than replacing an answered question with a broader one.

Assess an observed concern separately from a suggested remedy. When a suggestion leaves implementation choices open, distinguish its stated intent from assumptions introduced by your prototype or interpretation. A failure of that implementation constrains the remedy; it does not by itself invalidate the concern.

Bring investigation results back to the decision: explain how the supported behavior changes the direction, its options, or its relevance. Set aside concerns the evidence resolves and retain uncertain ones as uncertain. Defect discovery does not establish comprehensive code-review coverage; describe the paths actually examined. A sound proposal may need no additional questions.

Seek risks, opportunities, and simplification together. Removing a feature or retaining the current approach can be a useful discovery. Select perspectives for their connection to the project and their potential to change understanding or a decision, not to fill a domain checklist.

For each newly surfaced direction, explain:

- What in the project or the user's answer makes it relevant.
- The unfamiliar distinction or concrete situation it introduces.
- What judgment could change by exploring it, and what is still uncertain.

Offer the direction for the user to deepen, defer, or leave unexplored. Surface valuable directions even when the initial proposal is already implementable, but let the user choose further depth. Permission to discuss a direction is not agreement with the agent's assessment or permission to implement it.

## 3. Ask an informed round

Within the directions the user has chosen to explore, maintain a decision tree. The **frontier** contains every material unresolved question whose prerequisites are settled. Present the whole current frontier in one numbered round, then wait for the user's answers. A question that depends on an unanswered question belongs to a later round. Before asking how a mechanism works, establish whether the user wants it: when omitting it is a live option, defer questions that assume it exists. Questions waiting on factual investigation also remain outside the ready frontier.

At an unfamiliar question, explain only the knowledge needed to judge it: use a concrete scenario, define necessary terms, and connect the distinction to the user's project. Expand the explanation if the user needs it; progress does not require a quiz or proof of mastery.

For each question, provide a recommendation with its reason and genuinely viable alternatives with their consequences. Include retaining the current approach, deferring, or simplifying when these are real alternatives. Explain what would favor a different choice; do not manufacture alternatives when facts leave only one viable path, or imply a recommendation is established while material evidence is missing.

Keep each round and its alternatives together in the conversation. Honor the user's requested presentation; when they request inline questions, write them in the message rather than splitting them into selection dialogs. A useful per-question structure is:

> **Qn — Decision or perspective**
>
> Project connection, necessary concept, and a concrete question.
>
> **Recommended approach:** What it means, why it fits, and its cost.
>
> **Other approaches:** The viable alternatives, their trade-offs, and when they fit better.

Let the user answer freely or revise the framing. A recommendation, a preselected option, silence, or a request to continue is not a decision. Carry forward explicit answers rather than asking for them again.

## 4. Derive the next questions from the answers

For each material answer, trace the assumptions it relies on, who gains or bears a cost, where it can fail, and the decisions it creates. Explain the connection when proposing a derived question. Use concrete scenarios to examine important judgments under the evidence standard in step 2, and accept a user-owned trade-off once the user understands its consequences.

For example, a choice of permanent sharing links raises a question about what happens when the author deletes their account. That may expose a distinction between a link's lifetime and responsibility for its content. The example illustrates a derivation, not a checklist every project must follow.

Recompute the frontier after the answers. Consequences within a chosen direction can become the next ready questions; a newly discovered direction returns to the invitation in step 2 before deeper questioning. Merge duplicate questions and stop reopening settled choices without materially new evidence or consequences.

Keep deferred directions with their reason and any condition for revisiting them. Reintroduce one only when the user asks or a later answer or fact materially changes its relevance. Explain that change and let the user decide whether to reopen it; otherwise leave it deferred.

## 5. Preserve understanding and close honestly

At useful round boundaries, connect newly introduced perspectives to the decisions they changed or supported. Keeping the original design can be a successful result. Preserve unresolved facts and deferred directions without claiming the user has mastered a topic or that all possible project questions have been exhausted.

Default to a compact record in the conversation containing:

- The new perspectives and why they matter to this project.
- Decisions, reasons, accepted consequences, and how the perspectives informed them.
- Unresolved facts, deferred directions, and their revisit conditions.

When the user requests persistence, follow the project's documentation and tracker conventions. A hypothetical consequence is not a verified defect or an accepted requirement. If domain-modeling is separately active, let it capture resolved vocabulary and qualifying decisions according to its own rules; it is not a dependency of this skill.

Close when the user ends the discussion, or when the chosen directions have no ready questions or useful new directions to offer. Identify blocked or unresolved branches rather than treating them as settled. User-directed deferral or an early finish is valid; retain enough context to resume without forcing another round.

Keep this skill’s work to discussion, bounded evidence gathering through `investigate-with-evidence`, and agreed records. Product implementation and external publication require their own user instruction. Selecting a design or running a disposable evidence check does not authorize adopting that design; an explicit implementation request can transition out of this discussion using the decisions already made.
