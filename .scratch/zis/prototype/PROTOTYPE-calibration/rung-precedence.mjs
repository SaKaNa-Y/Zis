// PROTOTYPE — throwaway. Zis issue #42.
//
// argmax-spread.mjs measured the `own`-vs-`citing` rung precedence on FOUR
// Signals — the Strength>=2 eligible set — and found it wrong twice. Four points
// with a tiebreak decided by 0.001 is not evidence. This script is that same
// measurement with the eligibility filter DROPPED: the whole `own` rung.
//
// What it can and cannot answer, stated up front because the ticket turns on it.
// There are 8 hand labels in the corpus and no labelled set, so at 849 Signals
// CORRECTNESS is not measurable. What IS measurable is everything the "coin flip
// or real split" question actually needs:
//
//   1. How big the contested set even is. A rung fix only touches `own` Signals
//      that HAVE a citing alternative. If that population is tiny the whole
//      question is priced differently.
//   2. How often the two rungs disagree about the argmax Interest — i.e. how many
//      why-texts a rule change would rewrite.
//   3. Which rung each candidate rule picks, over the whole population, and
//      whether the three rules agree with each other. Three rules that pick the
//      same rung 95% of the time are one rule.
//   4. The cross-bar problem, quantified: does "pick the higher REL+" select for
//      `citing` because `citing`'s bar is 0.03 lower? Measured as the ADMISSION
//      delta, which is the thing the bar difference actually distorts.

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
const T_GAP = 0.04; // ADR-0012's placeholder, used only to price admission deltas.

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

const rank = (vec) => posVecs.map((pv, k) => ({ k, rel: cos(vec, pv) })).sort((a, b) => b.rel - a.rel);
const summarize = (vec) => {
  const r = rank(vec);
  return { rel: r[0].rel, idx: r[0].k, gap2: r[0].rel - r[1].rel, spread: r[0].rel - r[4].rel };
};

// ---------------------------------------------------------------- population
const basis = signals.map((s) => textBasisOf(s, items, Infinity));
const rungCount = basis.reduce((a, b) => ((a[b.basis] = (a[b.basis] || 0) + 1), a), {});

log('=== the population ===');
log(`  ${signals.length} Signals in the corpus`);
for (const k of ['own', 'citing', 'slug']) {
  log(`  ${k.padEnd(7)} ${String(rungCount[k] || 0).padStart(5)}  (${(((rungCount[k] || 0) / signals.length) * 100).toFixed(1)}%)`);
}

// The contested set: §4 puts these on `own`, AND a `citing` text exists for them.
// Dropping the self Citations is exactly what argmax-spread.mjs did, so the
// comparison is the same one, only unfiltered.
const contested = [];
for (let i = 0; i < signals.length; i++) {
  if (basis[i].basis !== 'own') continue;
  const s = signals[i];
  const altS = { ...s, citations: s.citations.filter((c) => c.kind !== 'self') };
  const alt = textBasisOf(altS, items, Infinity);
  if (alt.basis !== 'citing') continue; // falls to `slug` — no alternative, not contested
  contested.push({ s, url: primaryLink(s), own: basis[i], alt });
}

log(`\n  of the ${rungCount.own || 0} \`own\` Signals, ${contested.length} have a \`citing\` text available.`);
log(`  the rest have only a self Citation, so the precedence never fires on them.`);
log(`  contested share of the whole corpus: ${((contested.length / signals.length) * 100).toFixed(1)}%`);
if (!contested.length) { writeFileSync(join(import.meta.dirname, 'rung-precedence.txt'), out.join('\n') + '\n'); process.exit(0); }

// ---------------------------------------------------------------- measurement
const ownVecs = await embedAll(contested.map((c) => c.own.text || 'untitled'), {});
const altVecs = await embedAll(contested.map((c) => c.alt.text || 'untitled'), {});

