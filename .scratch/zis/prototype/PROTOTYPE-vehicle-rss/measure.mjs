// PROTOTYPE — throwaway. Zis issue #39: should `vehicle-post->sole-target`
// extend to RSS link-blog feeds, and does the `targets.length !== 1` guard
// survive contact with RSS?
//
// Rides #6's corpus and its on-disk cache — no new network traffic beyond what
// PROTOTYPE-clustering already fetched. `node measure.mjs`.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus, VEHICLE_TRANSPORTS } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from '../PROTOTYPE-clustering/ingest.mjs';
import { PUBLISHER_BY_ID } from '../PROTOTYPE-clustering/sources.mjs';
import { EXPECTED_CLUSTERS, NEGATIVE_CONTROL_PUBLISHERS } from '../PROTOTYPE-clustering/cases.mjs';

const out = [];
const log = (s) => {
  console.log(s);
  out.push(s);
};

const items = await ingestAll({ log: () => {} });
log(`corpus: ${items.length} items`);

// ------------------------------------------------- part 0: what RSS looks like
// Before measuring a rule, measure the population it would act on.

const rss = items.filter((i) => i.transport === 'rss');
const byPub = new Map();
for (const it of rss) {
  const e = byPub.get(it.publisherId) || { n: 0, chars: [], out0: 0, out1: 0, out2plus: 0 };
  e.n++;
  e.chars.push(it.bodyChars ?? 0);
  const n = new Set(it.outbound || []).size;
  if (n === 0) e.out0++;
  else if (n === 1) e.out1++;
  else e.out2plus++;
  byPub.set(it.publisherId, e);
}
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
log('\n=== RSS population (before any rule) ===');
log('  publisher        items  medianBodyChars  raw-outbound: 0 / 1 / 2+');
for (const [p, e] of [...byPub.entries()].sort((a, b) => b[1].n - a[1].n)) {
  log(`  ${p.padEnd(17)}${String(e.n).padStart(4)}  ${String(median(e.chars)).padStart(14)}   ${e.out0} / ${e.out1} / ${e.out2plus}`);
}

// ---------------------------------------------------------- part 1: the grid

const RSS_SET = new Set([...VEHICLE_TRANSPORTS, 'rss']);
const VARIANTS = [
  ['A  baseline (#6 as shipped)', {}],
  ['B  guard=signals, hn+bsky only', { vehicleGuard: 'signals' }],
  ['C  +rss, guard=links', { vehicleTransports: RSS_SET }],
  ['D  +rss, guard=signals', { vehicleTransports: RSS_SET, vehicleGuard: 'signals' }],
  ['E  +rss, guard=signals, body<=400', { vehicleTransports: RSS_SET, vehicleGuard: 'signals', vehicleMaxBodyChars: 400 }],
  ['F  +rss, guard=signals, body<=1000', { vehicleTransports: RSS_SET, vehicleGuard: 'signals', vehicleMaxBodyChars: 1000 }],
  ['G  +rss, guard=links, body<=400', { vehicleTransports: RSS_SET, vehicleMaxBodyChars: 400 }],
  // The leak the RSS run exposed: the guard reads RAW outbound, so a citation
  // dropped as intra-publisher navigation or reference-only still counts as the
  // sole target whenever some other Publisher created that Link.
  ['H  hn+bsky, from-citations', { vehicleFromCitations: true }],
  ['I  +rss, from-citations', { vehicleTransports: RSS_SET, vehicleFromCitations: true }],
  ['J  +rss, from-citations, body<=400', { vehicleTransports: RSS_SET, vehicleFromCitations: true, vehicleMaxBodyChars: 400 }],
  ['K  +rss, from-cit, sig, body<=1000', { vehicleTransports: RSS_SET, vehicleFromCitations: true, vehicleGuard: 'signals', vehicleMaxBodyChars: 1000 }],
];

