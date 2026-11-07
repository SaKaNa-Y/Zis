# Exploration Lenses

Read this reference before the free-exploration pass. These lenses come from how users encounter problems across developer tools; they are not a catalog of known symptoms or a demand to test every combination.

## Build a Capability-Shaped Matrix

For the active Capability Group, identify the structure visible to a user: interfaces, modes, configuration scopes, independently controlled members, lifecycle states, created artifacts, external dependencies, wrappers, and neighboring tools. Select only the lenses that this Vertical Capability Slice makes material.

Use a Discriminating Variation whose result differs observably when the behavior is correct or incorrect. Prefer pairwise interactions and one-variable comparisons over a Cartesian product. Record why each selected variation matters; an inapplicable lens needs only a short exclusion, not a ceremonial test.

## Apply the Lenses

### Footprint and Ownership

Before and after a material operation, compare the applicable operational footprint: created or changed files, executables, lockfiles, caches, processes, listeners, downloads, persistent configuration, selected versions, command resolution, disk use, and external resources. Check whether the tool duplicates, shadows, mutates, or assumes ownership of something already present. Add every disposable resource to the cleanup ledger.

### Configuration Composition and Granularity

Use conflicting sentinel values to establish precedence across applicable scopes such as defaults, shared and local configuration, workspace and package configuration, environment, and command-line options. When a feature manages multiple members, exercise one member, multiple members, and selective enablement or disablement when the user path makes that distinction meaningful.

When a setting affects content supplied by multiple parties, follow one externally supplied item through the materially different public consumers involved in the user outcome. When the public contract allows an optional value, include an item without it to check the documented default or fallback. Establish each consumer's actual configuration source before judging differences; consumers may intentionally use different settings. Choose these paths from public documentation and usage while the source gate is closed.

### Lifecycle and Time

Exercise applicable transitions such as first use, immediate repeat, warm repeat, mutation, removal, completion, settled idle, reload, restart, recovery, and cleanup. When caching or deferred work is visible, compare cold and warm behavior and inspect the state intended to persist or amortize the work.

### Interface and Mode Parity

Treat each shipped UI, CLI, public API, editor integration, interactive or unattended mode, watch mode, development or production mode, and materially distinct visual theme as its own surface. Complete the Capability Journey in the primary mode, then run a **Mode Parity Probe** in each applicable sibling mode: replay the same observable outcome and its key interaction states with the same discriminating input. A mode switch or visual glance verifies only the switch itself. Expand coverage locally when the probe reveals a material difference; do not multiply unrelated capabilities and modes into a full Cartesian product.

### Boundary Fidelity

For wrappers, plugins, adapters, subprocesses, and native bindings, verify that applicable arguments, option discriminants, environment values, input and output streams, exit status, signals, and cancellation behavior survive the boundary. Compare the wrapped path with the direct path when both are public.

### Outcome Integrity

Check the outcome triangle: what the tool reports, how the operation terminates, and what artifact or persistent state actually exists. A success message or exit status alone is insufficient. Consume generated output through a real downstream path when that is the capability's purpose; inspect the settled rendered state for UI work.

### Realistic Scale and Degraded Surroundings

After the minimal path, use one representative specimen when behavior plausibly depends on graph depth, file count, workspace topology, accumulated UI state, task count, latency, offline services, or constrained resources. Keep degraded conditions disposable and safe, change one variable at a time, and mark the variation Blocked when it cannot be created without disproportionate risk or cost.

When a judgment depends on an automatically selected project, workspace, or configuration source, or on workload size or processing scope, confirm the relevant selection or scope through public evidence before attributing the result. Use reported paths, resolved configuration, a file listing, a dry run, or a small discriminating result; the prepared directory and sample size alone do not establish what the tool uses. Confirm workload size before scaling the experiment or opening a costly result view.

If the effective context or scope differs from the intended setup, preserve the default behavior and its conditions, then use supported configuration to establish a bounded comparison. Keep the two results distinct. Reuse established evidence unless an operation could change the relevant selection or scope, and recheck only the affected part. Operations whose judgment does not depend on these dimensions need no extra probe.

### Alternative Interaction and Accessibility

For interactive products, exercise keyboard traversal and activation as well as pointing input, and inspect focus, disabled, loading, error, recovery, resize, and continuous-interaction behavior when present. For composite controls that reveal suggestions, menus, or other choices from an input, inspect their semantic exposure and complete at least one choice with both pointing and keyboard input when both modalities should apply. A pointer-selected result does not verify keyboard selection or assistive-technology semantics.

### Counterfactual Comparison

When an observation has practical impact but no explicit promise supplies the expectation, change one dimension: direct versus wrapped invocation, empty versus populated state, first versus repeat run, one sibling mode versus another, or current versus an available comparison version. Preserve the concrete contrast without inferring a root cause.

### Compatibility Migration

When the tool claims compatibility with or replacement of another tool, run a representative existing workload incrementally through both. Preserve divergences from the real workload before minimizing them; the smaller reproduction supplements rather than replaces the original evidence.

**Complete when:** every selected lens in the active Vertical Capability Slice has an observable result or explicit exclusion or Blocked reason, every applicable sibling mode has a Mode Parity Probe or an explicit exclusion or Blocked reason, the matrix remains proportional to the user outcome, and its footprint entries are present in the cleanup ledger.
