# Repository Environments

Read during source reconciliation to find runnable environments that add meaningful usage coverage.

## Map Environments to Outcomes

Inspect workspace scripts, launch configurations, examples, demonstrations, component catalogs, and integration harnesses for ways to exercise capabilities or states absent from the documented consumer path. Apply the [outcome scope](../SKILL.md#establish-the-outcome-scope), including necessary dependencies. Select an environment for the additional in-scope outcome or state it exposes, not merely because a script exists. Reuse equivalent coverage and record a concise exclusion for redundant or unrelated launch targets. Internal helpers and test fixtures do not become public capabilities by being runnable.

For each selected environment, establish what it runs, how it relates to the selected artifact, and which state or integration it represents. Use the normal isolation and launch-effect checks. Discover commands from repository metadata rather than guessing framework-specific defaults.

## Exercise and Attribute

Launch the environment and complete the relevant journey and meaningful variation through its real interface. A component catalog may expose empty, error, loading, overflow, or interaction states; an example may expose a supported integration. Source descriptions and existing test assertions establish intended setup, not completed usage.

Keep the result scoped to the environment exercised. Note injected data, mocked services, omitted providers, and wrapper behavior when they affect interpretation. If a proposed product-wide finding depends on integration, replay the relevant path in a representative consumer when feasible; otherwise retain the isolated observation with that attribution unresolved. A working isolated component likewise does not establish working host integration.

Add genuinely new in-scope journeys to the Coverage Ledger and send observed candidates through the same assessment handoff. Preserve useful evidence before cleaning up environment-created resources.

**Complete when:** each relevant environment adds an exercised outcome/state or an explicit exclusion or Blocked reason, and its evidence does not imply untested consumer coverage.
