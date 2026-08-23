// PROTOTYPE — throwaway. Zis #49.
//
// ADR-0013 closed the rung-PRECEDENCE question (44 Signals, 0.9% of the corpus)
// and handed the real lever here: what the `own` rung EMBEDS, over all 849 `own`
// Signals. §4 says "title + extracted summary", capped at 1200 — a number sited
// against nothing.
//
// Everything in #49's body was measured on the DRAFT profile (rung-title.txt was
// written at 64484a7, before #46 replaced the profile at bc8fde2), so every
// argmax below is re-measured against the reader's real 20 statements.
//
// What is measurable and what is not, stated up front. There are 8 hand labels
// and no labelled corpus, so CORRECTNESS is not measurable at 849 — same
// constraint the three `rung-*` scripts declared. What IS measurable:
//
//   1. Is the cap even binding? §4's 1200 was measured at-cap on the 44. Over
//      the whole 849 the distribution decides whether this is a knob at all.
//   2. The dilution curve: REL+ as a function of how much body is admitted.
//      If dilution is a length effect there is a curve; if not, there is a step.
//      Swept as a fraction-of-corpus statistic, not an anecdote.
//   3. Argmax STABILITY under the sweep — how many why-texts each cap rewrites
//      relative to the shipped 1200. This is the count that prices a change,
//      because the argmax IS the why-text (§6, ADR-0003).
//   4. ADMISSION delta at the shipped 0.70 bar, per cap. The thing #49 asks
//      whether 0.70 survives.
//   5. Candidate 3 — title weighted against body (title embedded twice, and a
//      two-vector mean) — measured because it is the only candidate that
//      changes what a stored vector IS and so touches `embedding_version`.
//
// Deliberately NOT here: any accuracy claim. Every number is a property of the
// corpus text and of the reader's profile, not of whether an answer is right.

import { writeFileSync } from 'node:fs';
import { buildCorpus, VEHICLE_TRANSPORTS } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, cos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink } from './text-basis.mjs';

const out = [];
const log = (s) => { console.log(s); out.push(s); };
const T_OWN = 0.70; // §4's shipped `own` bar, sited by #21 against title+1200.
const SHIPPED_CAP = 1200;

// The sweep. 0 means title alone — the candidate #42 measured on 44 and #49
// names as candidate 1. Infinity is the whole extracted body, uncapped.
const CAPS = [0, 100, 200, 300, 400, 600, 800, 1200, 1800, 2400, Infinity];

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const isVehicle = (it) => VEHICLE_TRANSPORTS.has(it.transport) && (it.outbound || []).length > 0;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const med = (a) => q(a, 0.5);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '—');
const capName = (c) => (c === 0 ? 'title' : c === Infinity ? 'uncapped' : String(c));

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: Date.parse(lastAt) });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

const rank = (v) => posVecs.map((pv, k) => ({ k, rel: cos(v, pv) })).sort((a, b) => b.rel - a.rel);
const sum = (v) => { const r = rank(v); return { rel: r[0].rel, idx: r[0].k, gap2: r[0].rel - r[1].rel }; };

// ------------------------------------------------------------- the population
// Rebuilt rather than read off `textBasisOf`, because this script needs the
// title and the body SEPARATELY and that function returns them concatenated.
const set = [];
for (const s of signals) {
  const own = s.citations.filter((c) => c.kind === 'self')
    .map((c) => items[c.itemIdx])
    .filter((it) => it && !isVehicle(it) && clean(it.title))
    .sort((a, b) => (b.text || '').length - (a.text || '').length)[0];
  if (!own) continue;
  set.push({
    url: primaryLink(s),
    strength: s.strength,
    title: clean(own.title),
    body: clean(own.text || ''),
    publisherId: own.publisherId,
  });
}
const n = set.length;
const bodyLens = set.map((x) => x.body.length);
// What §4 actually stores today: `title. body`, then cap the WHOLE string.
const shippedText = (x) => clean(`${x.title}. ${x.body}`).slice(0, SHIPPED_CAP);
const shippedLens = set.map((x) => shippedText(x).length);

