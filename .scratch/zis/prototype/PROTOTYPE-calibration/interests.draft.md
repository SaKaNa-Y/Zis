# Interest Profile — the reader's own (Zis issue #46)

**This file is no longer a draft.** The 18 statements that stood here before were
drafted from the stack this repo uses, and the header said so — *"Drafted from
the stack this repo actually uses… a statement that is not genuinely yours makes
the number not genuinely calibrated."* It was never edited, which is what
[#41](https://github.com/SaKaNa-Y/Zis/issues/41) found: every number in #21, #35
and ADR-0012 was measured against a profile that disclaimed being the reader's.

These statements were **elicited from the reader** in
[#46](https://github.com/SaKaNa-Y/Zis/issues/46) — what they actually read, what
they would be annoyed to miss, and which of the drafted clusters were the repo's
stack talking rather than theirs. Constraints unchanged, from
[#14](https://github.com/SaKaNa-Y/Zis/issues/14) / ADR-0003: each statement
stands alone, ≤200 chars, English, ~10–20 positives.

**Cut from the draft, on the reader's word:** Postgres / Neon / serverless
Postgres, and Drizzle & TypeScript ORMs. The repo runs on both; the reader does
not read about either. That divergence is the point of this file.

**Added:** React (absent from the draft), open-source AI projects, library and
runtime release announcements, and the AI industry as a business.

**Negative Interests are deleted, deliberately.** #21 cut `E4` and settled that an
`Interest` is one kind of thing, a statement of what the reader wants. The three
statements that stood here (crypto/web3, AI industry business news, consumer
gadgets) were the agent's guesses too — and the second was the *opposite* of the
truth: the reader wants AI industry business news, including funding, valuations
and lawsuits. Consequence, recorded because it is load-bearing: **`T−` has nothing
to measure against this profile**, so `run.mjs`'s `T−` sweep is now empty by
construction rather than by a bar being wrong.

## Positive Interests

1. Frontier model releases from the major AI labs — new models, what capabilities changed, benchmark results, and pricing
2. AI provider platform and API changes — tool use, MCP, context handling, agent APIs, and deprecations
3. AI research published by the frontier labs — interpretability, alignment and safety work, and scientific results obtained with models
4. Practical LLM application engineering — prompting, tool use, structured output, evaluation, retrieval
5. Coding agents and agentic developer tooling — how they are built and where they fail
6. Open-weight and locally-runnable models — embeddings, quantization, running inference on a laptop
7. Notable open-source AI projects the community is talking about — what one does and whether it is worth trying out
8. The AI industry as a business — funding rounds, valuations, acquisitions, executive moves, and lawsuits
9. Version releases of developer libraries, frameworks and runtimes — what changed, what breaks, and whether to upgrade
10. Developer tooling and build systems — Vite, bundlers, package managers, monorepo and CI practice
11. Next.js App Router internals — routing, caching, Server Actions, and what changes between major versions
12. React itself — its release cycle, the compiler, and the ecosystem built on top of it
13. Vue 3 Composition API and the Vue ecosystem — script setup, reactivity, Pinia, VueUse
14. Tailwind CSS v4 — the engine rewrite, design tokens, and building a design system without a component library
15. TypeScript language releases and type-level techniques
16. Web platform features landing in browsers — CSS, HTML elements, and Baseline availability
17. Web application security — SSRF, authentication design, session handling, and real vulnerability writeups
18. Rust for tooling and systems work — the language, the ecosystem, and Rust-based JavaScript tooling
19. RSS, feeds, and the open web — readers, aggregators, and independent publishing
20. Software design writing — module boundaries, API design, and how to keep a codebase navigable
