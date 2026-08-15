# 04 — Name the core entities and their relationships

Type: grilling
Status: open
Blocked by: none

## Question

Establish the ubiquitous language and the entity model, and write it to
`CONTEXT.md` at the repo root (per `docs/agents/domain.md`). Columns are **not**
in scope — entities, their relationships, and the terms the whole project will
use.

Starting vocabulary from the charting session, to be interrogated rather than
accepted:

- **Source** — a pollable origin (an RSS feed, an HN endpoint, a GitHub repo
  watch, a Bluesky query). Has a transport, a poll cadence, a trust weight, and
  an icon.
- **Item** — one normalized unit fetched from a Source. Is "Item" right, or
  "Article", or "Post"? The corpus mixes articles, releases, HN threads, and
  Bluesky posts — the term must cover all of them without lying about any.
- **Signal** — a detected cluster. **Size 1 is normal, not a special case.**
  Confirm the model genuinely has no singleton fork anywhere.
- **CanonicalUrl** — is this an entity in its own right (the join key for
  co-citation) or an attribute of Item? This is the crux of the clustering
  design and probably deserves to be a real table.
- **Topic**, **Entity/Tag**, **InterestProfile**, **Bookmark**, **ReadState**.

Questions to settle:

1. What separates a **Source** from a **transport**? Is "HN top stories" one
   Source, or is the transport a property of a Source row?
2. Is a **Signal** immutable once emitted into a day's brief, or does it accrete
   new Items over subsequent days? (Related fog: *Signal lifecycle*.)
3. Which entities are **global** (no `user_id`) and which are **user-scoped**?
   The charting session assumed six user-scoped tables: `user`, `session`,
   `topic_follow`, `interest_profile`, `bookmark`, `read_state`. Verify that's
   the complete list.
4. Where does the **daily brief** itself live? Is it a persisted entity (so you
   can look back at what you were shown on a given day) or a query computed on
   demand? Persisting it makes the product's history meaningful and makes the
   email digest and the web view provably identical — argue it through.

Deliverable: `CONTEXT.md` with each term defined, plus an explicit note of
synonyms the project **avoids** (e.g. if "Item" wins, "Article" is banned).

## A required entity, surfaced by source research

From [candidate-sources-platforms.md](../research/candidate-sources-platforms.md):

**Distinct-source counting needs an owning-entity dimension.** Vercel's GitHub
release, Vercel's YouTube video, and `vercel.com`'s Bluesky post are **one
organization wearing three hats**. Counting them as three distinct sources lets
any vendor manufacture a cluster about itself — precisely the "one loud account"
failure the ranking rule exists to prevent.

So the model needs something above **Source**: N platform accounts belonging to
one entity contribute **at most one** to the distinct-source count. Vendor posts
are *provenance*; independent voices are *votes*.

Settle as part of this ticket:

- What is that entity called? `Publisher`? `Entity`? `Voice`? It must cover an
  org (Vercel), a person with several accounts (Simon Willison on Bluesky + his
  blog + his GitHub), and a community (HN).
- Is it always explicit, or inferred by domain? Explicit is a curation burden;
  inferred by registrable domain is cheap but wrong for people posting on
  third-party platforms.
- The same problem exists inside one transport: **Simon Willison's three RSS
  feeds** (`everything` / `links` / `entries`) and **hnrss vs the HN adapter**.
  This entity is the general answer to both.