log(`=== the population: ${n} \`own\` Signals ===\n`);
log(`  title length        median ${med(set.map((x) => x.title.length))}  p10 ${q(set.map((x) => x.title.length), 0.1)}  p90 ${q(set.map((x) => x.title.length), 0.9)}`);
log(`  body length         median ${med(bodyLens)}  p10 ${q(bodyLens, 0.1)}  p90 ${q(bodyLens, 0.9)}`);
log(`  stored text length  median ${med(shippedLens)}  p90 ${q(shippedLens, 0.9)}   (title + body, capped at ${SHIPPED_CAP})`);
log('');
log(`  IS THE CAP BINDING? Signals whose title+body EXCEEDS ${SHIPPED_CAP}: ${shippedLens.filter((l) => l >= SHIPPED_CAP).length}/${n} (${((shippedLens.filter((l) => l >= SHIPPED_CAP).length / n) * 100).toFixed(1)}%)`);
log(`  Signals with NO body at all (title is the whole text):            ${set.filter((x) => !x.body).length}/${n} (${((set.filter((x) => !x.body).length / n) * 100).toFixed(1)}%)`);
log(`  Signals whose body is under 100 chars:                            ${set.filter((x) => x.body.length < 100).length}/${n}`);
log(`\n  #49 quoted "median \`own\` text length 1200" — that is the CONTESTED 44,`);
log('  not the 849. The whole-rung distribution is the line above.');

// ---------------------------------------------------------------- the sweep
// One embed pass per cap over the whole rung. Texts are deduped by embedAll's
// caller here rather than in the model, so identical strings across caps (a
// Signal with a 200-char body is the same text at 400, 800 and 1200) cost once.
const texts = new Map(); // cap -> string[]
for (const cap of CAPS) {
  texts.set(cap, set.map((x) => (cap === 0 ? x.title : clean(`${x.title}. ${x.body}`).slice(0, cap))));
}
const uniq = [...new Set([...texts.values()].flat())];
log(`\n  embedding ${uniq.length} distinct texts across ${CAPS.length} caps (${n * CAPS.length} cells, deduped)`);
const uv = await embedAll(uniq, {});
const vecOf = new Map(uniq.map((t, i) => [t, uv[i]]));
const summaries = new Map(); // cap -> {rel,idx,gap2}[]
for (const cap of CAPS) summaries.set(cap, texts.get(cap).map((t) => sum(vecOf.get(t))));

const base = summaries.get(SHIPPED_CAP);

log(`\n\n=== the dilution curve, and argmax stability against the shipped ${SHIPPED_CAP} ===\n`);
log('  cap        median REL+   mean REL+   admitted@0.70   argmax != shipped   median gap2');
for (const cap of CAPS) {
  const s = summaries.get(cap);
  const rels = s.map((x) => x.rel);
  const adm = s.filter((x) => x.rel >= T_OWN).length;
  const moved = s.filter((x, i) => x.idx !== base[i].idx).length;
  log(`  ${capName(cap).padEnd(10)} ${f3(med(rels))}         ${f3(rels.reduce((a, b) => a + b, 0) / n)}       ${String(adm).padStart(3)} (${((adm / n) * 100).toFixed(1)}%)      ${String(moved).padStart(3)} (${((moved / n) * 100).toFixed(1)}%)        ${f3(med(s.map((x) => x.gap2)))}`);
}
log(`\n  "argmax != shipped" is the count of why-texts that CHANGE if the cap moves.`);
log('  It is not an error rate — there are 8 labels in this corpus and no more.');

