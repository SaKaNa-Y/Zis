# Missing Prerequisites

Read this reference when launch or build fails, inputs are missing, artifact correspondence is unknown, or documented use needs an unavailable prerequisite.

## Verify the Requirement

Before proposing an installation:

- identify the exact capability that needs the prerequisite and the documented version constraint, if any;
- check whether a suitable version is already available using the project's documented command;
- check the public documentation for a supported prebuilt binary, package, browser experience, container, devcontainer, or other path that avoids changing the user's machine; and
- inspect only the installation or entrypoint metadata allowed by the source-closed safety check. Do not read behavioral implementation source early to infer how the product works.

Evaluate alternatives against the target established during framing. Build prerequisites matter for a selected checkout, while contributor tooling can be unnecessary for an explicit release or running instance. An available prebuilt artifact completes target coverage only when its correspondence is established; otherwise keep any comparison separately scoped and the requested target's missing coverage explicit.

## Recover the selected target

Keep preparation as the active task until the selected target can run. For each failed preparation step:

1. Identify the failed command, required input and actual execution conditions. Distinguish external constraints from conditions you chose: offline flags, incomplete copies, stale links or an assumed resource budget.
2. Inspect the documented preparation route and its effects. Complete the next authorized, reversible step in the disposable environment, then retry the failed operation. A missing cache entry calls for the supported fetch or installation path when network use is permitted. If sandbox access is required, use the available approval path. Preserve user-imposed restrictions and actual denials.
3. Use the failure evidence to choose the next action. For recoverable conditions, continue authorized preparation. If evidence establishes an external constraint on the next required action, follow [Continue or Block](#continue-or-block). For resource uncertainty, use a supported execution bound or present the concrete resource decision needed to proceed.
4. Once preparation succeeds, establish the executable and delegated engine for the selected target. Resume its capability journeys from that state.

Use an alternative artifact only to answer a named preparation or comparison question. State how its result will change the next recovery action, run that comparison, then return to preparation. Its observations remain separate from the selected target's coverage; uncertainty labels do not turn it into an audit substitute.

## Resolve installation authority

If installation is still required, reuse existing authorization for its exact scope. Complete authorized temporary or project-local setup. For installation beyond that authority, present one prerequisite checkpoint containing:

- the missing dependency, required version, and evidence that it is needed;
- the capabilities that cannot be exercised without it;
- the exact official installation method;
- whether the change is temporary, project-local, user-local, or system-wide;
- the expected download, time, disk use, permissions, and persistent machine changes; and
- the cleanup plan, including anything that would remain installed.

Among supported options that match the selected audit target, offer available choices in this order:

1. use an already installed compatible environment;
2. use an official prebuilt or browser-based path;
3. use a project-provided isolated environment such as a container or devcontainer;
4. install an approved temporary or project-local prerequisite; or
5. install an approved user-local or system-wide prerequisite.

Skill invocation does not authorize persistent machine-level changes. Preserve applicable permission checkpoints and use existing user authorization without asking again. A new installation decision must identify the exact option and its effects.

## Continue or Block

When the user approves an installation, verify the resulting version, record every temporary and persistent resource it creates, and continue from the documented path.

Mark an affected capability `Blocked` when the next required action faces an external constraint: denied authority, failed access, a reached resource limit or a specific pending user decision. Record that action, the attempted operation and result where permitted, alternatives investigated, and the exact action or decision needed to resume. An explicit restriction needs no forbidden attempt to prove it. Complete the permitted preparation before requesting the missing decision, and continue unaffected work. Saving a checkpoint preserves this unfinished task; it does not authorize ending recoverable work.

A missing prerequisite in the user's environment is not by itself an Audit Finding. Create a separate Documentation Finding when the public documentation omits a required prerequisite, states an incompatible version, or promises a setup path that cannot work as described.

Remove approved temporary or project-local prerequisites during cleanup. Do not uninstall a user-local or system-wide prerequisite unless that removal was also explicitly agreed; report it as persistent state instead.

**Complete when:** the prerequisite is satisfied and the selected target can be exercised. If progress requires an unavailable action or decision, return that concrete blocker and retain the target as unfinished.
