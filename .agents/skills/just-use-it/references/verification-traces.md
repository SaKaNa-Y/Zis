# Verification Traces

Read this reference before assigning the first `Verified` state. A Verification Trace is the positive evidence that a Capability Journey reached its user outcome; an entry point, rendered container, opened control, success label, or source claim alone is insufficient.

## Prove the Journey

Keep one compact trace per independently verifiable capability. Establish correspondence to the selected target, including the delegated implementation layer when relevant, before crediting the trace. Comparison artifacts retain separate observations. Bind the trace to its batch observation and actual execution identity under [coverage records](../../assess-findings/references/coverage-records.md); shared header fields may be inherited. Reused traces keep their original revision and date, with current applicability recorded separately. Identify:

- the capability and user outcome;
- the public interface, relevant initial state, fixture, and prerequisites;
- the material user actions, including meaningful inputs, selections, and applicable pointing and keyboard paths;
- for an interactive UI, the material rendered control states inspected along those actions and any browser- or operating-system-owned visual state that remained unobservable;
- the observable result, settled state, artifact, or downstream effect;
- the Discriminating Variation and its contrasting result, or why no material variation applies; and
- the modes covered by the completed journey and any Mode Parity Probes.

Use `Finding` when actual use confirms a product or documentation problem. Use `Blocked` when a missing safe prerequisite or control surface prevents the journey. Use `Observed` when the journey and its evidence are complete but assessment of a possible problem or improvement is pending. Keep the capability `Not Exercised` when the journey or its required usage evidence remains incomplete.

## Keep the Evidence Compact

Store the trace with its capability in the Coverage Ledger as a short paragraph, structured row, or equally compact record. Preserve exact commands, output excerpts, screenshots, logs, or viewport details only when they materially establish the result; Finding Packets own the fuller evidence for problems.

Prefer observable contrasts. For example, a filter trace records two meaningful inputs and the different result sets they produced, not every pointer movement used to reach the control.

**Complete when:** another agent can identify the exercised public journey, distinguish its two outcomes or understand the variation exclusion, and repeat the verification without relying on implementation source.
