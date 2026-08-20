// PROTOTYPE — throwaway. Zis issue #21.
//
// `bge-small-en-v1.5`, 384-dim, run LOCALLY under #3's pin-the-model finding:
// the model is open-weight, so the same vectors come from Cloudflare Workers AI
// or from here. No provider call, no quota, no key.

import { pipeline } from '@huggingface/transformers';

const MODEL = 'Xenova/bge-small-en-v1.5';

/**
 * BGE's own model card asks for an instruction prefix on the QUERY side of an
 * asymmetric retrieval pair, and says short-to-short symmetric tasks need none.
 * An Interest statement against a Signal's text is somewhere between the two,
 * and the choice moves every cosine — so it is a calibration variable, not a
 * detail, and both are measured rather than assumed.
 */
export const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

let extractor = null;

export async function loadModel(log = () => {}) {
  if (extractor) return extractor;
  log(`  loading ${MODEL} (384-dim, local, no provider call)`);
  extractor = await pipeline('feature-extraction', MODEL);
  return extractor;
}

/** Normalised CLS-pooled vectors, batched. Order is preserved. */
export async function embedAll(texts, { batch = 32, log = () => {}, label = '' } = {}) {
  const p = await loadModel(log);
  const out = [];
  for (let i = 0; i < texts.length; i += batch) {
    const slice = texts.slice(i, i + batch).map((t) => (t && t.length ? t : 'untitled'));
    const r = await p(slice, { pooling: 'cls', normalize: true });
    out.push(...r.tolist());
    if (label && (i / batch) % 10 === 0) log(`    ${label}: ${Math.min(i + batch, texts.length)}/${texts.length}`);
  }
  return out;
}

export function cos(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** argmax cosine over a set of Interest vectors — `REL+` / `REL-` of §1. */
export function maxCos(vec, interestVecs) {
  let best = -1;
  let idx = -1;
  for (let i = 0; i < interestVecs.length; i++) {
    const c = cos(vec, interestVecs[i]);
    if (c > best) {
      best = c;
      idx = i;
    }
  }
  return { rel: best, idx };
}

/** Embeds on demand, caching by exact text. The replay re-asks for the same strings. */
export function makeCachedEmbedder(log = () => {}) {
  const cache = new Map();
  return async function embedCached(texts) {
    const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
    if (missing.length) {
      const vecs = await embedAll(missing, { log });
      missing.forEach((t, i) => cache.set(t, vecs[i]));
    }
    return texts.map((t) => cache.get(t));
  };
}
