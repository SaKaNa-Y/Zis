// PROTOTYPE — throwaway. Zis issue #61.
//
// Every candidate tried so far operates on the SIGNAL side of the cosine:
// composition (#49), the cap (#49), the rung (#42), the gap to 2nd (#35), the
// spread to 5th (#35), text length (ADR-0018). All three quantities interleave
// the verdicts, and ADR-0018 named the reason: the fault is an
// EMBEDDING-KNOWLEDGE fault. `bge-small-en-v1.5` does not know Grok is a
// frontier model.
//
// Nobody has touched the INTEREST side. `#1 Frontier model releases from the
// major AI labs` contains no model name. `#9 Version releases of developer
// libraries, frameworks and runtimes` contains the words *version* and
// *releases*, which is what `announced Grok 4.6` looks like lexically. So #9
// wins on generic vocabulary while #1, the right answer, is not in the top five.
//
// The candidate: the reader's statement carries EXEMPLARS. Deterministic, no
// second model, reproducible from stored columns, and it re-embeds 20 vectors
// rather than 4,986 — ADR-0008 barely notices.
//
// Two variants, because the difference between them is the whole durability
// question:
//
//   labs   — organisation names only.  "(OpenAI, Anthropic, Google DeepMind,
//            Meta, xAI, Mistral, DeepSeek)".  Durable: the set of frontier labs
//            turns over slowly, and a reader writes it once.
//   models — product names too.  "(GPT, Claude, Gemini, Grok, Llama, DeepSeek)".
//            Stronger if it works, but it goes stale the day a lab ships under a
//            new name, and the reader is the one who has to notice.
//
// If `labs` fixes the Grok entry, the candidate is cheap and durable. If only
// `models` does, the candidate is a maintenance burden wearing a fix, and that
// is a finding against it rather than for it.
//
// METHODOLOGICAL HAZARD, stated up front because it cannot be measured away:
// there are 8 hand labels and I wrote these exemplars knowing which 4 failed.
// Every exemplar list here is therefore fitted to the failures it is being
// tested on, which is precisely the signature ADR-0012 named for fitting rather
// than measuring. This script can FALSIFY the candidate (if Grok still names #9,
// it is dead) but it cannot confirm it. Read the ADR-0018 rate warning: nothing
// here licenses a percentage.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, cos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink, textBasisOf } from './text-basis.mjs';

const out = [];
const log = (s) => { console.log(s); out.push(s); };
const T_PLUS = { own: 0.70, citing: 0.67, slug: Infinity };

// Exemplar suffixes, per statement, keyed by 1-based position in
// `interests.draft.md`. Written from general domain knowledge — the names a
// practitioner would list for each area — not lifted from the failing texts.
// ADR-0003's 200-char cap is checked below, not assumed.
const LABS = {
  1: 'OpenAI, Anthropic, Google DeepMind, Meta, xAI, Mistral, DeepSeek',
  2: 'OpenAI, Anthropic, Google, AWS Bedrock',
  3: 'OpenAI, Anthropic, Google DeepMind',
  4: 'LangChain, LlamaIndex, DSPy',
  5: 'Claude Code, Cursor, Copilot, Aider',
  6: 'Hugging Face, Ollama, llama.cpp, vLLM',
  7: 'Hugging Face, GitHub',
  8: 'OpenAI, Anthropic, Nvidia, SoftBank, xAI',
  9: 'Node, Deno, Bun, Go, Rust, Python',
  10: 'Vite, esbuild, Rollup, pnpm, Turborepo, GitHub Actions',
  11: 'Vercel',
  12: 'React, Meta',
  13: 'Vue, Nuxt, Pinia, VueUse',
  14: 'Tailwind Labs',
  15: 'TypeScript, Microsoft',
  16: 'Chrome, Safari, Firefox, WebKit',
  17: 'OWASP, Cloudflare',
  18: 'Rust, Cargo, Tokio, SWC, Biome',
  19: 'RSS, Atom, ActivityPub',
  20: '',
};

const MODELS = {
  1: 'GPT, Claude, Gemini, Grok, Llama, DeepSeek, Mistral',
  2: 'OpenAI API, Anthropic API, Gemini API, MCP, Bedrock',
  3: 'interpretability, alignment, evals',
  4: 'prompting, RAG, evals, structured output',
  5: 'Claude Code, Cursor, Copilot, Codex, Aider, Devin',
  6: 'Llama, Qwen, Mistral, GGUF, Ollama, llama.cpp, vLLM',
  7: 'GitHub stars, Hugging Face trending',
  8: 'OpenAI, Anthropic, Nvidia, xAI, funding, valuation, lawsuit',
  9: 'Node, Deno, Bun, Vite, React, TypeScript, Go, Rust, Python',
  10: 'Vite, Rollup, esbuild, pnpm, npm, Turborepo, CI',
  11: 'Next.js, Vercel, App Router, Server Actions',
  12: 'React 19, React Compiler, hooks, Suspense',
  13: 'Vue 3, script setup, Pinia, VueUse, Nuxt',
  14: 'Tailwind v4, design tokens, utility classes',
  15: 'TypeScript 5, generics, satisfies, type inference',
  16: 'CSS, HTML, Baseline, Chrome, Safari, Firefox',
  17: 'SSRF, XSS, CSRF, OAuth, sessions, CVE',
  18: 'Rust, Cargo, Tokio, SWC, Biome, Rolldown, oxc',
  19: 'RSS, Atom, JSON Feed, ActivityPub',
  20: '',
};