const rows = contested.map((c, i) => {
  const o = summarize(ownVecs[i]);
  const a = summarize(altVecs[i]);
  return {
    url: c.url,
    strength: c.s.strength,
    ownText: c.own.text,
    altText: c.alt.text,
    anchorCount: c.alt.anchorCount,
    own: o,
    alt: a,
    sameArgmax: o.idx === a.idx,
    byRel: a.rel > o.rel ? 'citing' : 'own',
    byGap: a.gap2 > o.gap2 ? 'citing' : 'own',
    bySpread: a.spread > o.spread ? 'citing' : 'own',
    relMargin: Math.abs(a.rel - o.rel),
    gapMargin: Math.abs(a.gap2 - o.gap2),
    // admission under each rule, at that rule's chosen rung's own bar
    admitOwn: o.rel >= T_PLUS.own,
    admitAlt: a.rel >= T_PLUS.citing,
    admitOwnGated: o.rel >= T_PLUS.own && o.gap2 >= T_GAP,
    admitAltGated: a.rel >= T_PLUS.citing && a.gap2 >= T_GAP,
  };
});

const n = rows.length;
const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

log('\n\n=== 1. how often do the two rungs disagree about the why-text? ===');
const diff = rows.filter((r) => !r.sameArgmax);
log(`  different argmax Interest: ${diff.length}/${n}  (${pct(diff.length)})`);
log(`  -> that is the ceiling on how many why-texts ANY rung rule could rewrite.`);

log('\n=== 2. which rung does each candidate rule pick? ===');
for (const [name, key] of [['higher REL+', 'byRel'], ['higher GAP to 2nd', 'byGap'], ['higher SPREAD to 5th', 'bySpread']]) {
  const citing = rows.filter((r) => r[key] === 'citing').length;
  log(`  ${name.padEnd(22)} picks citing ${String(citing).padStart(4)}/${n}  (${pct(citing)})`);
}
log(`  §4 as written           picks own    ${n}/${n}  (100.0%)`);

log('\n  do the three rules agree with each other?');
for (const [a, b] of [['byRel', 'byGap'], ['byRel', 'bySpread'], ['byGap', 'bySpread']]) {
  const same = rows.filter((r) => r[a] === r[b]).length;
  log(`  ${a} vs ${b}: agree ${same}/${n} (${pct(same)})`);
}

log('\n=== 3. is the split a coin flip? margins on the deciding quantity ===');
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const [name, key] of [['REL+', 'relMargin'], ['GAP', 'gapMargin']]) {
  const m = rows.map((r) => r[key]);
  log(`  |Δ${name}| median ${q(m, 0.5).toFixed(3)}  p25 ${q(m, 0.25).toFixed(3)}  p75 ${q(m, 0.75).toFixed(3)}  max ${q(m, 0.999).toFixed(3)}`);
  const noise = m.filter((x) => x < 0.01).length;
  log(`     decided by less than 0.010: ${noise}/${n} (${pct(noise)})`);
}

log('\n=== 4. the cross-bar problem, priced ===');
log('   `own` is gated at 0.70 and `citing` at 0.67. If maximising REL+ selects');
log('   for the lower bar, it shows up as extra ADMISSIONS, not as a nicer score.\n');
const admOwnOnly = rows.filter((r) => r.admitOwn).length;
const admByRel = rows.filter((r) => (r.byRel === 'citing' ? r.admitAlt : r.admitOwn)).length;
const admByGap = rows.filter((r) => (r.byGap === 'citing' ? r.admitAlt : r.admitOwn)).length;
log(`  §4 (always own):        ${admOwnOnly}/${n} admitted by REL+ alone`);
log(`  pick higher REL+:       ${admByRel}/${n}   (Δ ${admByRel - admOwnOnly >= 0 ? '+' : ''}${admByRel - admOwnOnly})`);
log(`  pick higher GAP:        ${admByGap}/${n}   (Δ ${admByGap - admOwnOnly >= 0 ? '+' : ''}${admByGap - admOwnOnly})`);
const crossed = rows.filter((r) => r.byRel === 'citing' && !r.admitOwn && r.admitAlt);
log(`\n  admitted ONLY because the chosen rung's bar is lower: ${crossed.length}/${n} (${pct(crossed.length)})`);
const wouldFailOwnBar = crossed.filter((r) => r.alt.rel < T_PLUS.own).length;
log(`  of those, ${wouldFailOwnBar} score below 0.70 — i.e. they clear ONLY the 0.67 bar.`);

