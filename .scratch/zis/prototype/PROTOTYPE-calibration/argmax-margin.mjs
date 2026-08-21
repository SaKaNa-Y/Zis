// PROTOTYPE — throwaway. Zis issue #35.
//
// #21's argmax-check.mjs asked whether the CITING RUNG'S DEFINITION was to blame
// for the wrong argmax. Answer: no, it is stably wrong. This script asks the two
// questions #35's levers actually hang on, and that argmax-check.json cannot
// answer because it stored only the winner:
//
//   1. MARGIN. Is the Interest a reader would have named sitting in 2nd place a
//      hair behind, or is it nowhere? A tiny margin means "low confidence" is a
//      real, deterministic, stored-column signal. A wide margin means the model
//      is confidently wrong and there is no confidence to render.
//
//   2. VAGUE vs NARROW. ADR-0003's feedback loop repairs a wrong why-text by
//      making a VAGUE Interest visible so the reader sharpens it. That only
//      works if the wrong winners ARE the vague statements. Vagueness has a
//      deterministic proxy: an Interest's mean cosine to the reader's OTHER
//      Interests — a statement that sits close to everything is vague. If the
//      wrong winners are NARROW (low centrality), the loop cannot repair them.
//
//   3. RUNG PRECEDENCE. §4 makes `own` beat `citing` unconditionally. On the
//      admitted set, does the losing rung sometimes score HIGHER and name
//      BETTER? (blog.cloudflare.com/kitesurf looks like exactly that.)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, cos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink, textBasisOf } from './text-basis.mjs';

const out = [];
const log = (s) => { console.log(s); out.push(s); };

/** The settled per-rung bars — docs/ranking-model.md §4. `slug` fails by rule. */
const T_PLUS = { own: 0.70, citing: 0.67, slug: Infinity };

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

// ---------------------------------------------------------------- (2) vagueness
// Centrality = mean cosine to the reader's other Interests. The profile's median
// PAIRWISE cosine is 0.659 (#21) — that is the floor under every bar. Centrality
// is the per-STATEMENT version of the same number.
const centrality = posVecs.map((v, i) => {
  let sum = 0;
  for (let j = 0; j < posVecs.length; j++) if (j !== i) sum += cos(v, posVecs[j]);
  return sum / (posVecs.length - 1);
});
const ranked = centrality.map((c, i) => ({ i, c })).sort((a, b) => b.c - a.c);
log('=== per-Interest centrality (mean cosine to the reader\'s OTHER Interests) ===');
log('   the vagueness proxy: a statement close to everything is vague.');
log(`   profile median pairwise cosine (#21): 0.659\n`);
for (const { i, c } of ranked) {
  log(`  ${c.toFixed(3)}  #${String(i + 1).padStart(2)} ${positive[i].slice(0, 78)}`);
}

// ------------------------------------------------------- the admitted-by-interest set
const eligible = signals.filter((s) => s.strength >= 2);
const built = eligible.map((s) => {
  const tb = textBasisOf(s, items, Infinity);
  return { s, url: primaryLink(s), tb };
});
const vecs = await embedAll(built.map((b) => b.tb.text || 'untitled'), {});

const rows = [];
for (let i = 0; i < built.length; i++) {
  const b = built[i];
  const scores = posVecs.map((pv, k) => ({ k, rel: cos(vecs[i], pv) })).sort((a, b2) => b2.rel - a.rel);
  const top = scores[0];
  rows.push({
    url: b.url,
    strength: b.s.strength,
    basis: b.tb.basis,
    text: b.tb.text,
    rel: top.rel,
    admitted: top.rel >= T_PLUS[b.tb.basis],
    top5: scores.slice(0, 5).map(({ k, rel }) => ({ idx: k, rel, centrality: centrality[k] })),
  });
}

const admitted = rows.filter((r) => r.admitted).sort((a, b) => b.rel - a.rel);
log(`\n\n=== the ADMITTED-BY-INTEREST set — REL+ >= T+[rung] — n=${admitted.length} of ${rows.length} eligible ===`);
log('   this, not the eligible set, is what a reader would actually have READ.\n');
for (const r of admitted) {
  const m = r.top5[0].rel - r.top5[1].rel;
  log(`REL+ ${r.rel.toFixed(3)}  S=${r.strength}  ${r.basis.padEnd(6)}  margin over 2nd: ${m.toFixed(3)}`);
  log(`  ${r.url}`);
  log(`  text: ${r.text.slice(0, 130)}`);
  for (let n = 0; n < r.top5.length; n++) {
    const t = r.top5[n];
    log(`   ${n === 0 ? '->' : '  '} ${t.rel.toFixed(3)} (centrality ${t.centrality.toFixed(3)})  #${t.idx + 1} ${positive[t.idx].slice(0, 62)}`);
  }
  log('');
}

const margins = admitted.map((r) => r.top5[0].rel - r.top5[1].rel).sort((a, b) => a - b);
const q = (p) => margins[Math.min(margins.length - 1, Math.floor(p * margins.length))];
log(`margin over 2nd place, admitted set: min ${q(0).toFixed(3)}  med ${q(0.5).toFixed(3)}  max ${margins[margins.length - 1].toFixed(3)}`);
log('  — a margin near zero is a deterministic low-confidence signal available from stored columns.');
log('  — a wide margin on a WRONG winner means there is no confidence to render.');

// --------------------------------------------------- (3) does precedence cost us?
log('\n\n=== rung precedence: does the LOSING rung score higher and name better? ===');
log('   §4 makes `own` beat `citing` unconditionally. Measured on `own`-rung eligible Signals.\n');
const ownRung = built.filter((b) => b.tb.basis === 'own');
const altTexts = ownRung.map((b) => {
  // Re-derive what the citing rung WOULD have said, by hiding the self citations.
  const stripped = { ...b.s, citations: b.s.citations.filter((c) => c.kind !== 'self') };
  return textBasisOf(stripped, items, Infinity);
});
const altVecs = await embedAll(altTexts.map((t) => t.text || 'untitled'), {});
for (let i = 0; i < ownRung.length; i++) {
  const b = ownRung[i];
  const ownScores = posVecs.map((pv, k) => ({ k, rel: cos(vecs[built.indexOf(b)], pv) })).sort((a, c) => c.rel - a.rel);
  const altScores = posVecs.map((pv, k) => ({ k, rel: cos(altVecs[i], pv) })).sort((a, c) => c.rel - a.rel);
  log(`${b.url}  (S=${b.s.strength})`);
  log(`  own    ${ownScores[0].rel.toFixed(3)}  #${ownScores[0].k + 1} ${positive[ownScores[0].k].slice(0, 58)}`);
  log(`  citing ${altScores[0].rel.toFixed(3)}  #${altScores[0].k + 1} ${positive[altScores[0].k].slice(0, 58)}`);
  log(`         citing text: ${(altTexts[i].text || '—').slice(0, 100)}`);
  log('');
}

writeFileSync(join(import.meta.dirname, 'argmax-margin.txt'), out.join('\n') + '\n');
writeFileSync(join(import.meta.dirname, 'argmax-margin.json'), JSON.stringify({ interests: positive, centrality, rows }, null, 2));
log('wrote argmax-margin.txt + argmax-margin.json');