const results = [];
for (const [name, opts] of VARIANTS) {
  const c = await buildCorpus(items, { log: () => {}, ...opts });
  const rssFolds = c.vehicleMergeDetail.filter((d) => d.transport === 'rss');
  results.push({
    name,
    opts,
    signals: c.signals.length,
    s2: c.signals.filter((s) => s.strength >= 2).length,
    s3: c.signals.filter((s) => s.strength >= 3).length,
    max: Math.max(0, ...c.signals.map((s) => s.strength)),
    vehicleMerges: c.notes.vehicleMerges,
    rssFolds: rssFolds.length,
    detail: c.vehicleMergeDetail,
    corpus: c,
  });
}

log('\n=== variant grid ===');
log('  variant                          signals  s>=2  s>=3  max  vehicleMerges  ofWhichRSS');
for (const r of results) {
  log(
    `  ${r.name.padEnd(32)}${String(r.signals).padStart(7)}${String(r.s2).padStart(6)}${String(r.s3).padStart(6)}${String(r.max).padStart(5)}${String(r.vehicleMerges).padStart(15)}${String(r.rssFolds).padStart(12)}`
  );
}

// ------------------------------ part 2: the guard, on the shape #39 names
// How often does an RSS item cite exactly 2 Links that are ALREADY one Signal?
// That is the article + its HN thread case, and it is what separates C from D.

const D = results.find((r) => r.name.startsWith('D'));
const C = results.find((r) => r.name.startsWith('C'));
const cKeys = new Set(C.detail.filter((d) => d.transport === 'rss').map((d) => d.self));
const onlyD = D.detail.filter((d) => d.transport === 'rss' && !cKeys.has(d.self));
log(`\n=== folds the signals-guard unlocks that the links-guard refuses: ${onlyD.length} ===`);
for (const d of onlyD) {
  log(`  ${d.publisherId} | body=${d.bodyChars} | "${(d.title || '').slice(0, 70)}"`);
  log(`     self   ${d.self}`);
  for (const t of d.targets) log(`     target ${t}`);
}

// --------------------------------- part 3: every RSS fold, for classification

log('\n=== every RSS fold under D (+rss, guard=signals) ===');
const dRss = D.detail.filter((d) => d.transport === 'rss');
for (const d of dRss.sort((a, b) => a.publisherId.localeCompare(b.publisherId) || (a.bodyChars ?? 0) - (b.bodyChars ?? 0))) {
  log(`  [${d.publisherId}] body=${String(d.bodyChars).padStart(6)} nTargets=${d.targets.length} "${(d.title || '').slice(0, 64)}"`);
  log(`     ${d.self}`);
  log(`  -> ${d.into}`);
}

// ------------------------- part 4: does it change what a reader would see?
// The supply ledger: which Signals cross the Strength floors, and do the C1..C10
// acceptance clusters or the negative controls move?

function admitted(c) {
  return c.signals
    .filter((s) => s.strength >= 2)
    .map((s) => ({ url: s.links[0], strength: s.strength, voters: [...s.voters].sort().join(','), links: s.links.length }));
}
const A = results.find((r) => r.name.startsWith('A'));
const baseSet = new Map(admitted(A.corpus).map((s) => [s.url, s]));
for (const r of results.slice(1)) {
  const now = new Map(admitted(r.corpus).map((s) => [s.url, s]));
  const gained = [...now.keys()].filter((u) => !baseSet.has(u));
  const lost = [...baseSet.keys()].filter((u) => !now.has(u));
  const stronger = [...now.entries()].filter(([u, s]) => baseSet.has(u) && s.strength > baseSet.get(u).strength);
  log(`\n=== ${r.name}: s>=2 set vs baseline ===`);
  log(`  gained ${gained.length}, lost ${lost.length}, strengthened ${stronger.length}`);
  for (const u of gained) log(`  + s=${now.get(u).strength} ${u}  [${now.get(u).voters}]`);
  for (const u of lost) log(`  - s=${baseSet.get(u).strength} ${u}  [${baseSet.get(u).voters}]`);
  for (const [u, s] of stronger) log(`  ^ ${baseSet.get(u).strength}->${s.strength} ${u}  [${s.voters}]`);
}

