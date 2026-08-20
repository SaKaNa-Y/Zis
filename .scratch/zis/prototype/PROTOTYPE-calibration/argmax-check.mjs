// PROTOTYPE — throwaway. Zis issue #21, follow-up check.
//
// The main run turned up something bigger than a threshold: the argmax Interest
// — which ADR-0003 makes the why-text, i.e. the entire explanation — is often
// not the Interest a reader would name, and the error does not fall as REL+
// rises. Before that claim goes anywhere near a resolution comment it has to
// survive the obvious objection: it might be MY `citing` text polluting the
// vector, since the main run concatenates anchor text AND newsletter issue
// titles.
//
// So: rebuild the eligible set's citing text four ways and re-measure the
// argmax each time. If argmax churns between variants, the rung's definition is
// the problem. If it lands in the same wrong place every time, the model is.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus, VEHICLE_TRANSPORTS } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, maxCos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink } from './text-basis.mjs';

const out = [];
const log = (s) => { console.log(s); out.push(s); };
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

const eligible = signals.filter((s) => s.strength >= 2);
log(`eligible (Strength >= 2): ${eligible.length}`);

/** The four candidate definitions of the citing rung. */
function variants(s) {
  const anchors = [];
  const titles = [];
  const seenA = new Set(), seenT = new Set();
  for (const c of s.citations) {
    if (c.kind !== 'outbound') continue;
    const it = items[c.itemIdx];
    if (!it) continue;
    const a = clean(it.anchors?.[c.rawUrl]);
    if (a && !seenA.has(a.toLowerCase())) { seenA.add(a.toLowerCase()); anchors.push(a); }
    const t = clean(it.title);
    if (t && !seenT.has(t.toLowerCase())) { seenT.add(t.toLowerCase()); titles.push(t); }
  }
  const own = s.citations
    .filter((c) => c.kind === 'self')
    .map((c) => items[c.itemIdx])
    .filter((it) => it && clean(it.title) && !(VEHICLE_TRANSPORTS.has(it.transport) && (it.outbound || []).length))
    .sort((a, b) => (b.text || '').length - (a.text || '').length)[0];

  return {
    // §4 as written.
    titlesOnly: titles.slice(0, 8).join('. '),
    // What the citing Publisher called THIS link, and nothing else.
    anchorsOnly: anchors.slice(0, 8).join('. '),
    // Anchor text of the single most specific citation only — no concatenation
    // at all, on the theory that averaging eight descriptions of one story is
    // itself the noise.
    bestAnchor: anchors.sort((a, b) => b.length - a.length)[0] || '',
    // Both, as the main run does it.
    merged: [...anchors, ...titles].slice(0, 8).join('. '),
    own: own ? clean(`${own.title}. ${own.text || ''}`).slice(0, 1200) : '',
  };
}

const V = ['titlesOnly', 'anchorsOnly', 'bestAnchor', 'merged', 'own'];
const built = eligible.map((s) => ({ s, url: primaryLink(s), v: variants(s) }));
const vecs = {};
for (const k of V) vecs[k] = await embedAll(built.map((b) => b.v[k] || 'untitled'), {});

log('\nurl | variant | REL+ | argmax Interest');
const rows = [];
for (let i = 0; i < built.length; i++) {
  const b = built[i];
  log(`\n${b.url}   (S=${b.s.strength})`);
  const r = { url: b.url, strength: b.s.strength };
  for (const k of V) {
    if (!b.v[k]) { log(`  ${k.padEnd(12)} —`); continue; }
    const m = maxCos(vecs[k][i], posVecs);
    r[k] = { rel: m.rel, idx: m.idx };
    log(`  ${k.padEnd(12)} ${m.rel.toFixed(3)}  #${m.idx + 1} ${positive[m.idx].slice(0, 64)}`);
    log(`  ${''.padEnd(12)} text: ${b.v[k].slice(0, 110)}`);
  }
  rows.push(r);
}

// Does the argmax churn between definitions, or is it stably wrong?
const pairs = [['titlesOnly', 'anchorsOnly'], ['anchorsOnly', 'bestAnchor'], ['titlesOnly', 'merged'], ['anchorsOnly', 'merged']];
log('\nargmax agreement between citing-rung definitions, over the eligible set:');
for (const [a, b] of pairs) {
  const both = rows.filter((r) => r[a] && r[b]);
  const same = both.filter((r) => r[a].idx === r[b].idx).length;
  log(`  ${a} vs ${b}: ${same}/${both.length} agree (${((100 * same) / Math.max(1, both.length)).toFixed(0)}%)`);
}

writeFileSync(join(import.meta.dirname, 'argmax-check.txt'), out.join('\n') + '\n');
writeFileSync(join(import.meta.dirname, 'argmax-check.json'), JSON.stringify({ interests: positive, rows }, null, 2));
log('\nwrote argmax-check.txt + argmax-check.json');
