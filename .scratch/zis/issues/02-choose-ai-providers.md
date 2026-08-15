# 02 — Choose AI providers for generation and embeddings

Type: research
Status: resolved
Blocked by: none

## Question

The workload is small and well-bounded: **summarize ~5–10 clusters/day**,
**embed a few hundred items/day**, plus a later conversational assistant over
the corpus. Detection is deterministic (URL co-citation), so the AI is not on
the critical path for the core differentiator.

The user's stated preference is **DeepSeek**, kept simple, with correct API-key
handling. Two things to verify and then design around:

1. **DeepSeek reality check.** Is there a genuine free tier, or is it merely
   cheap? Current per-token pricing for the chat/reasoner models. **Does it
   offer an embeddings endpoint at all?** (Believed not — confirm.) Structured
   output / JSON-mode support and how reliable it is. Rate limits. Context
   window. Is it OpenAI-API-compatible? **Are free or paid tier inputs used for
   training?**
2. **Embeddings provider**, needed separately if DeepSeek has no embeddings
   endpoint. Compare on free quota, dimensions, and quality:
   - Google Gemini (`text-embedding-004` / current equivalent)
   - Cloudflare Workers AI (`bge-small-en-v1.5`, `bge-base`)
   - Voyage AI free tier
   - **Local/self-hosted in the Node process** (e.g. `transformers.js` with
     bge-small) — no API, no quota, no key. At a few hundred embeddings a day
     this may genuinely be the right answer; assess whether it's viable inside a
     Vercel function's memory and time limits, or whether it forces the cron
     into GitHub Actions where runtime is free.

Note the storage consequence: **384-dim `halfvec` ≈ 0.75 KB/item; 1536-dim
`vector` ≈ 6 KB/item.** Against a 0.5 GB Neon free tier this is a real
constraint, so dimension count is a first-class selection criterion, not a
detail.

Also settle: **where do API keys live** (Vercel env vars, GitHub Actions
secrets — the cron runs in Actions, so keys may be needed in both places) and
what stops them reaching the browser.

Deliverable: one named provider for generation, one for embeddings, with the
`AiProvider` / `EmbeddingProvider` interface shape sketched. Note explicitly
that embedding providers are **not** hot-swappable — changing one forces a full
corpus re-embed — so the choice should favour stability over marginal quality.

## Answer

**Generation: DeepSeek `deepseek-v4-flash`.** **Embeddings:
`bge-small-en-v1.5` (384-dim), served via Cloudflare Workers AI REST**, with
`transformers.js` as a drop-in local runtime for the *same weights*.

The second pick is deliberately framed as a **model** choice, not a vendor
choice — see "Why the model, not the vendor" below. It is the single decision
that makes the non-hot-swappable constraint tolerable.

### 1. DeepSeek reality check

