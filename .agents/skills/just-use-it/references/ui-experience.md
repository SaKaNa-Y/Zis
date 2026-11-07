# UI Experience

Read this reference when the target exposes any official interactive UI: a web application, local administration surface, playground, Storybook or component browser, interactive documentation, web demo, native developer application, IDE surface, or terminal UI. Static screenshots and marketing pages are not interactive UI.

## Use the Rendered Product

For a browser-reachable UI, use browser control. When the user explicitly opened and requested a browser or tab, use that existing session first; otherwise open the documented UI with an available browser-control capability. For a native, IDE, or terminal UI, use an available control surface that performs real user actions. Mark the affected UI capabilities Blocked when the environment provides no such control, and continue every unaffected branch.

Treat a user-provided browser session as user-owned state. Leave it open and preserve its cookies, storage, and unrelated tabs; close only disposable tabs or contexts created for the audit when cleanup requires it.

Operate through controls visible to a user: navigate, click, type, select, scroll, drag, move backward and forward, reload, and resize when those actions are relevant. Accessibility or document structure may locate visible controls, while the rendered view supplies the visual result. Console and network observations may support evidence.

Keep the UI path real. Count a capability as UI-verified only when the visible interface exercised it; script injection, hidden endpoint calls, and direct internal-state changes do not substitute for UI use.

Reaching a navigation item, tab, panel, dialog, menu, or other container verifies only that entry point. Complete the Capability Journey through the nested controls and resulting states before assigning `Verified` to a capability inside it.

## UI Journey Gate

Stay inside the active user outcome until the required UI journey has observable evidence. Account for nested controls, scroll boundaries, rendered states, native surfaces and applicable sibling modes below. A justified scope exclusion removes that outcome from the gate; a `Blocked` reason preserves unfinished work under the [audit stopping conditions](../SKILL.md#3-complete-vertical-slices).

### Traverse the Active Slice

Complete the documented journey first, then make one bounded Surface Discovery Pass through the same slice:

- scroll each relevant page, panel, list, and nested container to its terminal boundary, or until further movement repeats content without revealing another control or state;
- expand disclosures and nested sections;
- open menus, selectors, tabs, and alternate views to identify the choices they expose; and
- inspect controls and states revealed beyond the initial viewport.

Discovery adds capabilities to the Coverage Ledger; it does not verify them. Exercise controls needed for the active outcome and its Discriminating Variation through an observable result. Apply the [outcome scope](../SKILL.md#establish-the-outcome-scope) before adding an independent outcome as a separate Capability Group. Its UI container does not determine scope.

### Inspect Meaningful States

At slice entry, inspect the full rendered surface. After each meaningful transition, inspect the changed rendered region rather than relying only on text or structure. Reinspect the full surface after navigation, a mode or viewport change, a cross-region layout change, an unexpected result, and slice completion. Routine pointer movement or scrolling that reveals no new state needs no duplicate full-surface capture.

For every material control used by the Capability Journey, visually inspect its resting state and every interaction state the journey actually enters, such as focus, expanded or open, selected or checked, completed, disabled, loading, error, and recovery. Functional success does not substitute for rendered-state inspection. Compare each state with adjacent controls and the surrounding surface for practical contrast, visual weight, alignment, clipping, and consistency.

Browser and document screenshots may omit browser- or operating-system-owned surfaces such as native select menus, file pickers, permission prompts, and context menus. When one is material to the journey, identify whether the product or its host owns the rendered surface, open it, and attempt an authorized full-window or screen-level observation. If that surface remains unavailable, verify its structure and action outcome separately, mark its visual evidence `Blocked: native surface not observable`, and do not infer its appearance from the DOM, accessibility tree, computed styles, or a successful action. A host-rendered difference becomes a product Finding only when delegating that surface violates an explicit or consistently product-owned visual contract, or causes practical usability harm.

Check the states the feature actually exposes, including:

- initial, active, completed, empty, loading, error, disabled, and recovery states when present;
- clipping, overlap, overflow, alignment, visibility, and incorrect status presentation;
- return, reload, or restart persistence for stateful behavior;
- interactions with related features; and
- materially different viewport sizes when the UI claims or visibly attempts responsive behavior.

Preserve the viewport, visible state, action path, and screenshot or equivalent visual evidence for a visual Finding. A purely aesthetic preference is not a Finding unless it causes practical readability, discoverability, consistency, or operability harm, or violates an explicit contract.

For sibling visual modes such as light and dark themes, perform the Mode Parity Probe defined in [exploration-lenses.md](exploration-lenses.md). Switching the mode verifies the switch control only; replay the journey's outcome and key interaction states before claiming parity coverage.

### Preserve Coverage Boundaries

When the UI exposes only part of the Capability Surface, finish that part through its real user-control surface and use the programmatic branch for the in-scope remainder. An API result cannot verify its corresponding UI behavior.

Treat an unavailable required control surface, an unlaunchable UI, or missing safe test state as Blocked coverage. A documented UI launch that fails may also be a documentation or product Finding. Continue through every unaffected capability.

**Complete when:** every required UI journey, meaningful rendered state and applicable sibling mode has proportionate observable evidence, with justified scope exclusions explicit. Entry points and non-UI paths do not substitute for UI verification. Required blocked observations remain unfinished; apply the audit stopping conditions above.
