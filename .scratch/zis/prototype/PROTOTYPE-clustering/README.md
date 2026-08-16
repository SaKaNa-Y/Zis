# PROTOTYPE — clustering spike (Zis issue #6)

**Throwaway.** This is not the shape the real code should take. It exists to
answer two questions against real fetched data:

1. What are the URL canonicalization rules, exactly?
2. Under what conditions is a `Signal` emitted, and does URL co-citation alone
   produce good clusters — or does the embedding second pass earn its place?

Nothing here should be lifted into the app. The validated *decisions* go in the
resolution comment on
[issue #6](https://github.com/SaKaNa-Y/Zis/issues/6); the *code* stays on a
throwaway branch.

## Run it

```sh
node run.mjs
```

Zero dependencies (Node 24 built-in `fetch`). The first run takes ~10 minutes
because it obeys the polite-fetch rule from
[#2](https://github.com/SaKaNa-Y/Zis/issues/2) — serial fetching, 700 ms
between requests to the same host, descriptive User-Agent with a contact URL.
Every response is cached in `cache/` (gitignored), so re-runs are seconds and
cost the network nothing. Delete `cache/` to refetch.

Outputs `findings.txt` (the readable log) and `findings.json` (machine-readable,
for diffing between runs).

## Files

| file | what |
|---|---|
| `net.mjs` | polite fetch + on-disk cache |
| `sources.mjs` | the corpus: Publisher → Source → Transport, plus the host→Publisher map the self-citation guard needs |
| `ingest.mjs` | RSS/Atom, HN (Firebase + Algolia), Bluesky `getAuthorFeed`, GitHub releases, newsletter issue-page hydration |
| `canonicalize.mjs` | the cascade, layers L1–L5 |
| `cluster.mjs` | eager Signal creation + merge rules + Strength |
| `cases.mjs` | the hard canonicalization cases and the C1–C10 expected clusters, as executable rows |
| `run.mjs` | runs everything, judges it, writes findings |

## What it deliberately does not do

- **No embeddings.** Part 3 uses a deterministic token-Jaccard over titles as a
  *proxy* to bound how much a second pass could add. It is not a stand-in for
  `bge-small` quality — it is an upper bound on the number of same-story pairs
  that share no URL, which is the number that decides whether the second pass is
  worth building at all.
- **No LLM anywhere.** [#14](https://github.com/SaKaNa-Y/Zis/issues/14) made
  reproducibility a correctness property of detection, so every rule here is
  deterministic and replayable. `now` is injected rather than read.
- **No database.** Everything is in memory.
