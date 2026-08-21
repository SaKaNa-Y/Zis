// PROTOTYPE — throwaway. Zis issue #35, second follow-up.
//
// argmax-margin.mjs established that the gap to 2nd place does NOT separate
// "the right Interest lost narrowly" from "no Interest covers this at all".
// This script tests a different quantity, and one with a principled story
// behind it rather than a fitted one.
//
// SPREAD = REL+(1st) - REL+(5th) over the reader's Interests.
//
// The story: #21 measured the reader's own statements at a median pairwise
// cosine of 0.659 — they are nearly as similar to each other as a Signal is to
// its best match. That is the floor under every bar. Its consequence for the
// ARGMAX, which #21 did not draw out: when a Signal's text is generic, EVERY
// Interest scores about the same, so the winner is decided by noise. When the
// text is specific, one Interest pulls clear.
//
// So spread does not measure "how relevant is this" — REL+ already does that,
// and badly. It measures "does this profile have an OPINION about this Signal".
// A flat ranking is the profile saying it does not, in the only vocabulary it
// has.
//
// Also measured, because it changes how the rung-precedence fix is priced:
// spread per rung, so "pick the rung the profile has an opinion on" can be
// compared against "pick the rung that scores highest" (§4 picks neither — it
// picks `own` unconditionally).

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

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

const rank = (vec) => posVecs.map((pv, k) => ({ k, rel: cos(vec, pv) })).sort((a, b) => b.rel - a.rel);
const spreadOf = (r) => r[0].rel - r[4].rel;

const eligible = signals.filter((s) => s.strength >= 2);

// The settled rung, per §4.
const built = eligible.map((s) => ({ s, url: primaryLink(s), tb: textBasisOf(s, items, Infinity) }));
const vecs = await embedAll(built.map((b) => b.tb.text || 'untitled'), {});

// What the CITING rung would have said, for every Signal that §4 puts on `own`.
const alt = built.map((b) =>
  b.tb.basis === 'own'
    ? textBasisOf({ ...b.s, citations: b.s.citations.filter((c) => c.kind !== 'self') }, items, Infinity)
    : null,
);
const altVecs = await embedAll(alt.map((t) => (t && t.text) || 'untitled'), {});

// My hand labels from the ticket's round 1, ratified by the reader. Recorded
// here so the sort below is auditable rather than asserted.
const LABEL = {
  'https://huggingface.co/blog/agent-intrusion-technical-timeline': 'near',
  'https://seangoedecke.com/llms-reward-expertise': 'RIGHT',
  'https://bun.com/blog/bun-in-rust': 'RIGHT',
  'https://blog.florianherrengt.com/ai-removing-middle-class-software-engineering.html': 'uncovered',
  'https://codepen.io/2/whats-new': 'uncovered',
  'https://blog.cloudflare.com/kitesurf': 'near',
  'https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731': 'RIGHT',
  'https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview': 'uncovered',
};

const rows = built.map((b, i) => {
  const r = rank(vecs[i]);
  return {
    url: b.url,
    strength: b.s.strength,
    basis: b.tb.basis,
    text: b.tb.text,
    rel: r[0].rel,
    idx: r[0].k,
    gap2: r[0].rel - r[1].rel,
    spread: spreadOf(r),
    admitted: r[0].rel >= T_PLUS[b.tb.basis],
    label: LABEL[b.url] || null,
    altBasis: alt[i] ? alt[i].basis : null,
    altText: alt[i] ? alt[i].text : null,
    altRel: alt[i] ? rank(altVecs[i])[0].rel : null,
    altIdx: alt[i] ? rank(altVecs[i])[0].k : null,
    altSpread: alt[i] ? spreadOf(rank(altVecs[i])) : null,
  };
});

const admitted = rows.filter((r) => r.admitted).sort((a, b) => b.spread - a.spread);

log('=== does SPREAD separate a good explanation from a bad one? ===');
log('   the admitted-by-interest set, sorted by spread (1st minus 5th).\n');
log('  spread   gap2   REL+   rung    verdict     named / story');
for (const r of admitted) {
  log(`  ${r.spread.toFixed(3)}  ${r.gap2.toFixed(3)}  ${r.rel.toFixed(3)}  ${r.basis.padEnd(6)}  ${(r.label || '?').padEnd(10)}  #${r.idx + 1} ${positive[r.idx].slice(0, 38)}`);
  log(`  ${''.padEnd(38)}  ${r.text.slice(0, 78)}`);
}

log('\n  gap-to-2nd, same set, sorted — for comparison:');
for (const r of [...admitted].sort((a, b) => b.gap2 - a.gap2)) {
  log(`  ${r.gap2.toFixed(3)}  ${(r.label || '?').padEnd(10)}  ${r.text.slice(0, 60)}`);
}

// Where does a spread floor cut, and what does it cost?
log('\n\n=== a spread floor: what it keeps and what it costs ===');
log('   n=8. This is FITTED, not validated — there is no holdout and no labelled');
log('   corpus, which is why the prototype refuses a tuning loop. Read the');
log('   DIRECTION, not the number.\n');
for (const floor of [0.05, 0.06, 0.075, 0.09]) {
  const kept = admitted.filter((r) => r.spread >= floor);
  const good = kept.filter((r) => r.label === 'RIGHT').length;
  const bad = kept.filter((r) => r.label === 'uncovered' || r.label === 'near').length;
  log(`  floor ${floor.toFixed(3)}: keeps ${kept.length}/8  (RIGHT ${good}/3, wrong-or-near ${bad}/5)`);
}

// Does spread split `near` from `uncovered`? (The Q3 question.)
const near = admitted.filter((r) => r.label === 'near').map((r) => r.spread);
const unc = admitted.filter((r) => r.label === 'uncovered').map((r) => r.spread);
log(`\n  near-miss spreads:  ${near.map((s) => s.toFixed(3)).join(' ')}`);
log(`  uncovered spreads:  ${unc.map((s) => s.toFixed(3)).join(' ')}`);
log('  -> if these interleave, spread does NOT split the two faults either.');

// ------------------------------------------------------------ rung precedence
log('\n\n=== rung precedence, three ways to choose ===');
log('   §4 picks `own` unconditionally. Compare against picking the higher REL+,');
log('   and against picking the higher SPREAD.\n');
for (const r of rows.filter((x) => x.altBasis)) {
  log(`${r.url}  (S=${r.strength})  [${r.label || '—'}]`);
  log(`  own     REL+ ${r.rel.toFixed(3)}  spread ${r.spread.toFixed(3)}  -> #${r.idx + 1} ${positive[r.idx].slice(0, 46)}`);
  log(`  citing  REL+ ${r.altRel.toFixed(3)}  spread ${r.altSpread.toFixed(3)}  -> #${r.altIdx + 1} ${positive[r.altIdx].slice(0, 46)}`);
  log(`          citing text: ${(r.altText || '—').slice(0, 92)}`);
  log(`  higher REL+ picks: ${r.altRel > r.rel ? 'citing' : 'own'}    higher spread picks: ${r.altSpread > r.spread ? 'citing' : 'own'}`);
  log('');
}

writeFileSync(join(import.meta.dirname, 'argmax-spread.txt'), out.join('\n') + '\n');
writeFileSync(join(import.meta.dirname, 'argmax-spread.json'), JSON.stringify({ interests: positive, rows }, null, 2));
log('wrote argmax-spread.txt + argmax-spread.json');