// Is the curve monotone? A curve says dilution is a length effect and the cap is
// the knob; a step or a wobble says it is not, and the cap is not the variable.
log('\n=== is dilution monotone in length? (per-Signal, title vs each cap) ===\n');
const titleS = summaries.get(0);
log('  cap        REL+ higher at cap than at title    REL+ higher at title');
for (const cap of CAPS.filter((c) => c !== 0)) {
  const s = summaries.get(cap);
  const up = s.filter((x, i) => x.rel > titleS[i].rel).length;
  log(`  ${capName(cap).padEnd(10)} ${String(up).padStart(3)} (${((up / n) * 100).toFixed(1)}%)                        ${String(n - up).padStart(3)} (${(((n - up) / n) * 100).toFixed(1)}%)`);
}
// Restricted to the Signals where the cap can actually bite.
const bites = set.map((x, i) => i).filter((i) => shippedLens[i] >= SHIPPED_CAP);
if (bites.length) {
  log(`\n  restricted to the ${bites.length} Signals AT the ${SHIPPED_CAP} cap (where a body genuinely exists to dilute):`);
  log('  cap        median REL+   admitted@0.70   argmax != shipped');
  for (const cap of CAPS) {
    const s = summaries.get(cap);
    const rels = bites.map((i) => s[i].rel);
    const adm = bites.filter((i) => s[i].rel >= T_OWN).length;
    const moved = bites.filter((i) => s[i].idx !== base[i].idx).length;
    log(`  ${capName(cap).padEnd(10)} ${f3(med(rels))}         ${String(adm).padStart(3)} (${((adm / bites.length) * 100).toFixed(1)}%)      ${String(moved).padStart(3)} (${((moved / bites.length) * 100).toFixed(1)}%)`);
  }
}

// ------------------------------------------------------- candidate 3: weighting
// The only candidate that changes what a stored vector IS. Two forms:
//   2x   — the title concatenated twice ahead of the body: still ONE embed of
//          one string, so `embedding_version` is all that moves.
//   mean — normalised mean of vec(title) and vec(title+body): TWO embeds per
//          Signal, and a stored vector that is not the embedding of any text.
const twice = set.map((x) => clean(`${x.title}. ${x.title}. ${x.body}`).slice(0, SHIPPED_CAP));
const twiceV = await embedAll(twice, {});
const twiceS = twiceV.map(sum);
const norm = (v) => { const m = Math.sqrt(v.reduce((a, b) => a + b * b, 0)); return v.map((x) => x / m); };
const meanS = set.map((_, i) => {
  const a = vecOf.get(texts.get(0)[i]);
  const b = vecOf.get(texts.get(SHIPPED_CAP)[i]);
  return sum(norm(a.map((x, k) => x + b[k])));
});

log('\n\n=== candidate 3: title weighted against body ===\n');
log('  variant              median REL+   admitted@0.70   argmax != shipped');
for (const [name, s] of [['title x2 + body', twiceS], ['mean(title, full)', meanS]]) {
  const adm = s.filter((x) => x.rel >= T_OWN).length;
  const moved = s.filter((x, i) => x.idx !== base[i].idx).length;
  log(`  ${name.padEnd(20)} ${f3(med(s.map((x) => x.rel)))}         ${String(adm).padStart(3)} (${((adm / n) * 100).toFixed(1)}%)      ${String(moved).padStart(3)} (${((moved / n) * 100).toFixed(1)}%)`);
}

// -------------------------------------------------- does the 0.70 bar survive?
// #21 sited 0.70 against the title+1200 composition. §4's own premise is that
// cosine is not portable across text lengths, so a composition change re-opens
// the bar by the same argument that keyed the bars per rung. The portable form
// of the bar is #21's floor: the profile's own median pairwise self-similarity,
// which is a property of the model and the genre (#46 re-measured 0.661).
const pair = [];
for (let i = 0; i < posVecs.length; i++) for (let j = i + 1; j < posVecs.length; j++) pair.push(cos(posVecs[i], posVecs[j]));
const floor = med(pair);
log(`\n\n=== does 0.70 survive a composition change? ===\n`);
log(`  the profile's own median pairwise cosine (the floor under every bar): ${f3(floor)}  (n=${pair.length} pairs)`);
log(`  #21 sited T+[own] = ${T_OWN} against title+${SHIPPED_CAP}, i.e. ${f3(T_OWN - floor)} above that floor.\n`);
log('  cap        median REL+   REL+ minus floor   the bar HOLDING that offset');
for (const cap of CAPS) {
  const m = med(summaries.get(cap).map((x) => x.rel));
  log(`  ${capName(cap).padEnd(10)} ${f3(m)}         ${f3(m - floor)}              ${f3(T_OWN + (m - med(base.map((x) => x.rel))))}`);
}
log('\n  The last column is NOT a proposal. It is what a bar preserving the shipped');
log('  offset-above-median would read at each cap — the arithmetic the ticket needs');
log('  in order to see whether "keep 0.70" is a decision or an oversight.');