log(`\n  with ADR-0012's gap floor (T_gap=${T_GAP}) applied on top:`);
const gOwn = rows.filter((r) => r.admitOwnGated).length;
const gRel = rows.filter((r) => (r.byRel === 'citing' ? r.admitAltGated : r.admitOwnGated)).length;
const gGap = rows.filter((r) => (r.byGap === 'citing' ? r.admitAltGated : r.admitOwnGated)).length;
log(`  §4 (always own): ${gOwn}   higher REL+: ${gRel}   higher GAP: ${gGap}`);

log('\n=== 5. where a rule change would actually be visible ===');
log('   an argmax disagreement only reaches a reader if the Signal is admitted at all.\n');
const visible = diff.filter((r) => r.admitOwn || r.admitAlt);
log(`  argmax disagreements on an admitted Signal: ${visible.length}/${n} (${pct(visible.length)})`);
const visibleGated = diff.filter((r) => r.admitOwnGated || r.admitAltGated);
log(`  ... and surviving T_gap:                    ${visibleGated.length}/${n} (${pct(visibleGated.length)})`);

log('\n  the admitted disagreements, worst-margin last (for hand reading):');
for (const r of [...visible].sort((a, b) => b.relMargin - a.relMargin).slice(0, 25)) {
  log(`\n  ${r.url}  (S=${r.strength})`);
  log(`    own    REL+ ${r.own.rel.toFixed(3)} gap ${r.own.gap2.toFixed(3)} -> #${r.own.idx + 1} ${positive[r.own.idx].slice(0, 44)}`);
  log(`    citing REL+ ${r.alt.rel.toFixed(3)} gap ${r.alt.gap2.toFixed(3)} -> #${r.alt.idx + 1} ${positive[r.alt.idx].slice(0, 44)}`);
  log(`    own text:    ${(r.ownText || '').slice(0, 96)}`);
  log(`    citing text: ${(r.altText || '').slice(0, 96)}`);
  log(`    rules: REL+ ${r.byRel}, GAP ${r.byGap}, SPREAD ${r.bySpread}`);
}

log('\n=== 6. does anchor availability explain anything? ===');
log('   the `citing` text is an anchor where one exists and a citing Item title');
log('   otherwise. If the wins concentrate on anchors, the fixed rule ("prefer the');
log('   anchor") is a different and cheaper proposition than a measured tiebreak.\n');
for (const [label, sel] of [['with anchor text', (r) => r.anchorCount > 0], ['title fallback only', (r) => r.anchorCount === 0]]) {
  const g = rows.filter(sel);
  if (!g.length) { log(`  ${label.padEnd(20)} n=0`); continue; }
  const cr = g.filter((r) => r.byRel === 'citing').length;
  const cg = g.filter((r) => r.byGap === 'citing').length;
  const dd = g.filter((r) => !r.sameArgmax).length;
  log(`  ${label.padEnd(20)} n=${String(g.length).padStart(4)}  REL+ picks citing ${((cr / g.length) * 100).toFixed(1)}%  GAP picks citing ${((cg / g.length) * 100).toFixed(1)}%  argmax differs ${((dd / g.length) * 100).toFixed(1)}%`);
}

writeFileSync(join(import.meta.dirname, 'rung-precedence.txt'), out.join('\n') + '\n');
writeFileSync(join(import.meta.dirname, 'rung-precedence.json'), JSON.stringify({ interests: positive, rungCount, rows }, null, 2));
log('\nwrote rung-precedence.txt + rung-precedence.json');
