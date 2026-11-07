# Implementation Roles and Handoffs

Use when a task benefits from delegation or has changes to integrate. Follow the shared coordination contract; one role does not require one permanent agent.

| Assignment | Inputs and authority | Required return |
| --- | --- | --- |
| Research | One blocking factual question, relevant records/revision, allowed sources or disposable checks, stopping condition | Evidence, conclusion, applicability and unresolved facts; no product repair |
| Implementation | One outcome slice, agreement, dependencies, owned checkout/paths and acceptance | Changes, code state, actual checks, new observations and next action; no takeover of adjacent work |
| Integration | Ready contributions, dependency order, current agreement and integration checkout | Integrated state, conflict decisions, evidence invalidated and checks needed; no automatic remote merge |
| Spec review | Agreement and final diff plus necessary context | Concrete deviations or supported coverage, with inspected state and limits |
| Standards review | Repository rules and final diff plus necessary context | Specific violations or supported conformance, with inspected state and limits |
| Runtime verification | Acceptance conditions, delivered artifact, environment and allowed effects | Actual outcome, counterexample or blocker; commands/interaction evidence and examined state |

The coordinator determines scope, ownership, readiness and delivery, checks returned evidence and owns shared-record writes. It may perform several roles itself for small work. A review assignment returns findings rather than silently rewriting the implementation it is checking. Verification may use existing tests, UI actions, traces or a bounded stress check when the acceptance warrants it; not every change needs every technique.

Run independent assignments concurrently only while their resources and interfaces permit it. Start newly ready work without waiting to form an arbitrary batch. Stop obsolete assignments when an agreement or dependency changes. Before retiring workers, collect evidence and transfer or clean their resources; retain a resumable checkpoint for pending work.