| Question | Answer |
|---|---|
| Free tier? | **No.** Pricing docs describe only a topped-up or granted balance. "Granted balance" is promotional credit, never defined as a free tier. Treat DeepSeek as *cheap*, not *free*. |
| Embeddings endpoint? | **No — confirmed.** `/v1/embeddings` returns 404. The upstream request ([DeepSeek-V3 #806](https://github.com/deepseek-ai/DeepSeek-V3/issues/806)) was closed as *not planned*. The only documented endpoint is `/chat/completions` (plus FIM, prefix completion, tool calls, context caching, thinking mode). A separate embeddings provider is mandatory. |
| OpenAI-compatible? | **Yes.** `base_url: https://api.deepseek.com` with the stock `openai` npm package. An Anthropic-format endpoint also exists at `/anthropic`. |
| Structured output | `response_format: { type: 'json_object' }` only. **No JSON Schema mode.** Three documented caveats: the prompt must contain the literal word "json"; you should embed a sample of the target shape; and *"the API may occasionally return empty content."* Plan for validate-and-retry — this is the main integration risk. |
| Context / output | 1M context, 384K max output on V4. Not a constraint here. |
| Rate limits | Concurrency-based, not RPM: 2,500 concurrent for v4-flash, 500 for v4-pro, account-wide. Irrelevant at 5–10 calls/day. |
| Training on inputs? | **Yes, by default.** Privacy policy (updated 2026-02-10) lists User Input under *"train and improve our technology."* An opt-out right exists — email privacy@deepseek.com. Data is stored **in the PRC**; governing law is PRC, jurisdiction Hangzhou. |

**Model naming — act on this.** `deepseek-chat` and `deepseek-reasoner` are
**retired after 2026-07-24**. Use explicit `deepseek-v4-flash`. Any tutorial
using the old aliases is stale.

**Pricing** (USD / 1M tokens, current):

| Model | Cache hit | Cache miss | Output |
|---|---|---|---|
| `deepseek-v4-flash` | $0.0028 | $0.14 | $0.28 |
| `deepseek-v4-pro` | $0.003625 | $0.435 | $0.87 |

⚠️ **From 16:00 UTC 2026-08-16** billing moves to peak/off-peak. Despite the
"discount" framing this is a **price increase**: v4-flash off-peak becomes
$0.22 cache-miss / $0.66 output — higher than today's flat rate — and peak is
double that. Peak windows are 01:00–04:00 and 06:00–10:00 UTC.

**Cost at our workload.** 10 clusters/day × ~8K input + ~500 output:

- Today: ~$0.013/day → **~$0.40/month**
- After 2026-08-16, off-peak: ~$0.021/day → **~$0.63/month**; all-peak worst
  case ~$1.26/month.

Under $2/month at any pricing on the table. **Schedule the digest run off-peak**
(the brief is daily and time-flexible) and it halves. This is a rounding error;
DeepSeek is the right call on the user's stated preference and nothing in the
research contradicts it.

**Privacy posture.** Acceptable, because of an existing map invariant: *the LLM
names and summarizes clusters, it never detects them*. So DeepSeek only ever
sees **already-public article text**. The explicit interest model — the one
genuinely personal artifact — feeds deterministic ranking and embeddings, and
**must never be put in a DeepSeek prompt**. Record that as a constraint on the
prompt-construction ticket. Exercise the training opt-out anyway; it is one
email and costs nothing.

### 2. Embeddings — the comparison

Workload: ~300 items/day, ~500 tokens each ≈ **150K tokens/day**.

| Option | Dims | Storage/yr* | Free quota at our volume | Verdict |
|---|---|---|---|---|
| **CF Workers AI `bge-small-en-v1.5`** | **384** | **~82 MB** | 10,000 neurons/day free; we use **~276/day (2.8%)** | ✅ **Pick** |
| CF Workers AI `bge-base-en-v1.5` | 768 | ~164 MB | ~910 neurons/day (9%) | Viable, 2× storage for marginal gain |
| Gemini `gemini-embedding-2` | 128–3072 (MRL) | 82 MB @384 | Free-tier embedding quota **not published**; docs punt to AI Studio | ❌ Free tier trains on your data |
| Voyage `voyage-4-lite` | 256–2048 (MRL) | ~82 MB @256 | 200M free tokens ≈ **3.6 years**, then $0.02/M | Strong runner-up |
| **Local `transformers.js` + bge-small** | **384** | **~82 MB** | Free, no key, no quota | ✅ **Same weights — use as fallback** |

\* 300 items/day × 365 at 384-dim `halfvec` = 768 B/item. Contrast **1536-dim
`vector` at 4 B/component = 6 KB/item → ~657 MB/yr**, which **exceeds the 0.5 GB
Neon free tier inside one year** before any other table. The ticket's framing is
correct: dimension count is a hard constraint, not a detail. 384-dim leaves ~6×
headroom.

**Why not Gemini.** Disqualified on terms, not quality. Google's API terms are
explicit that on unpaid services it *"uses the content you submit… to provide,
improve, and develop Google products"* and that *"human reviewers may read,
annotate, and process your API input and output."* Free-tier embedding rate
limits are also not documented — the docs defer to a per-project AI Studio view,
which is not something to build a daily cron against. (Paid tier does not train;
EEA/UK/CH get paid-tier handling even when free.)

**Why not Voyage.** Genuinely good, and 200M free tokens is ~3.6 years at our
rate. But it is a proprietary model: when the free tokens end or the model is
deprecated, there is **no escape hatch that avoids a full re-embed**. That is
exactly the failure mode the ticket says to avoid. Keep as the upgrade path if
retrieval quality ever proves the bottleneck.

### 3. Why the model, not the vendor — the key insight

The ticket's real constraint is that *changing an embedding provider forces a
full corpus re-embed*. That is only true when the **model** changes.
`bge-small-en-v1.5` is **open-weight BAAI**, byte-identical whether it runs on
Cloudflare's GPUs or in-process via `transformers.js`.

So: **pin the model, treat the runtime as swappable.** Cloudflare going away,
changing pricing, or rate-limiting us costs a config change, not a re-embed. No
other option in the comparison offers this. It converts the scariest
irreversible decision in the stack into a reversible one, which is worth more
than the few MTEB points Voyage or Gemini would buy.

Two correctness details, easy to get wrong:

- **Pooling is `cls`, not `mean`.** BGE is trained for CLS pooling. The older
  `Xenova/bge-small-en-v1.5` model card wrongly shows `mean`; the
  `onnx-community` card shows `cls`. Getting this wrong silently degrades
  retrieval.
- **Query prefix.** BGE expects a retrieval instruction prefix on *queries*
  only, never on stored documents. Hence two methods on the interface, below.

**Language caveat:** `bge-small-en-v1.5` is English-only. Our sources (HN,
GitHub, Lobsters, Bluesky, curated RSS) are overwhelmingly English, so this is
acceptable. If multilingual becomes a requirement, `bge-m3` is the successor —
but it is 1024-dim and would force a re-embed. Decide now, not later.

### 4. Local `transformers.js` — viable, but as fallback not primary

Assessed honestly, both ways:

**Against running it on Vercel:** the blocker is not the model (~30 MB
quantized) but `onnxruntime-node`, reported at **~720 MB uncompressed** against
Vercel's **250 MB** function limit ([transformers.js
#1164](https://github.com/huggingface/transformers.js/issues/1164) — still open,
no maintainer fix).

**For it:** that ceiling has moved. Vercel **Large Functions** now allow **5 GB**
uncompressed on the Node runtime, enabled by default for new projects (opt in
with `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`), and Hobby now gets **2 GB memory /
300 s duration**. So it would fit — but it's a beta feature, and every cold
container re-loads the model.

**Correction to the ticket's premise:** it asks whether local embedding "forces
the cron into GitHub Actions." Per `map.md` the settled architecture is *Actions
cron hitting an authenticated Vercel route handler* — Actions is the trigger,
Vercel is the compute. Moving embedding into Actions would mean moving the
ingestion pipeline itself there, which is a re-architecture, not a config
choice. **Don't do that for embeddings.** Cloudflare gives the identical vectors
over a plain HTTPS call with none of that disruption.

Keep local as: (a) the offline backfill/re-embed path, run as a one-off Actions
workflow where runtime is free and unmetered — genuinely the right tool for a
100K-item batch; (b) the zero-dependency path for Vitest, so tests need no
network or key.

### 5. Interface sketches

```ts
// src/lib/ai/types.ts  — import 'server-only' at the top of every impl file

export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;   // DeepSeek default 1.0; use ~0.3 for summarization
  signal?: AbortSignal;
}

export interface AiProvider {
  readonly id: string;      // 'deepseek'
  readonly model: string;   // 'deepseek-v4-flash'

  /** Free-text completion. For the later conversational assistant. */
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;

  /**
   * JSON-mode completion, parsed and validated against `schema`.
   * MUST retry on parse/validation failure and on empty content —
   * DeepSeek documents that json_object occasionally returns "".
   * Implementation injects the literal word "json" plus a shape sample
   * into the prompt, as the API requires.
   */
  generateJson<T>(
    prompt: string,
    schema: StandardSchemaV1<T>,
    opts?: GenerateOptions,
  ): Promise<T>;
}

export interface EmbeddingProvider {
  readonly id: string;          // 'cloudflare' | 'local'
  /** Identifies the WEIGHTS. Persist alongside every vector. */
  readonly model: string;       // 'bge-small-en-v1.5'
  readonly dimensions: 384;     // literal type — schema depends on it
  readonly maxBatchSize: number;

  /** Stored corpus text. No instruction prefix. */
  embedDocuments(texts: string[]): Promise<Float32Array[]>;

  /** Search text. Applies the BGE query instruction prefix. */
  embedQuery(text: string): Promise<Float32Array>;
}
```

Notes for the implementing ticket:

- `dimensions` as a **literal** `384` lets the Drizzle `halfvec(384)` column and
  the provider fail to compile if they ever disagree.
- Store `embedding_model` and `embedding_dim` **columns next to the vector**.
  Without them a partial re-embed is undetectable and silently corrupts
  similarity search. This is the cheap insurance against the one irreversible
  decision here.
- Two methods, not one, solely because of the BGE query prefix. Resist
  collapsing them.
- `generateJson` returning a validated `T` (rather than a raw string) is what
  contains the DeepSeek empty-content flakiness at the boundary instead of
  letting it leak into every caller.

### 6. Where the API keys live

The cron is a *trigger*: Actions calls an authenticated Vercel route, and all AI
calls happen server-side on Vercel. So AI keys live in **exactly one place**.

| Secret | Vercel env | Actions secret | Note |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ | ❌ | Server-only |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | ❌ | Not secret, but keep it together |
| `CLOUDFLARE_API_TOKEN` | ✅ | ❌ | Scope: `Workers AI — Read` + `Edit` |
| `CRON_SECRET` | ✅ | ✅ | The *only* shared secret — Actions must send it |

If the offline re-embed workflow (§4) is ever built, it needs **no key at all**:
`transformers.js` runs the same weights locally in the Actions runner.

**What keeps them out of the browser:**

1. Next.js only inlines env vars prefixed `NEXT_PUBLIC_`. Never prefix these.
2. Put `import 'server-only'` at the top of every provider module — importing it
   from a Client Component then becomes a **build error**, not a runtime leak.
3. Read `process.env.*` inside the provider at call time; never pass a
   configured client through props or a Server Component boundary.
4. Providers are constructed only in route handlers / Server Actions.
5. Set the Vercel vars for Production and Preview only, and keep `.env.local`
   gitignored. Worth a Vitest assertion that no `NEXT_PUBLIC_` var matches
   `/KEY|TOKEN|SECRET/`.

### 7. Residual risks

- **DeepSeek JSON-mode empty responses** — documented by DeepSeek, unquantified.
  Mitigated by retry in `generateJson`; if it proves noisy in practice, the
  fallback is prompt-and-parse without `response_format`, not a provider change.
- **The 2026-08-16 repricing lands tomorrow.** Numbers above are modelled, not
  observed. Check the first real invoice; nothing in the design depends on the
  exact figure.
- **PRC data residency** is inherent to DeepSeek and not mitigable. Acceptable
  only because inputs are public article text. If that ever changes, this
  decision must be reopened.
- **`bge-small` is English-only.** Accepted deliberately; revisiting means a full
  re-embed.

### Sources

[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) ·
[DeepSeek API](https://api-docs.deepseek.com/) ·
[JSON mode](https://api-docs.deepseek.com/guides/json_mode) ·
[Rate limits](https://api-docs.deepseek.com/quick_start/rate_limit) ·
[DeepSeek privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) ·
[Open Platform ToS](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html) ·
[DeepSeek-V3 #806 (no embeddings)](https://github.com/deepseek-ai/DeepSeek-V3/issues/806) ·
[Workers AI models](https://developers.cloudflare.com/workers-ai/models/) ·
[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) ·
[Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) ·
[Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) ·
[Gemini API terms](https://ai.google.dev/gemini-api/terms) ·
[Voyage pricing](https://docs.voyageai.com/docs/pricing) ·
[Voyage models](https://docs.voyageai.com/docs/embeddings) ·
[Vercel function limits](https://vercel.com/docs/functions/limitations) ·
[transformers.js #1164](https://github.com/huggingface/transformers.js/issues/1164)