const augment = (statements, table) =>
  statements.map((s, i) => {
    const ex = table[i + 1];
    return ex ? `${s} (${ex})` : s;
  });

// --- the profile variants -----------------------------------------------------

const { positive } = loadInterests();
const VARIANTS = {
  base: positive,
  labs: augment(positive, LABS),
  models: augment(positive, MODELS),
};

log('=== #61 — is the INTEREST side of the cosine a lever? ===\n');
log('ADR-0003 caps a statement at 200 chars. Checked, not assumed:\n');
for (const [name, sts] of Object.entries(VARIANTS)) {
  const over = sts.filter((s) => s.length > 200);
  const max = Math.max(...sts.map((s) => s.length));
  log(`  ${name.padEnd(7)} longest ${String(max).padStart(3)} chars   over cap: ${over.length}`);
  for (const s of over) log(`      !! ${s.length}: ${s}`);
}
log('');

// --- the floor moves, and that is a cost, not a detail -----------------------
//
// §4's floor under every bar is the profile's own median pairwise cosine —
// 0.661 on the reader's real profile (#46). `T+[own]` = 0.70 was sited 0.039
// above it (#21) and re-confirmed by #49 as preserving that offset. Changing the
// statements changes the floor, so it changes where the bar belongs. §10 already
// says `T+` is conditional on `(model, profile)`; this measures the size of it.

const vecsOf = {};
for (const [name, sts] of Object.entries(VARIANTS)) {
  vecsOf[name] = await embedAll(sts, {});
}

const medianPairwise = (vs) => {
  const ps = [];
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) ps.push(cos(vs[i], vs[j]));
  ps.sort((a, b) => a - b);
  return ps[Math.floor(ps.length / 2)];
};

log('=== the floor under every bar (median pairwise cosine, n=190 pairs) ===\n');
const floors = {};
for (const name of Object.keys(VARIANTS)) {
  floors[name] = medianPairwise(vecsOf[name]);
  log(`  ${name.padEnd(7)} ${floors[name].toFixed(4)}`);
}
log('');
log(`  base -> labs   ${(floors.labs - floors.base >= 0 ? '+' : '')}${(floors.labs - floors.base).toFixed(4)}`);
log(`  base -> models ${(floors.models - floors.base >= 0 ? '+' : '')}${(floors.models - floors.base).toFixed(4)}`);
log('');
log('  A floor that MOVES means `T+` must be re-sited to preserve #21\'s offset.');
log('  That is this candidate\'s hidden price: it is not a drop-in.');
log('');

// --- the corpus --------------------------------------------------------------

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });

const eligible = signals.filter((s) => s.strength >= 2);
const built = eligible.map((s) => ({ s, url: primaryLink(s), tb: textBasisOf(s, items, Infinity) }));
const sigVecs = await embedAll(built.map((b) => b.tb.text || 'untitled'), {});

// argmax-spread.mjs's LABEL map, verbatim — the 8 hand judgements ratified by
// the reader in #46. Plus, for the four `missed` rows, the statement the reader
// WOULD have written, from §6's finding that each failure passed over a correct
// statement already in the profile (#1, #10, #8, #9). 1-based, matching the file.
const LABEL = {
  'https://huggingface.co/blog/agent-intrusion-technical-timeline': 'near',
  'https://seangoedecke.com/llms-reward-expertise': 'RIGHT',
  'https://bun.com/blog/bun-in-rust': 'RIGHT',
  'https://blog.florianherrengt.com/ai-removing-middle-class-software-engineering.html': 'missed',
  'https://codepen.io/2/whats-new': 'missed',
  'https://x.com/SpaceXAI/status/2087562800982077492': 'missed',
  'https://blog.cloudflare.com/kitesurf': 'near',
  'https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731': 'RIGHT',
  'https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview': 'missed',
};
const WANTED = {
  'https://x.com/SpaceXAI/status/2087562800982077492': 1,
  'https://blog.florianherrengt.com/ai-removing-middle-class-software-engineering.html': 8,
  'https://codepen.io/2/whats-new': 16,
  'https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview': 10,
};

const rankIn = (vec, name) =>
  vecsOf[name].map((pv, k) => ({ n: k + 1, rel: cos(vec, pv) })).sort((a, b) => b.rel - a.rel);

