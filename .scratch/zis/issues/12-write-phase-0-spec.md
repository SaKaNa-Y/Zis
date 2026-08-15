# 12 — Write the Phase-0 spec

Type: grilling
Status: open
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11

## Question

The destination. Consolidate every resolved ticket into a single coherent
Phase-0 spec, ready to slice into build tickets via `/to-issues`.

This is **not** a copy-paste of the other tickets' answers. It's the document
that makes them agree with each other — and the place where contradictions
between independently-resolved decisions finally surface.

Must cover:

- **Positioning and value proposition** — one paragraph, no hedging.
- **The core loop** — what happens between a story breaking and it reaching the
  user.
- **Source set** and why each is in (Ticket 01, 10).
- **Ingestion architecture** — pipeline, scheduling, failure handling (07).
- **Clustering** — canonicalization and cluster formation (05).
- **Ranking** — importance, relevance, slot allocation, cold start (08).
- **Entity model** — pointing at `CONTEXT.md` rather than restating it (04).
- **Stack** — Next.js 16, Drizzle, Neon, Vercel + Actions cron, with the
  compute-budget arithmetic that justifies the cadence (07).
- **AI strategy** — providers, interface, prompt-injection posture (02, 06).
- **Auth** — the solution, and deny-by-default routing (03).
- **Security model** — pointing at Ticket 06's output.
- **IA** — navigation and the brief's shape (09).
- **What v1 explicitly does not do** — carried from the map's Out of scope.

Then, the part that matters most: **a Phase 1 build sequence as a thin vertical
slice.** One source type → fetch → normalize → canonicalize → store → cluster →
render one brief. End to end and deployed before breadth is added. Resist any
plan that builds all the ingestion adapters before anything renders.

Finally, sanity-check the whole thing against the original motivation:
**the user checks X daily, is overwhelmed, and the algorithm never learned what
they care about.** If the spec as written wouldn't replace that habit, say so
plainly — a spec that's internally consistent but doesn't solve the problem is
the failure mode this whole map exists to avoid.

Deliverable: `.scratch/zis/spec.md`.
