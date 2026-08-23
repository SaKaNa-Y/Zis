// PROTOTYPE — throwaway. Zis #49, follow-up to rung-compose.mjs.
// Reads that script's JSON — no embedding, no network.
//
// rung-compose.mjs found the dilution curve is FLAT past ~300 chars (median REL+
// 0.659-0.663 from 300 to uncapped) while title-alone sits highest at 0.681 —
// which is #21's and ADR-0013's select-for-pollution shape a third time, not a
// quality gain. But re-running rung-title.mjs against the real profile turned up
// something the aggregate hides: `own`-full named "#7 Notable open-source AI
// projects" on FOUR unrelated stories (a Cloudflare browser, a Go birthday post,
// an OpenAI maths result, a design essay).
//
// If long text collapses the argmax onto a handful of generic statements, the
// defect is not length-as-dilution — it is ADR-0012's FLATNESS arriving through
// composition. That is a different fault with a different owner, so it is worth
// measuring rather than asserting.
import { readFileSync } from 'node:fs';

const { interests, caps, rows, floor } = JSON.parse(readFileSync('rung-compose.json', 'utf8'));
const out = [];
const log = (s) => { console.log(s); out.push(s); };
const n = rows.length;
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '—');

// How concentrated is the argmax at each cap? A composition that names 20
// statements evenly is using the profile; one that names 3 is not.
log(`=== argmax concentration over ${n} \`own\` Signals, ${interests.length} Interests ===\n`);
log('  cap        distinct Interests named   top statement    top-3 share   entropy/max');
for (const cap of caps) {
  const counts = new Map();
  for (const r of rows) {
    const k = r.perCap[cap].idx;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b[1], 0);
  // Normalised Shannon entropy: 1.0 means the profile is used evenly, 0 means
  // one statement answers for everything.
  const h = -[...counts.values()].reduce((a, c) => a + (c / n) * Math.log(c / n), 0) / Math.log(interests.length);
  log(`  ${String(cap).padEnd(10)} ${String(counts.size).padStart(2)}/${interests.length}                      #${sorted[0][0] + 1} x${String(sorted[0][1]).padStart(3)}       ${((top3 / n) * 100).toFixed(1)}%        ${f3(h)}`);
}

log('\n=== which statement absorbs the corpus, at title vs at the shipped 1200 ===\n');
for (const cap of ['title', '1200']) {
  const counts = new Map();
  for (const r of rows) counts.set(r.perCap[cap].idx, (counts.get(r.perCap[cap].idx) || 0) + 1);
  log(`  cap ${cap}:`);
  for (const [k, c] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    log(`    ${String(c).padStart(3)} (${((c / n) * 100).toFixed(1)}%)  #${k + 1} ${interests[k].slice(0, 62)}`);
  }
  log('');
}

// Is the flatness worse where the body is long? This is the mechanism test: if a
// long body pushes REL+ toward the floor AND collapses the argmax, then the
// composition is destroying the profile's ability to discriminate at all.
log('=== does a long body flatten the ranking? (per-Signal, at the shipped 1200) ===\n');
const buckets = [[0, 1], [1, 200], [200, 600], [600, 1200], [1200, Infinity]];
log('  body length     n     median REL+   median gap2   REL+ within 0.01 of floor');
for (const [lo, hi] of buckets) {
  const b = rows.filter((r) => r.bodyLen >= lo && r.bodyLen < hi);
  if (!b.length) continue;
  const rels = b.map((r) => r.perCap['1200'].rel).sort((x, y) => x - y);
  const gaps = b.map((r) => r.perCap['1200'].gap2).sort((x, y) => x - y);
  const nearFloor = b.filter((r) => Math.abs(r.perCap['1200'].rel - floor) < 0.01).length;
  const label = hi === Infinity ? `${lo}+` : lo === 0 && hi === 1 ? 'none' : `${lo}-${hi}`;
  log(`  ${label.padEnd(15)} ${String(b.length).padStart(3)}   ${f3(rels[Math.floor(rels.length / 2)])}         ${f3(gaps[Math.floor(gaps.length / 2)])}         ${String(nearFloor).padStart(3)} (${((nearFloor / b.length) * 100).toFixed(1)}%)`);
}
log(`\n  floor = ${f3(floor)}, the profile's own median pairwise cosine (#21's line under every bar).`);
log('  "within 0.01 of floor" is the share of Signals whose best match is');
log('  indistinguishable from "this is writing about software".');

// The four-attractor case, named.
log('\n=== the cases where own-full names one generic statement ===\n');
const counts = new Map();
for (const r of rows) counts.set(r.perCap['1200'].idx, (counts.get(r.perCap['1200'].idx) || 0) + 1);
const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
log(`  #${top + 1} ${interests[top]}\n`);
log('  a sample of what it absorbed at 1200, with what the title alone would name:');
for (const r of rows.filter((x) => x.perCap['1200'].idx === top).slice(0, 12)) {
  const t = r.perCap.title;
  log(`\n    ${r.url.slice(0, 76)}`);
  log(`      1200  ${f3(r.perCap['1200'].rel)} gap ${f3(r.perCap['1200'].gap2)}  -> #${top + 1}`);
  log(`      title ${f3(t.rel)} gap ${f3(t.gap2)}  -> #${t.idx + 1} ${interests[t.idx].slice(0, 50)}`);
}

import { writeFileSync } from 'node:fs';
writeFileSync('rung-flatness.txt', out.join('\n') + '\n');
