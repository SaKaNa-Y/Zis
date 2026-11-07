# Configure Working Records

Use when a supported consumer needs persistent observations, opportunities, assessments or implementation progress. Install Assess Findings with Investigate with Evidence for those consumers. The authoritative runtime contract is [Working Records](../../assess-findings/references/working-records.md); Setup does not duplicate its algorithms.

Prepare a guidance document with the exact choices the user has made:

- Records root and project identity; upstream/fork when relevant.
- Existing project index and individual-record convention. Use the shared contract’s category and archive layout by default. Locate the project’s evidence and coverage indexes. Preserve explicit project layout overrides.
- Which record kinds may be saved or updated during ordinary work.
- Whether local commits are authorized for those kinds: one per new record or substantive update, wording changes grouped. State that amendments and pushes require separate instructions.
- The canonical tracker guidance pointer, separately from records.
- Verified PR search repositories and known authors or explicit implementation provenance, with missing identities left unknown.
- The installed shared-record contract's actual path, verified to exist for the selected client.

Put reusable defaults in the approved user-level guidance, project-specific identity and overrides in project guidance. Resolve each field as current instruction, project override, then global default. Preserve explicit authority restrictions; a location override alone does not grant commit or publication permission.

An entrypoint can use this form after substituting the approved guidance path:

```markdown
### Working records

Before capturing findings, resuming recorded work, starting implementation or preparing a PR, read the working-record guidance at <approved guidance path>. Reuse relevant records and check existing ownership and delivery state within the task's history-access boundaries. After material decisions or delivery, update the original record with evidence and PR coverage under its save and commit authority. Independent audits defer historical findings until their gate opens.
```

Resolve the actual path in the proposed text; do not leave the placeholder in user configuration. One pointer may serve ordinary chats without requiring an explicit skill invocation, but it is guidance rather than a guaranteed event hook. No background synchronization is configured.
