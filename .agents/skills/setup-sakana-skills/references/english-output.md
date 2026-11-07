# Configure English Output

Use this guidance when configuring optional English writing support. Each skill works without `simple-english`; setup is not a prerequisite.

## Inspect existing guidance

Read existing entrypoints and writing policies before proposing files. Reuse sufficient guidance and preserve unrelated instructions.
If `simple-english` is installed, check whether each selected client can read its `SKILL.md` and applicable references.
Reuse instructions already loaded. A readable skill file works without a dedicated invocation tool.
If it is absent or unreadable, continue configuration and normal delivery without it.

## Prepare the shared policy

Use one authoritative policy per effective scope. For a new project policy, propose `docs/agents/english-output.md`.
For global guidance, inspect the selected client's actual entrypoint before proposing a destination.
Keep machine-specific paths in local configuration. Include a skill path only when it exists and is readable.

Use this contract:

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

Apply it to new or revised English replies, records, documentation, issue and PR descriptions, commit messages, and natural-language code explanations.
Preserve task-required headings, tables, interview formats, templates, and domain vocabulary.

## Apply and verify configuration

Show the exact policy, destination, and selected client entrypoints before applying configuration.
Replace the placeholder in this example with the verified policy path:

```markdown
Before writing or revising English prose, read the English output policy
at <verified policy path>. Use optional writing support when available,
and continue normal delivery when it is unavailable.
```

Write only approved configuration. Reuse sufficient pointers and edit a shared or linked file only once.
Read the saved entrypoint and follow its policy pointer from each selected client's context.
Make sure that the policy supports both available and unavailable optional instructions without blocking delivery.
Do not install skills automatically. Repeat inspection without changing inputs; sufficient configuration needs no further edit.
This establishes configuration reachability, not a guarantee that every future output follows the policy.
