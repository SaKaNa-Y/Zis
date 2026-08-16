# CLAUDE.md

This file is the single source of truth for this project's agent configuration. Edit it (and the files it points at) rather than duplicating configuration elsewhere.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `SaKaNa-Y/Zis`, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), as real GitHub labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.
