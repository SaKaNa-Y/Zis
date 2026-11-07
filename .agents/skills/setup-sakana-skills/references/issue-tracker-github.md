# GitHub Tracker Guidance Template

Use this seed when the user chooses GitHub Issues and usable guidance is missing. Replace the fields with verified project values and include the result in the configuration draft.

```markdown
# Issue Tracker: GitHub

Canonical destination: <owner/repository> GitHub Issues.
Tool: <project-selected GitHub CLI or connector>.

Use the selected repository explicitly when multiple remotes could resolve differently.

Issue format: <existing template or convention, or the active skill's draft format>.
Labels: <existing convention or guidance pointer, or none configured>.

Related PRs supply read-only reconciliation evidence; GitHub Issues remains the canonical write destination.

Follow the active skill's qualification, reconciliation, and approval workflow. This guidance supplies project conventions and grants no write authority.
```

Keep the project's existing PR-as-request-surface setting unchanged. Supplemental reconciliation searches do not enable PR triage. Add actual issue-template or label pointers only when they exist and affect a supported consumer; setup does not manufacture a label vocabulary.