const rows = built.map((b, i) => {
  const r = {};
  for (const name of Object.keys(VARIANTS)) r[name] = rankIn(sigVecs[i], name);
  return { url: b.url, strength: b.s.strength, basis: b.tb.basis, text: b.tb.text, rank: r,
           label: LABEL[b.url] || null, wanted: WANTED[b.url] || null };
});

// --- the flagship case ------------------------------------------------------

log('=== the case ADR-0018 says any successor must answer ===\n');
const grok = rows.find((r) => r.url === 'https://x.com/SpaceXAI/status/2087562800982077492');
if (!grok) {
  log('  !! the Grok Signal is not in the eligible set — corpus drift, stop and re-read.');
} else {
  log(`  text: ${JSON.stringify(grok.text)}   rung ${grok.basis}  S=${grok.strength}`);
  log('  the right answer is #1 Frontier model releases. ADR-0018: not in the top five.\n');
  for (const name of Object.keys(VARIANTS)) {
    const r = grok.rank[name];
    const pos = r.findIndex((x) => x.n === 1) + 1;
    log(`  ${name.padEnd(7)} winner #${String(r[0].n).padStart(2)} at ${r[0].rel.toFixed(3)}   ` +
        `#1 sits at rank ${pos} (${r.find((x) => x.n === 1).rel.toFixed(3)})   ` +
        `gap2 ${(r[0].rel - r[1].rel).toFixed(3)}`);
    log(`          top5: ${r.slice(0, 5).map((x) => `#${x.n}@${x.rel.toFixed(3)}`).join('  ')}`);
  }
}
log('');

// --- every labelled row, under every variant --------------------------------

log('=== the 8 hand-labelled rows (9 entries; kitesurf is not admitted) ===\n');
log('  verdict  wanted   base            labs            models          text');
for (const r of rows.filter((x) => x.label)) {
  const cell = (name) => {
    const t = r.rank[name][0];
    const hit = r.wanted && t.n === r.wanted ? '*' : ' ';
    return `#${String(t.n).padStart(2)}@${t.rel.toFixed(3)}${hit}`;
  };
  log(`  ${(r.label || '').padEnd(8)} ${String(r.wanted ? `#${r.wanted}` : '—').padEnd(7)} ` +
      `${cell('base').padEnd(15)} ${cell('labs').padEnd(15)} ${cell('models').padEnd(15)} ` +
      `${JSON.stringify((r.text || '').slice(0, 44))}`);
}
log('');
log('  `*` marks the variant naming the statement the reader would have written.');
log('');

// --- did the RIGHT rows survive? -------------------------------------------

log('=== the three RIGHT rows — does the candidate break what already works? ===\n');
for (const r of rows.filter((x) => x.label === 'RIGHT')) {
  log(`  ${JSON.stringify((r.text || '').slice(0, 52))}`);
  for (const name of Object.keys(VARIANTS)) {
    const t = r.rank[name][0];
    log(`    ${name.padEnd(7)} #${String(t.n).padStart(2)} @ ${t.rel.toFixed(3)}`);
  }
}
log('');

// --- and what it does to admission at large --------------------------------
//
// The bars are per-rung and were sited against `base`. Reported at the SHIPPED
// bars and at bars shifted to preserve #21's offset over the moved floor, because
// quoting only the first would credit the candidate with admissions it bought by
// inflating cosine — §4.1's select-for-pollution result, three times over.

log('=== admission over the 27 eligible, at shipped bars and at offset-preserving bars ===\n');
for (const name of Object.keys(VARIANTS)) {
  const shift = floors[name] - floors.base;
  const admittedShipped = rows.filter((r) => r.rank[name][0].rel >= T_PLUS[r.basis]).length;
  const admittedShifted = rows.filter((r) => r.rank[name][0].rel >= T_PLUS[r.basis] + shift).length;
  const churn = rows.filter((r) => r.rank[name][0].n !== r.rank.base[0].n).length;
  log(`  ${name.padEnd(7)} admitted ${String(admittedShipped).padStart(2)} at shipped bars, ` +
      `${String(admittedShifted).padStart(2)} at bars +${shift.toFixed(4)}   ` +
      `argmax changed on ${churn}/${rows.length} eligible`);
}
log('');
log('  Under §9.1 these counts justify nothing: no change to `E1`, `T+` or a');
log('  selector may be justified by how many entries it adds.');
log('');

writeFileSync(join(import.meta.dirname, 'interest-exemplars.txt'), out.join('\n') + '\n');
writeFileSync(
  join(import.meta.dirname, 'interest-exemplars.json'),
  JSON.stringify({ floors, variants: VARIANTS, rows: rows.map((r) => ({
    url: r.url, strength: r.strength, basis: r.basis, text: r.text, label: r.label, wanted: r.wanted,
    top: Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, r.rank[n].slice(0, 5)])),
  })) }, null, 2),
);
log('wrote interest-exemplars.txt / .json');