log('\n=== acceptance clusters + negative controls, per variant ===');
for (const r of results) {
  const c = r.corpus;
  const verdicts = EXPECTED_CLUSTERS.map((ec) => {
    const best = c.signals.filter((s) => s.links.some(ec.match)).sort((a, b) => b.strength - a.strength)[0];
    return `${ec.id}:${best ? best.strengthWithOrigin : '-'}`;
  });
  let ctrl = 0;
  const ctrlDetail = [];
  for (const pid of NEGATIVE_CONTROL_PUBLISHERS) {
    const own = PUBLISHER_BY_ID.get(pid)?.hosts || [];
    for (const s of c.signals) {
      if (s.strength >= 2 && s.links.some((u) => own.some((h) => u.includes(h)))) {
        ctrl++;
        ctrlDetail.push(`${pid} s=${s.strength} ${s.links[0]}`);
      }
    }
  }
  log(`  ${r.name.padEnd(32)} ${verdicts.join(' ')}  | control FPs: ${ctrl}`);
  for (const d of ctrlDetail) log(`        ${d}`);
}

// ------------------- part 5: the #6 true miss this ticket exists to recover
// #6's second-pass proxy found three true misses at Jaccard 1.00. The third is
// the HN thread `item?id=49220609` sitting apart from Willison's link-blog entry
// on the same story. Does folding actually join them, and does it recover a vote?

const PROBE = 'news.ycombinator.com/item?id=49220609';
log('\n=== the #6 true miss: does folding recover it, and is a vote recovered? ===');
for (const r of results) {
  const c = r.corpus;
  const s = c.signals.find((x) => x.links.some((u) => u.includes(PROBE)));
  const willison = c.signals.find((x) => x.links.some((u) => u.includes('/2026/Aug/8/now-we-have-a-timeline')));
  const joined = s && willison && s.id === willison.id;
  log(`  ${r.name.padEnd(32)} joined=${joined ? 'YES' : 'no '}  strength=${s ? s.strength : '-'}  members=${s ? s.links.length : '-'}`);
  if (joined) log(`      voters: ${s.voters.join(', ')}`);
}

// ------------------------- part 6: how much of the RSS fold set is the leak
// A fold is "leak-driven" when its sole target is a Link this Item's own
// Citation was DROPPED for (intra-publisher navigation, reference-only).

log('\n=== leak audit: RSS folds under D whose sole target is not a surviving Citation of that Item ===');
const I = results.find((r) => r.name.startsWith('I'));
const iSelf = new Set(I.detail.filter((d) => d.transport === 'rss').map((d) => d.self));
const leakOnly = dRss.filter((d) => !iSelf.has(d.self));
log(`  D RSS folds ${dRss.length}, I RSS folds ${I.detail.filter((d) => d.transport === 'rss').length}, leak-driven ${leakOnly.length}`);
for (const d of leakOnly) log(`  [${d.publisherId}] "${(d.title || '').slice(0, 56)}"  ->  ${d.into}`);
const bLeak = A.detail.filter((d) => d.transport !== 'rss');
const hSelf = new Set(results.find((r) => r.name.startsWith('H')).detail.map((d) => d.self));
log(`  and on hn+bluesky, where the rule shipped: ${bLeak.filter((d) => !hSelf.has(d.self)).length} of ${bLeak.length} folds are leak-driven`);

// ------------- part 7: the supply ledger, compared without a labelling artifact
// `links[0]` is unstable across variants (a merge changes which member is
// listed first), so a gained/lost diff keyed on it is noise. The admission
// question is: does the MULTISET of admitted voter-sets change?

