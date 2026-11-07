# Project skills

These skills are installed for Codex in this repository. They are instructions
the agent reads when a task calls for them. Installing them does not run their
setup workflows or register Cursor plugins, hooks, models, or automations.

| Source | Skills |
| --- | ---: |
| [SaKaNa-Y/skills](https://github.com/SaKaNa-Y/skills) | 18 |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 38 |
| [cursor/plugins: pstack](https://github.com/cursor/plugins/tree/main/pstack) | 58 |
| [AminBlg/SimpleEnglish](https://github.com/AminBlg/SimpleEnglish) | 1 |

Total: 115 installed skills. See the installation manifest and
`skills-lock.json` for the actual installed inventory. The CLI skipped Matt's
in-progress `software-factory` because its upstream YAML description contains
an unquoted colon and fails parsing. Its instructions are not installed.

## Pstack layout

Pstack is preserved in `vendor/pstack`, with relative links from `skills`.
This keeps its supporting documents, agents, scripts, and playbooks together.
Only its skills are installed as Codex skills. Cursor-specific features still
require their own supported tools; file installation does not provide them.

Matt and pstack both define `tdd` and `teach`. Matt keeps those names. The pstack
versions use `poteto-tdd` and `poteto-teach`; their frontmatter names are changed
to match. When a pstack workflow refers to its own TDD or teaching skill, read
the corresponding file under `vendor/pstack/skills`, not Matt's version.

The lockfile records upstream provenance. The two aliased entries retain their
upstream paths and hashes; their local names differ. Do not run a blanket update
without preserving these aliases and the supporting pstack tree.

## Scope

This directory is project-scoped and travels with the repository. A matching
copy was also installed in the current cloud user's `~/.agents` directory.
The user copy does not travel with Git and does not change the user's Mac.
UI skill pickers may need a fresh session; installed files alone do not verify
that a particular client has refreshed its picker.
