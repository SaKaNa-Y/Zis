# Standards and design heuristics

Use these lenses on the selected change alongside documented project standards. They preserve design and maintainability review even when the repository has no standards file. They are clues to investigate, not automatic violations or demands to refactor. A repository convention overrides a conflicting heuristic. Skip issues already enforced by tooling; inspect relevant tool results instead of duplicating formatting comments.

For a useful concern, locate the changed code and explain the concrete maintenance cost, affected use or likely change it makes harder. Consider the benefit of the existing structure and valid alternatives. A name or pattern alone does not establish a problem. Report only concerns whose value justifies asking the author to act, and label their judgment basis.

| Lens | Question and possible direction |
| --- | --- |
| Mysterious Name | Does the name hide the role needed to understand this change? Clarify the role before renaming it. |
| Duplicated Code | Must the same behavior now be maintained in several places? Consider a shared implementation when the behavior truly belongs together. |
| Feature Envy | Does logic repeatedly reach into another object's data because responsibility is misplaced? Consider moving the behavior. |
| Data Clumps | Do the same values travel together and represent one concept? Consider a named group when it clarifies the contract. |
| Primitive Obsession | Do raw values repeatedly lose a meaningful domain constraint? Consider a type that carries that constraint. |
| Repeated Switches | Must the same alternatives be edited in several branches? Consider centralizing their selection. |
| Shotgun Surgery | Does one coherent change require scattered edits because its responsibility is fragmented? Consider bringing that responsibility together. |
| Divergent Change | Does one unit change for unrelated reasons? Consider separating those responsibilities. |
| Speculative Generality | Does the change add abstraction for requirements that are not present? Consider the direct solution and its real extension cost. |
| Message Chains | Does a caller depend on the internal navigation of several objects? Consider an interface that expresses the required result. |
| Middle Man | Does forwarding add maintenance cost without enforcing a useful boundary? Consider whether the layer still serves its purpose. |
| Refused Bequest | Does an implementation inherit a contract it cannot meaningfully honor? Consider a relationship that matches its actual role. |

A documented rule violation and a qualified design concern can coexist. Keep their evidence and strength separate. Do not turn a plausible heuristic into a claim of broken runtime behavior.