// ------------------------------------------------------ the ladder, per ADR-0013
// ADR-0013 upheld `own` > `citing` > `slug` partly on the finding that `own`'s
// composition, not the rung, is the fault. Its reopening condition is in play if
// a fixed composition makes `own` LOSE more often, so it is priced rather than
// stumbled into.
log('\n\n=== ADR-0013\'s reopening condition, priced ===\n');
log('  Measured over the CONTESTED 44 only (the population where the ladder has a');
log('  choice at all), in rung-title.mjs re-run against the real profile:');
log('  see rung-title.txt — title beats own-full 20/44 on this profile, down from');
log('  23/44 on the draft. The comparison per cap is below, same 44.');

// The contested set: an `own` Signal that also has a `citing` text.
const { textBasisOf } = await import('./text-basis.mjs');
const contested = [];
for (const s of signals) {
  const tb = textBasisOf(s, items, Infinity);
  if (tb.basis !== 'own') continue;
  const alt = textBasisOf({ ...s, citations: s.citations.filter((c) => c.kind !== 'self') }, items, Infinity);
  if (alt.basis !== 'citing') continue;
  const i = set.findIndex((x) => x.url === primaryLink(s));
  if (i >= 0) contested.push({ i, altText: alt.text });
}
const altV = await embedAll(contested.map((c) => c.altText || 'untitled'), {});
const altS = altV.map(sum);
log(`\n  n=${contested.length} contested`);
log('  cap        own beats citing on REL+   own+citing name the SAME Interest');
for (const cap of CAPS) {
  const s = summaries.get(cap);
  const wins = contested.filter((c, j) => s[c.i].rel > altS[j].rel).length;
  const same = contested.filter((c, j) => s[c.i].idx === altS[j].idx).length;
  log(`  ${capName(cap).padEnd(10)} ${String(wins).padStart(3)}/${contested.length}                     ${String(same).padStart(3)}/${contested.length}`);
}

// ------------------------------------------------------------- the hand labels
// All 8 of them, so the one thing resembling ground truth is at least visible.
const LABELS = {
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
log('\n\n=== the 8 hand labels, per cap (the ONLY correctness evidence there is) ===\n');
const labelled = set.map((x, i) => ({ x, i })).filter(({ x }) => LABELS[x.url]);
for (const { x, i } of labelled) {
  log(`\n  ${x.url}`);
  log(`    [${LABELS[x.url]}]  S=${x.strength}  title ${x.title.length} chars, body ${x.body.length} chars`);
  for (const cap of [0, 200, 400, 1200, Infinity]) {
    const s = summaries.get(cap)[i];
    log(`      ${capName(cap).padEnd(9)} ${f3(s.rel)}  gap ${f3(s.gap2)}  -> #${s.idx + 1} ${positive[s.idx].slice(0, 46)}`);
  }
}
log(`\n  ${labelled.length} of the 9 labelled URLs are on the \`own\` rung. A cap that improves`);
log('  these and a cap that improves the corpus are different claims; neither');
log('  set can license the other, which is the constraint the decision inherits.');

writeFileSync('rung-compose.txt', out.join('\n') + '\n');
writeFileSync('rung-compose.json', JSON.stringify({
  interests: positive,
  caps: CAPS.map(capName),
  floor,
  population: { n, atCap: shippedLens.filter((l) => l >= SHIPPED_CAP).length, noBody: set.filter((x) => !x.body).length },
  rows: set.map((x, i) => ({
    url: x.url,
    strength: x.strength,
    titleLen: x.title.length,
    bodyLen: x.body.length,
    label: LABELS[x.url] || null,
    perCap: Object.fromEntries(CAPS.map((c) => [capName(c), summaries.get(c)[i]])),
  })),
}, null, 2));
