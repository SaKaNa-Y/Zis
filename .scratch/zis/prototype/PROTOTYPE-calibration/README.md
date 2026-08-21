# PROTOTYPE — relevance calibration (Zis issue #21)

**Throwaway.** This is not the shape the real code should take. It exists to site
the four numbers [`docs/ranking-model.md`](../../../../docs/ranking-model.md)
marked provisional, against the corpus
[#6](https://github.com/SaKaNa-Y/Zis/issues/6) measured and a handwritten
Interest Profile.

The validated *decisions* are in the resolution comment on
[issue #21](https://github.com/SaKaNa-Y/Zis/issues/21) and written into
`docs/ranking-model.md`. Nothing here should be lifted into the app.

## Run it

```sh
pnpm install --ignore-workspace
node run.mjs            # the four outputs                              (#21)
node argmax-check.mjs   # is the citing rung's definition load-bearing?  (#21)
node argmax-margin.mjs  # margin over 2nd, and per-Interest vagueness    (#35)
node argmax-spread.mjs  # spread to 5th, floor sweep, rung precedence    (#35)
node argmax-replay.mjs  # the 30-day replay under a gap floor            (#35)
```

The corpus comes from `../PROTOTYPE-clustering/cache/` — 958 cached responses, so
the run costs the network nothing and is byte-reproducible. `now` is **injected**
(the newest Item's timestamp), not read from the clock: with a real clock every
Signal is older than `E2`'s 7-day cutoff and every Brief comes out empty.

`bge-small-en-v1.5` runs **locally** via `transformers.js` under
[#3](https://github.com/SaKaNa-Y/Zis/issues/3)'s pin-the-model finding — the
model is open-weight, so these are the same vectors Cloudflare Workers AI would
return. No provider call, no quota, no key. First run downloads ~130 MB of ONNX
weights into `node_modules`.

## Files

| file | what |
|---|---|
| `interests.draft.md` | the handwritten Interest Profile — 18 statements. **Edit this, not a literal in a script** |
| `interests.mjs` | parses that file |
| `ingest-text.mjs` | fork of #6's `ingest.mjs` with two additions: Item body `text`, and per-link **anchor text** |
| `text-basis.mjs` | `text_basis` — which rung a Signal sits on and what it embeds, at a given cut time |
| `embed.mjs` | local `bge-small`, CLS-pooled and normalised |
| `run.mjs` | the four outputs, plus the per-day replay across a grid of candidate bars |
| `argmax-check.mjs` | five definitions of the `citing` rung, argmax measured under each |
| `argmax-margin.mjs` | **#35** — margin over 2nd place, and each Interest's mean cosine to the reader's *other* Interests (the vagueness proxy that killed ADR-0003's self-repair clause) |
| `argmax-spread.mjs` | **#35** — spread to 5th place, a gap-floor sweep over the admitted set, and `own`-vs-`citing` rung precedence |
| `argmax-replay.mjs` | **#35** — `run.mjs`'s 30-day replay re-run at the settled per-rung bars with a gap floor swept over it, for the density and separability cost |
| `findings.txt` / `.json` | output of `run.mjs` |
| `argmax-check.txt` / `.json` | output of `argmax-check.mjs` |
| `argmax-margin.txt` / `.json` | output of `argmax-margin.mjs` |
| `argmax-spread.txt` / `.json` | output of `argmax-spread.mjs` |
| `argmax-replay.txt` / `.json` | output of `argmax-replay.mjs` |

## The hand labels, and why they are in a script

`argmax-spread.mjs` carries a `LABEL` map — my judgement of whether each admitted
Signal's why-text is one the reader would have written, ratified by the reader
during [#35](https://github.com/SaKaNa-Y/Zis/issues/35). **There is no labelled
corpus**, so every accuracy figure in that ticket rests on 8 hand judgements. They
live in the script rather than in prose so the sort is auditable and so a
disagreement can be re-run rather than argued.

This is also why `T_gap` is **fitted, not sited**: 8 points, no holdout, and *two*
different quantities (gap to 2nd, spread to 5th) separated them equally well —
which is the signature of fitting. The direction has a mechanism behind it (#21's
0.659 floor); the number is a placeholder.

## What it deliberately does not do

- **No database, no LLM, no provider call.** Every rule is deterministic and
  replayable, because [#14](https://github.com/SaKaNa-Y/Zis/issues/14) made
  reproducibility a correctness property.
- **No re-fetch of the corpus.** It imports #6's `net` / `sources` /
  `canonicalize` / `cluster` modules rather than copying them, so this measures
  the same corpus and not a lookalike.
- **No tuning loop.** There is no labelled data to tune against, which is why the
  outputs are distributions and a bar-vs-density grid rather than a fitted number.

## The two additions to #6's ingest, and why

#6 threw away everything except the URL, because clustering needs an address.
Relevance needs text, and the two things it needs most were both discarded:

1. **Item body text**, for the `own` rung. Without it that rung cannot be
   measured at all.
2. **Anchor text per outbound link**, which turned out to be the whole ballgame.
   #6 kept `href` and dropped the label. But a newsletter's Item *title* is the
   **issue** title — `Zuckerberg's manifesto 🤖, Elon's $1T shortcut 💰` — and
   newsletters are this corpus's densest citers, so §4's "concatenated titles of
   the Items citing it" embeds the wrong subject for most of the corpus. See
   `argmax-check.txt`: the two definitions agree on the argmax Interest **2 times
   in 26**, and the wrong text scores *higher*.

## The one measurement trap worth repeating

The `27 Signals at Strength >=2` figure is a **backfill** yield over feed windows
spanning 2,064 days. Every per-day number in `findings.txt` is replayed from
**Citation timestamps** over the last 30 days the corpus covers. Nothing is 27
divided by anything convenient.
