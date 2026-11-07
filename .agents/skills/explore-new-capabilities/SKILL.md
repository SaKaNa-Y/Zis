---
name: explore-new-capabilities
description: Discover and discuss new capabilities for a project, one evidence-grounded idea at a time, with resumable exploration coverage and opportunity history.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.07"
---

# Explore New Capabilities

Find capabilities that could create value for a project's users, then refine one idea at a time through discussion. A Feature Opportunity can be a small convenience or a substantial direction. It needs a concrete scenario and a plausible implementation path, while demand, scope, and feasibility may remain unsettled.

This explicitly invoked workflow serves contributors, maintainers, and product developers. It works without a supplied feature idea. Discovery is the agent's responsibility; the user owns priorities, trade-offs, and whether to pursue an opportunity. Work ends at discussion, bounded evidence gathering, and exploration records. Product implementation and external publication require a further instruction.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Establish the project and history

Use the permitted project guidance, examples, and public capabilities to identify users, their situations, intended results, and the part the project serves. Treat this task understanding as provisional and revise it when later evidence conflicts. Establish enough context to choose useful tasks before tracing their implementation. Use the user's supplied direction, role, and available effort. Ask only for missing context that changes the exploration scope.

When the user also selects Just Use It, follow its [outcome scope](../just-use-it/SKILL.md#establish-the-outcome-scope) before usage and preserve its source and tracker gates. Just owns usage completion; Explore owns the discovery decision that follows. Otherwise, read relevant source as part of project grounding.

Use [Assess Findings](../assess-findings/SKILL.md), installed with `investigate-with-evidence`, for common evidence, relationship and action judgment. Read its [working-record contract](../assess-findings/references/working-records.md) on project entry to resolve configured history, reconcile the root overview, project overview and relevant primary records, qualify current evidence, and handle saves, delivery and lifecycle. Reuse configured paths without another question; when unavailable, continue project grounding but defer presenting a new opportunity until its history can be checked and saved. Missing assessment support leaves the judgment pending rather than claimed complete.

Before selecting discovery routes, read [exploration coverage](references/exploration-coverage.md) and recover the project's index and relevant batches under the active history gates. Compare their scenarios, conditions and evidence with the current task. Retain coverage for every exploration batch, including runs with no opportunity or no execution. Explore maintains its own account; a Just usage ledger supplies evidence rather than replacing it.

For open exploration, use the initial mapping in [project-purpose discovery](references/discovery-entrypoints.md#from-project-purpose-to-user-results) before selecting scenarios. Consider both improvements to existing tasks and new user tasks that fit the project's purpose. Use the task results and existing routes from that inquiry, prior coverage, and concrete leads to select a bounded set of scenarios. Each perspective can end without an opportunity. A supplied idea or narrower request retains its scope. Explain the selection and known exclusions, then initialize the batch. Keep scope proportional to the request rather than a whole-project checklist. On continuation, recover pending work before selecting new routes.

When saving or updating records, apply the contract's [classification and overview rules](../assess-findings/references/working-records.md#classify-work-and-maintain-the-overviews). Classify by the problem or intended outcome, independently of the invoking skill and handling status. Keep detailed item tables in project overviews and maintain the root project summary at the same checkpoint.


Match ideas by user problem and intended capability. Continue an unfinished match in its existing record. Read relevant completed records for reusable methods, constraints or combinations that could support a different user outcome, retaining attribution and the earlier disposition. Reopen the same concluded opportunity only for material new evidence or an explicit request; otherwise move to another lead. Borrowing a method does not by itself establish a new opportunity: identify the additional user outcome. Repeat this identity check before first presentation. Preserve the existing layout and previously authorized commit scope.

**Ready when:** project identity, record authority, history gates and relevant prior work are established; the batch has a bounded discovery scope, selection rationale and pending routes; and any supplied idea has been matched to its history. Record any persistence blocker while continuing independent grounding.

## 2. Find and ground an opportunity

When community feedback supplies a discovery lead or the user requests an issue review, use [feedback discovery](references/prior-work.md#discover-from-feedback) before selecting an opportunity. Keep the declared research scope and active tracker gates.

Start from a concrete situation and what the user is trying to understand, decide, or do. For open exploration, continue the selected task inquiry and revise its mapping when new evidence changes it. Use the other [discovery entrypoints](references/discovery-entrypoints.md) when clues concern context, presentation, information needed together, preparation, or users' existing tools. These routes guide investigation within the selected scope rather than require a candidate from each route.

When exploring combinations of existing capabilities, follow the user's next task after an operation succeeds. Identify repeated transfer, conversion, or setup needed to carry its result forward. Locate the information and behavior the connection needs and who already owns them. Follow relevant clues into comparable projects, complementary tools, and user-assembled workflows. Explain which part of an outside idea transfers and what must change for this project. Another product having a feature is inspiration, not evidence that this project's users need it.

When an existing capability affects content from several sources, trace one user outcome through who supplies the content and where it is used. Compare product-owned content, extension-provided content, and materially different consumers where they exist. Follow a concrete gap into the existing data and integration interfaces to assess an incremental extension. Preserve compatibility requirements that current consumers rely on. Use this as a discovery route when the project has such boundaries, not a requirement to invent extensions or cover every consumer.

Favor opportunities that fit the project's purpose, while allowing a compelling broader direction if its changed assumptions and maintenance burden are explicit. For example, a check run only before releases because it was too costly might become useful during everyday changes when incremental processing lowers that cost. If users chose infrequent checks to avoid interruptions, faster processing alone would not address that reason. Consider small and large ideas on their merits rather than favoring novelty or size. The agent may compare several leads internally; choose one for discussion instead of presenting a candidate list.

Before settling on a solution, compare materially different ways to meet the same need when plausible alternatives exist. Judge each by the additional user outcome, useful behavior it preserves, and complexity it adds. Where relevant, compare support in the core product, an extension, an integration, or an existing external tool. Explain why the proposed owner fits the task, including the maintenance responsibility it takes on. When an existing command, script or configuration already achieves the outcome, identify the recurring effort, error risk or coordination burden the proposal would remove. Ground that benefit in the scenario rather than treating automation itself as value; a small convenience can still qualify. Keep the strongest approach for discussion and explain the trade-offs that could change the choice. A clear solution needs no invented alternatives; new evidence or user feedback can reopen the comparison.

Before adding an investigation, name the current decision and the unknown most likely to change it. This may concern value, an existing alternative, or feasibility; choose the smallest phase-eligible check that can distinguish the relevant answers. When value is unsettled, compare the closest working alternative before deepening implementation evidence if that comparison can decide whether to continue. When feasibility is the blocker, test that assumption instead. A user-requested technical comparison remains the decision to answer, and a useful optional improvement need not prove necessity.

Use documentation, source, actual usage, or a small disposable check as appropriate. State what the result resolves and which uncertainties remain before choosing further work. Keep checks isolated from product changes and clean up resources created for them. Distinguish source inference from observed execution, and record failed checks as well as successful ones. Costly prototypes can remain proposed next steps.

Start from the user question or task. Exercise the closest existing public route, including relevant companion tools or a practical manual workflow, when it can settle whether the outcome is already available. Describe the result it supplies and the result still missing; keep the capability need separate from a proposed command or UI. Prefer an ordinary working scenario when known defects would confound the comparison. If a supporting example fails, revise that example and investigate any concrete surviving lead before judging the whole idea.

Supply the existing Assess owner with the following evidence before presenting the opportunity; use its judgment and investigate only the gaps it identifies:

- **Value:** a concrete user situation and the additional outcome the capability could enable. Separate observed needs from hypothesized benefits.
- **Feasibility:** traceable evidence in the target project's interfaces, data, architecture, or demonstrated behavior supporting a plausible implementation path. Check the assumptions required to transfer an outside example.
- **Prior work:** whether existing capabilities already satisfy the scenario, and whether exploration records or relevant project issues, PRs, and discussions already cover it. Before checking community work or using it to refine an idea, read [prior work and discussion](references/prior-work.md).

Use the history branches above for local matches. For related community work, use the [prior-work account](references/prior-work.md#match-the-refined-idea-and-record-the-result) to distinguish existing coverage from a material new contribution. Preserve and report that contribution through Assess and the exploration checkpoint, even when no new opportunity is created. When the outcome is already covered and the evidence adds nothing material, close the lead with its evidence and return to the remaining relevant leads in the selected scope. Revisit concluded work when the user asks or material evidence or conditions change, linking the earlier work. If a source cannot be checked, state the uncertainty and avoid claims of novelty. Report material updates to matched work beside the relevant lead judgment or checkpoint summary. These updates do not start separate opportunity discussions.

At each material discovery checkpoint, save the examined leads, judgments and next actions through the [exploration checkpoint](references/exploration-coverage.md#save-and-resume). When Just finishes a usage batch, use its evidence and remaining questions to decide the next discovery action. Further usage keeps the established source and tracker exposure.

**Ready when:** one opportunity has a concrete scenario, a supported plausible path, and an account of prior work and remaining uncertainty. Move to its discussion and retain other pending routes. End without an opportunity when no meaningful authorized check remains within the selected scope, or when the user stops or narrows the task. An unavailable prerequisite blocks only the affected routes; continue other feasible in-scope work. Save the examined limits, remaining work and specific stopping reason. A duplicate lead or completed usage batch alone does not settle discovery; a no-opportunity result describes this batch, not an exhausted opportunity space.

### Delegate a factual question when useful

Use the shared [coordination method](../assess-findings/references/coordination.md) when an independent question about the user scenario, alternatives, prior work or feasibility merits a research worker. Give it the current opportunity, the decision-changing question, relevant records and phase permissions, allowed checks and a stopping condition. It returns evidence, limits and record-update suggestions; it does not choose a different opportunity, implement the product or write shared records. Keep the user discussion with the main agent and send material results to the same Assess owner. Small or tightly coupled research stays inline.

## 3. Present one idea and discuss it

Save the initial opportunity record with its assessment or explicit pending state when first presenting the idea, and link it from the exploration batch. Explain what users could do, why it is worth discussing now, why it appears feasible, and what remains uncertain. Cite the supporting sources and explain why this opportunity was selected. Keep the initial proposal understandable without treating it as a settled specification.

Invite the user's reaction, then follow the questions it opens. Investigate factual uncertainties yourself; ask the user about goals and trade-offs with concrete alternatives and a recommendation when warranted. Use answers to revise the current idea, narrow or broaden its scope, or discard it. Ask dependent questions after their prerequisites are answered. Respect settled choices unless new evidence changes their basis.

Keep discussion on this opportunity. Related alternatives that solve the same user problem can clarify it; a distinct capability waits until the user chooses to explore another opportunity. Size does not determine identity: a large direction can still be one coherent idea.

The skill works independently. When the user also invokes a grilling skill, let it deepen the current opportunity's questions while this workflow owns discovery, evidence, and history. With `grill-with-docs`, resolved vocabulary and qualifying decisions follow that skill's documentation rules; exploration history still retains the idea's evidence and outcome. These are optional companions, installed separately.

**Complete when:** the user chooses to pursue, defer, or dismiss the idea, or ends the discussion. Retain unresolved questions without forcing a complete design.

## 4. Preserve the outcome and return control

At meaningful discussion boundaries and before closing, save the exploration batch and index through the [exploration checkpoint](references/exploration-coverage.md#save-and-resume). A batch with no opportunity retains the examined scope, judgments, evidence, limits and next action described there.

When an opportunity record exists, update it at the same checkpoint. Keep its current account and dated material changes, preserving why earlier judgments changed. Apply the shared [handoff-quality check](../assess-findings/references/working-records.md#check-handoff-quality) so a later conversation can recover:

- The project identity, idea, user scenario, and intended capability.
- Inspiration and evidence, with source links or code references, checked revisions or dates where useful, and what each source actually establishes.
- Prior related work and the scope or limitations of duplicate checks.
- Open assumptions, feasibility limits, and results of any disposable checks.
- The discussion's current state, selected and rejected alternatives with reasons, remaining questions, next action, and conditions for reconsideration.

An unfinished discussion remains unfinished; silence does not select a disposition. Resolve any persistence blocker before presenting another idea. These records preserve exploration, not formal feature specifications or tracker items; follow the project's conventions when the user later requests those artifacts.

Close with the current conclusion, unresolved evidence, record location, and the commit result when committing was authorized. Let the user decide whether to continue the current discussion or exploration, change direction, or stop. Choosing to pursue an idea does not itself start implementation.

**Complete when:** the exploration batch and index, any opportunity record and affected overviews are saved and consistent; pending work and the stopping or discussion state are recoverable; each authorized commit is verified or reported as pending; and the user has the conclusion, evidence limits and record locations.
