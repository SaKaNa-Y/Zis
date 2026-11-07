# Programmatic Experience

Use this reference for programmatic setup, execution, and cleanup. Verify interactive UI capabilities through their own real user-control surface or record them as Blocked.

## Isolate Launch Effects

Before installing or first invoking an entrypoint, use the permitted installation and launch metadata to identify where it can write. Include bootstrap behavior reached by help or version commands. A temporary working directory or tool-specific home isolates only writes routed through it; profile configuration, command registrations, and startup integration may use separate destinations.

When an entrypoint can install, register, or rewrite integration state, prefer a supported harness that redirects those destinations into disposable state. Otherwise isolate the identified destinations explicitly. For any user-owned file or link that an authorized operation may still touch, preserve its original contents, link target, or absence before launch. If the remaining writes cannot be isolated or bounded to an authorized, recoverable change, mark the affected path Blocked and continue feasible coverage.

Record the identified destinations with the audit's cleanup resources. Keep inspection and baselines scoped to the launch footprint; a read-only entrypoint needs no extra profile inventory, and this check does not open behavioral implementation source.

## Create a Disposable Consumer

Create a uniquely named temporary workspace outside the target checkout, using the platform's safe temporary-directory mechanism. Record its exact resolved path before adding files.

Before setup or invocation can change the target, capture a cheap integrity baseline: repository status and diff for a Git checkout, or a file inventory and content hashes for a small non-Git target. Compare the same scope after cleanup. Keep the baseline scoped to the target rather than dependency caches or large generated trees.

Install, link, or invoke the target as its public documentation instructs. Use the smallest real consumer that can exercise the public contract:

- invoke a CLI through its documented executable and help surface;
- import a library from a minimal program using its supported package entrypoint; or
- use an official example only when it represents a supported user path.

For a checkout audit, follow its documented build and consumer setup in a disposable copy or worktree when practical. Inspect build and launch metadata without reading behavioral implementation.

Keep the original checkout's tracked files unchanged and preserve existing authorization boundaries for dependency installation, network access, credentials, or external state.

## Refresh Artifact Correspondence When It Can Change

Confirm where the consumer resolves the tool or package; a global launcher, link, or stale build can select a different artifact despite a matching version label. Use the minimum evidence sufficient to establish which artifact actually runs and its correspondence to the selected target. When a launcher delegates to a separately installed package, establish both parts of that execution path.

After an operation that can replace or redirect an exercised tool or package, such as dependency installation, rebuilding, or changing a link, recheck the affected resolution before crediting further outcomes. Keep earlier observations bound to the artifact that produced them. If the new artifact's correspondence to the selected target is unknown, follow [target recovery](prerequisites.md#recover-the-selected-target). Credit further target coverage only after that correspondence is established.

Unrelated consumer edits leave that evidence valid. Recheck only the affected part of the execution path; repeated full-tree hashing or identity checks after every command are unnecessary.

## Experience Before Inspecting

During the documentation and free-exploration passes, use public commands, types, runtime feedback, and help output without reading behavioral implementation source. Create disposable programs and data freely inside the recorded workspace. Capture commands, inputs, outputs, versions, and relevant environment facts needed to understand a result.

Exercise the documented path first. Then vary inputs, repeat operations, combine related public capabilities, inspect persistence, and attempt recovery according to the behavior the tool exposes. Keep generated harnesses as audit state, not as changes to the target project.

## Clean Up Launch Effects

During the main workflow's cleanup step, preserve required evidence and compare the recorded destinations before deleting resources they may reference. Remove audit-created registrations or restore the recorded state within the authorized scope, preserving unrelated later edits. Report unrecovered state and residual references rather than treating deletion of the consumer directory as complete cleanup.

**Complete when:** the required non-UI journeys have target-bound evidence, the target integrity baseline is preserved, and launch effects are accounted for. If a required journey or cleanup action remains blocked, retain it as unfinished under the [audit stopping conditions](../SKILL.md#3-complete-vertical-slices).