const key = (s) => `${s.strength}|${[...s.voters].sort().join(',')}`;
const bag = (c) => {
  const m = new Map();
  for (const s of c.signals.filter((x) => x.strength >= 2)) m.set(key(s), (m.get(key(s)) || 0) + 1);
  return m;
};
const baseBag = bag(A.corpus);
log('\n=== supply ledger: admitted voter-sets vs baseline (labelling-artifact-free) ===');
for (const r of results.slice(1)) {
  const b = bag(r.corpus);
  const add = [];
  const rm = [];
  for (const [k, n] of b) if (n > (baseBag.get(k) || 0)) add.push(`${k} x${n - (baseBag.get(k) || 0)}`);
  for (const [k, n] of baseBag) if (n > (b.get(k) || 0)) rm.push(`${k} x${n - (b.get(k) || 0)}`);
  log(`  ${r.name}`);
  log(`     + ${add.join('  ') || '(none)'}`);
  log(`     - ${rm.join('  ') || '(none)'}`);
}

// -------------- part 8: inspect the three Signals the ledger says moved
// Each of them is an admission change, so each one has to be classified true or
// false by reading its Citations.

function dump(variant, needle) {
  const c = results.find((r) => r.name.startsWith(variant)).corpus;
  const s = c.signals.find((x) => x.links.some((u) => u.includes(needle)));
  log(`  ${variant} :: ${needle}`);
  if (!s) return log('     (absent)');
  log(`     strength=${s.strength} voters=${s.voters.join(',')} origin=${s.origin || '-'}`);
  for (const u of s.links) log(`     member ${u}`);
  for (const cit of s.citations) log(`     cite   ${cit.publisherId.padEnd(16)} ${cit.kind.padEnd(8)} ${cit.linkUrl}`);
}
log('\n=== the Signals the ledger says moved ===');
for (const needle of ['3mr5ucqec2s24', 'watch?v=87DyyMV0kCY', 'the-agentic-internet']) {
  for (const v of ['A', 'H', 'I']) dump(v, needle);
  log('');
}

// --------- part 9: the ticket's stated crux — does "article + its HN thread" exist?
// #39 predicts the guard will not fire on the very case #6 found, because a
// link-blog post cites the article AND the HN thread about it. Measured over the
// corpus rather than assumed.

log('\n=== does a link-blog post cite "the article + its HN thread"? ===');
const cI = I.corpus;
const outboundByItem = new Map();
for (const c of cI.citations) {
  if (c.kind !== 'outbound') continue;
  if (!outboundByItem.has(c.itemIdx)) outboundByItem.set(c.itemIdx, []);
  outboundByItem.get(c.itemIdx).push(c.linkUrl);
}
let withHn = 0;
let twoTargets = 0;
let twoCollapse = 0;
const dist = new Map();
for (let i = 0; i < items.length; i++) {
  if (items[i].transport !== 'rss') continue;
  const t = [...new Set(outboundByItem.get(i) || [])];
  dist.set(t.length, (dist.get(t.length) || 0) + 1);
  const hasHn = t.some((u) => u.includes('news.ycombinator.com/item'));
  if (hasHn) withHn++;
  if (t.length === 2) {
    twoTargets++;
    if (new Set(t.map((u) => cI.sig.find(u))).size === 1) twoCollapse++;
  }
}
log(`  RSS items citing an HN thread at all: ${withHn} of ${rss.length}`);
log(`  RSS items with exactly 2 surviving targets: ${twoTargets}, of which already one Signal: ${twoCollapse}`);
log(`  surviving-target count distribution: ${[...dist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`);

writeFileSync(join(import.meta.dirname, 'findings.txt'), out.join('\n'));
writeFileSync(
  join(import.meta.dirname, 'findings.json'),
  JSON.stringify(
    results.map((r) => ({ name: r.name, opts: { ...r.opts, vehicleTransports: r.opts.vehicleTransports ? [...r.opts.vehicleTransports] : undefined }, signals: r.signals, s2: r.s2, s3: r.s3, max: r.max, vehicleMerges: r.vehicleMerges, rssFolds: r.rssFolds, detail: r.detail })),
    null,
    2
  )
);
console.log('\nwrote findings.txt + findings.json');
