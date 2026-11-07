---
name: setup-sakana-skills
description: Configure global defaults and project conventions for English output, working records, evolution history, issue tracking and agent instruction entrypoints.
disable-model-invocation: true
metadata:
  author: sakana
  version: "2026.11.07"
---

# Setup Sakana Skills

Prepare conventions that installed consumers can read directly. Run only when the user invokes this skill. Reuse existing guidance; sufficient configuration works without setup. Setup owns configuration, not runtime scheduling, skill installation or record migration.

## English output

`simple-english` is optional. If it is installed and readable, use it when
writing or revising English prose. Reuse instructions already loaded.
If it is unavailable, write clear English and complete the task normally.
Its absence does not require installation, an exception, or draft-only delivery.

Preserve meaning, uncertainty, requirement strength, domain terms, and requested
formats when style rules conflict. Keep the requested language. Preserve code,
identifiers, commands, original quotations, and historical evidence.

## 1. Inspect effective guidance

Read applicable user-level and project `AGENTS.md`, `CLAUDE.md` and their pointers, including `docs/agents/` when present. Verify the selected clients' actual instruction locations rather than inventing a native configuration key. Inspect repository identity and installed consumers' requirements. Distinguish working records from canonical issues, evaluation fixtures and private evolution history. For English output, inspect existing writing policies and any installed `simple-english` skill. Its absence does not block configuration. If present, check access from each selected client.

Resolve settings from the current explicit instruction, then project overrides, then global defaults. Record the source of each effective value. Existing user-selected record locations and commit permissions remain valid within their stated scope. Detect conflicting guidance, duplicate pointers and shared or symlinked files before editing.

**Complete when:** every required setting has an effective value, a missing choice or a specific conflict. With no missing or requested change, report that setup is unnecessary.

## 2. Resolve only missing choices

Carry forward decisions already made. Configure only supported consumers and the requested scope:

- **Scope and clients:** global defaults, project overrides or both; Claude Code, Codex or both. Show how a project inherits or overrides values. Project tracker identity stays project-specific even when general conventions are inherited.
- **English output:** preserve the optional writing support. Identify any installed skill, shared policy location and selected client entrypoints. Read the [English output guidance](references/english-output.md). Keep normal delivery available when the optional skill is absent.
- **Working records:** exact root, verified project/upstream/fork identity, existing index and individual-record layout, and useful author identities or explicit provenance for locating the user's PRs. Use one common format for observations and opportunities; reuse existing history without moving it.
- **Record authority:** which kinds permit ordinary saves and substantive updates; separately, whether each new record and substantive update should receive a local commit. This policy may cover observations, opportunities, assessments and implementation progress when the user selects it. Amendments and pushes remain separate instructions. Do not infer broader permission from an Explore-only rule.
- **Evolution history:** when Evolve is a supported consumer, resolve its central archive independently of Working Records. Read the [evolution-history guidance](references/evolution-history.md) for source identity, policy, access and cross-project behavior. Reuse existing values; configuration does not run screening or migrate records.
- **Canonical tracker:** reuse established Tracker Guidance. When absent and needed, propose GitHub Issues for a verified GitHub project or a user-selected local Markdown directory. Preserve another established tracker. Confirm its exact destination and tool; supplemental remote evidence does not create a second canonical destination.

Read the [working-record guidance template](references/working-records.md) when configuring records. Its shared contract comes from Assess; declare that dependency for consumers using it. Read the existing [GitHub](references/issue-tracker-github.md) or [local tracker](references/issue-tracker-local.md) template only when configuring that tracker.

**Complete when:** required choices have exact existing or user-selected values. Missing access is an explicit limit, not a successful connection.

## 3. Show the concrete configuration

Keep one authoritative document per guidance topic. Reuse existing locations; for new project guidance, `docs/agents/english-output.md`, `docs/agents/working-records.md` and `docs/agents/issue-tracker.md` are suitable. For global defaults, propose an exact user-level document and pointer reachable from the selected client's verified global instructions. Global configuration here is agent-readable guidance, not a new application setting.

Show the exact text, paths, scope and resulting effective values before writing. Agent entrypoints carry concise, conditional pointers. The record pointer must cover ordinary chats: before starting implementation or a PR, read relevant records and claims; after delivery, reconcile links and update progress within configured authority. Preserve independent-audit history gates. Do not copy skill bodies or install runtime routers into entrypoints.

Preserve unrelated domain, label and project rules. Both clients may point to the same guidance. The English policy applies to ordinary tasks as well as skill use. Each skill also declares the requirement directly, so setup is not a prerequisite. Keep writing rules in the external skill rather than copying them into configuration. Resolve symlinks once. Include a narrow ignore rule only when the user has selected private local storage; do not assume a records repository is private. Creation of a destination or changes to existing records are separate from documenting its location.

**Complete when:** the user has approved the exact configuration changes. Prior approval for that same text and scope remains valid. Approval of the reusable skill's design is not approval to edit a user's global settings.

## 4. Apply and verify

Apply only approved configuration. Verify pointers from each selected entrypoint, effective precedence, project identity, the distinction between record and tracker authority, and preservation of unrelated content. Confirm any authorized directory creation and report inaccessible paths separately. For English output, check the entrypoint-to-policy path and access to any configured optional skill. Missing optional instructions must leave normal delivery available. Do not install the optional skill automatically.

Re-read the result as a second setup pass: unchanged guidance should require no further edits. Report changed files, global versus project effect, consumers and unverified access. Do not create findings, publish issues, migrate history or schedule synchronization as part of setup.

**Complete when:** approved guidance is readable, effective choices are unambiguous, and a second pass finds no duplicate or necessary rewrite.
