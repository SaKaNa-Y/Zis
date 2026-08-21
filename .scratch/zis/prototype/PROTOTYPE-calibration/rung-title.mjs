// PROTOTYPE — throwaway. Zis #42, third measurement.
//
// rung-length.mjs found that in the cases where `citing` beats `own`, the citing
// anchor frequently QUOTES the Item's own title (15/44), while `own` embeds that
// same title plus up to 1200 chars of extracted body (median own length: 1200).
// That makes the flagship failures look like a composition problem rather than a
// precedence problem. This measures the third text §4 never considered:
//
//   own-title  — the Item's title, alone, no body.
//
// If title-alone beats both the full `own` text and the `citing` anchor, then the
// rung ladder is not the defect and #42 is asking the wrong question.
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, cos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink, textBasisOf } from './text-basis.mjs';
import { VEHICLE_TRANSPORTS } from '../PROTOTYPE-clustering/cluster.mjs';
import { writeFileSync } from 'node:fs';

const out = []; const log = (s) => { console.log(s); out.push(s); };
const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: Date.parse(lastAt) });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});
const rank = (v) => posVecs.map((pv, k) => ({ k, rel: cos(v, pv) })).sort((a, b) => b.rel - a.rel);
const sum = (v) => { const r = rank(v); return { rel: r[0].rel, idx: r[0].k, gap2: r[0].rel - r[1].rel }; };
const isVehicle = (it) => VEHICLE_TRANSPORTS.has(it.transport) && (it.outbound || []).length > 0;

const set = [];
for (const s of signals) {
  const tb = textBasisOf(s, items, Infinity);
  if (tb.basis !== 'own') continue;
  const alt = textBasisOf({ ...s, citations: s.citations.filter((c) => c.kind !== 'self') }, items, Infinity);
  if (alt.basis !== 'citing') continue;
  const own = s.citations.filter((c) => c.kind === 'self').map((c) => items[c.itemIdx])
    .filter((it) => it && !isVehicle(it) && it.title)
    .sort((a, b) => (b.text || '').length - (a.text || '').length)[0];
  set.push({ url: primaryLink(s), strength: s.strength, tb, alt, title: String(own.title).replace(/\s+/g, ' ').trim() });
}
const [fullV, titleV, altV] = [
  await embedAll(set.map((x) => x.tb.text || 'untitled'), {}),
  await embedAll(set.map((x) => x.title || 'untitled'), {}),
  await embedAll(set.map((x) => x.alt.text || 'untitled'), {}),
];
const rows = set.map((x, i) => ({ ...x, full: sum(fullV[i]), title_: sum(titleV[i]), altS: sum(altV[i]) }));
const n = rows.length;
const p = (x) => `${((x / n) * 100).toFixed(1)}%`;

log(`n=${n} contested \`own\` Signals\n`);
log('=== title-alone vs own-full vs citing ===');
log(`  title beats own-full on REL+:      ${rows.filter((r) => r.title_.rel > r.full.rel).length}/${n} (${p(rows.filter((r) => r.title_.rel > r.full.rel).length)})`);
log(`  title beats citing  on REL+:       ${rows.filter((r) => r.title_.rel > r.altS.rel).length}/${n} (${p(rows.filter((r) => r.title_.rel > r.altS.rel).length)})`);
log(`  title is the argmax winner of all 3: ${rows.filter((r) => r.title_.rel >= r.full.rel && r.title_.rel >= r.altS.rel).length}/${n}`);
log(`  title and own-full name the SAME Interest: ${rows.filter((r) => r.title_.idx === r.full.idx).length}/${n}`);
log(`  title and citing   name the SAME Interest: ${rows.filter((r) => r.title_.idx === r.altS.idx).length}/${n}`);
log(`\n  median gap-to-2nd:  own-full ${med(rows.map(r=>r.full.gap2))}  title ${med(rows.map(r=>r.title_.gap2))}  citing ${med(rows.map(r=>r.altS.gap2))}`);
function med(a){const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)].toFixed(3);}

log('\n=== the cases #35 and #42 are built on ===');
for (const r of rows.filter((x) => /kitesurf|agentic-internet|ten-advances|ai-aesthetic|bun-in-rust|agent-intrusion|16years/.test(x.url))) {
  log(`\n  ${r.url} (S=${r.strength})`);
  log(`    own-full  ${r.full.rel.toFixed(3)} gap ${r.full.gap2.toFixed(3)} -> #${r.full.idx + 1} ${positive[r.full.idx].slice(0, 42)}`);
  log(`    title     ${r.title_.rel.toFixed(3)} gap ${r.title_.gap2.toFixed(3)} -> #${r.title_.idx + 1} ${positive[r.title_.idx].slice(0, 42)}`);
  log(`    citing    ${r.altS.rel.toFixed(3)} gap ${r.altS.gap2.toFixed(3)} -> #${r.altS.idx + 1} ${positive[r.altS.idx].slice(0, 42)}`);
  log(`    title text:  ${r.title.slice(0, 92)}`);
  log(`    citing text: ${(r.alt.text || '').slice(0, 92)}`);
}
writeFileSync('rung-title.txt', out.join('\n') + '\n');
writeFileSync('rung-title.json', JSON.stringify({ interests: positive, rows }, null, 2));
