# Local Markdown Tracker Guidance Template

Use this seed when the user chooses local Markdown and usable guidance is missing. Replace the fields with the selected directory and existing conventions. For a new tracker, propose the minimal record structure below in the draft.

```markdown
# Issue Tracker: Local Markdown

Canonical destination: <repository-relative directory>.
Visibility: <shared in Git or private under the selected ignore rule>.
Tool: <project-selected filesystem tools>.
Record layout: <existing convention, or one uniquely named Markdown file per independently resolvable problem>.
Closed or archived records: <their configured location, or the same directory with status recorded in each file>.

Record fields: <existing format, or title, status, observed behavior, impact, evidence, expected behavior, uncertainty, and acceptance criteria>.
Status vocabulary: <existing states, or open and closed with the resolution recorded in the body>.

Associated GitHub repository: <verified owner/repository, or none configured>.
Supplemental issue/PR access: <project-selected GitHub CLI or connector, or unavailable>.
The associated repository supplies read-only evidence; local Markdown remains the canonical write destination.

Follow the active skill's qualification, reconciliation, and approval workflow. This guidance supplies project conventions and grants no write authority.
```

A selected private directory needs a narrow ignore rule if it is not already ignored. Check whether files are tracked: adding an ignore rule does not untrack or erase them. Include any visibility conflict in the setup discussion rather than silently changing tracked history.
