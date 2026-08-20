// PROTOTYPE — throwaway. `node run.mjs` — Zis issue #21.
//
// Sites the four numbers `docs/ranking-model.md` marks provisional, against the
// real corpus #6 measured and a handwritten Interest Profile:
//
//   1. `T+` per `text_basis` rung        (the REL+ distribution, per rung)
//   2. `T-`, the negative-suppression bar (the REL- distribution, below T+)
//   3. the per-day counts                 (eligible / interest / convergence /
//                                          the invisible Strength==2-no-match class)
//   4. `H`                                (inter-citation gaps — a MINOR output;
//                                          #9 found decay gates nothing)
//
// Nothing here should be lifted into the app. The decisions go in the
// resolution comment on issue #21.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from './ingest-text.mjs';
import { BGE_QUERY_PREFIX, embedAll, maxCos, makeCachedEmbedder } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { primaryLink, textBasisOf } from './text-basis.mjs';

const out = [];
const log = (s) => {
  console.log(s);
  out.push(s);
};

const RUNGS = ['own', 'citing', 'slug'];
const DAY = 86400e3;

// ------------------------------------------------------------------ stats

const q = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))] : null);
const f = (x) => (x == null ? '  —  ' : x.toFixed(3));

function describe(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return {
    n: s.length,
    min: q(s, 0), p10: q(s, 0.1), p25: q(s, 0.25), p50: q(s, 0.5),
    p75: q(s, 0.75), p90: q(s, 0.9), p95: q(s, 0.95), p99: q(s, 0.99), max: q(s, 1),
    mean: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null,
  };
}

function statRow(label, d) {
  return `  ${label.padEnd(10)} n=${String(d.n).padStart(5)}  min ${f(d.min)}  p10 ${f(d.p10)}  p25 ${f(d.p25)}  MED ${f(d.p50)}  p75 ${f(d.p75)}  p90 ${f(d.p90)}  p95 ${f(d.p95)}  p99 ${f(d.p99)}  max ${f(d.max)}`;
}

// ------------------------------------------------------------------- corpus

log('=== ingest (cached — 958 responses on disk, no network for the corpus) ===');
const items = await ingestAll({ log });
log(`total items: ${items.length}`);
const withText = items.filter((i) => (i.text || '').length > 40).length;
log(`items carrying extracted text (>40 chars): ${withText} of ${items.length}`);

// `now` is INJECTED, never read, so the run is replayable — #6's rule, and here
// it is load-bearing twice over: the cache is historical, so a real clock would
// make every Signal older than E2's 7-day cutoff and empty every Brief.
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
log(`injected now = ${new Date(NOW).toISOString()} (newest Item in the corpus)`);

log('\n=== corpus build (#6 config, unchanged) ===');
const corpus = await buildCorpus(items, { log, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { signals } = corpus;
log(`  signals: ${signals.length}  (strength>=2: ${signals.filter((s) => s.strength >= 2).length}, >=3: ${signals.filter((s) => s.strength >= 3).length})`);

// ---------------------------------------------------------------- interests

log('\n=== Interest Profile ===');
const { positive, negative, tooLong } = loadInterests();
log(`  ${positive.length} positive, ${negative.length} negative`);
if (tooLong.length) log(`  ! ${tooLong.length} statement(s) over ADR-0003's ~200-char cap`);

log('  embedding Interests (both prefix stances)');
const posVecs = await embedAll(positive, { log });
const negVecs = await embedAll(negative, { log });
const posVecsQ = await embedAll(positive.map((s) => BGE_QUERY_PREFIX + s), { log });
const negVecsQ = await embedAll(negative.map((s) => BGE_QUERY_PREFIX + s), { log });

// A sanity floor before any threshold is read off anything: how similar are the
// reader's own Interests to EACH OTHER? A bar below that number is not
// measuring topical match, it is measuring "this text is about software".
const interPairs = [];
for (let i = 0; i < posVecs.length; i++)
  for (let j = i + 1; j < posVecs.length; j++) interPairs.push(maxCos(posVecs[i], [posVecs[j]]).rel);
const interD = describe(interPairs);
log(statRow('pos↔pos', interD));

// ------------------------------------------------- final-state rung + REL+/REL-

log('\n=== text_basis over the whole corpus (final state) ===');
const basis = signals.map((s) => textBasisOf(s, items, Infinity));
for (const r of RUNGS) {
  const g = basis.filter((b) => b.basis === r);
  const lens = describe(g.map((b) => b.text.length));
  log(`  ${r.padEnd(7)} ${String(g.length).padStart(5)} signals (${((100 * g.length) / signals.length).toFixed(1)}%)  text chars: med ${lens.p50} p90 ${lens.p90} max ${lens.max}`);
}

const anchored = basis.filter((b) => b.basis === 'citing' && b.anchorCount > 0).length;
const citingN = basis.filter((b) => b.basis === 'citing').length;
log(`  of ${citingN} citing-rung Signals, ${anchored} (${((100 * anchored) / citingN).toFixed(1)}%) have anchor text from at least one citing Publisher`);

log('\n=== embedding the corpus (local, ~5k texts × 2 citing variants) ===');
const sigVecs = await embedAll(basis.map((b) => b.text), { log, label: 'signals' });
// The §4-as-written variant, so the anchor-text question is measured rather
// than argued. Only the citing rung differs; the other two are identical texts
// and the cache in embedAll is per-call, so this is one extra pass over ~4k.
const sigVecsTitles = await embedAll(basis.map((b) => b.textTitlesOnly || b.text), { log, label: 'titles-only' });

const rows = signals.map((s, i) => {
  const plain = maxCos(sigVecs[i], posVecs);
  const plainNeg = negVecs.length ? maxCos(sigVecs[i], negVecs) : { rel: -1, idx: -1 };
  const pref = maxCos(sigVecs[i], posVecsQ);
  const prefNeg = negVecsQ.length ? maxCos(sigVecs[i], negVecsQ) : { rel: -1, idx: -1 };
  return {
    id: s.id,
    url: primaryLink(s),
    strength: s.strength,
    basis: basis[i].basis,
    firstSeen: s.firstSeen,
    lastSeen: s.lastSeen,
    relPlus: plain.rel,
    matched: plain.idx,
    relMinus: plainNeg.rel,
    matchedNeg: plainNeg.idx,
    relPlusPrefixed: pref.rel,
    matchedPrefixed: pref.idx,
    relMinusPrefixed: prefNeg.rel,
    relPlusTitles: maxCos(sigVecsTitles[i], posVecs).rel,
    matchedTitles: maxCos(sigVecsTitles[i], posVecs).idx,
    anchorCount: basis[i].anchorCount || 0,
    text: basis[i].text,
    textTitlesOnly: basis[i].textTitlesOnly,
  };
});

// ------------------------------------------------------- output 1: REL+ per rung

log('\n=== OUTPUT 1 — REL+ distribution per text_basis rung ===');
log('  (a) the whole corpus — this is the rung-scale question, not the bar question');
for (const r of RUNGS) log(statRow(r, describe(rows.filter((x) => x.basis === r).map((x) => x.relPlus))));
log('  with BGE query prefix on the Interest side:');
for (const r of RUNGS) log(statRow(r, describe(rows.filter((x) => x.basis === r).map((x) => x.relPlusPrefixed))));

const eligible = rows.filter((x) => x.strength >= 2);
log(`\n  (b) the ELIGIBLE population (Strength >= 2) — n=${eligible.length}, the set the bar actually acts on`);
for (const r of RUNGS) log(statRow(r, describe(eligible.filter((x) => x.basis === r).map((x) => x.relPlus))));

log('\n  (c) citing rung: anchor text vs §4-as-written Item titles');
const citingRows = rows.filter((x) => x.basis === 'citing');
log(statRow('anchors', describe(citingRows.map((x) => x.relPlus))));
log(statRow('titles', describe(citingRows.map((x) => x.relPlusTitles))));
const disagree = citingRows.filter((x) => x.anchorCount > 0 && x.matched !== x.matchedTitles).length;
const anchoredRows = citingRows.filter((x) => x.anchorCount > 0);
log(`  of ${anchoredRows.length} anchored citing Signals, ${disagree} (${((100 * disagree) / Math.max(1, anchoredRows.length)).toFixed(1)}%) pick a DIFFERENT argmax Interest under the two texts`);
log('  — the argmax IS the why-text (ADR-0003), so that percentage is the share of');
log('    explanations the two definitions of this rung disagree about.');

log('\n  every eligible Signal, sorted by REL+ — small enough to read, so read it:');
for (const x of [...eligible].sort((a, b) => b.relPlus - a.relPlus)) {
  log(`  REL+ ${x.relPlus.toFixed(3)}  S=${x.strength}  ${x.basis.padEnd(6)}  ${x.url}`);
  log(`        matched: "${positive[x.matched]}"`);
  log(`        text: ${x.text.slice(0, 200)}`);
  if (x.basis === 'citing' && x.anchorCount > 0 && x.matched !== x.matchedTitles) {
    log(`        titles-only would have said ${x.relPlusTitles.toFixed(3)} / "${positive[x.matchedTitles]}"`);
  }
}

// -------------------------------------------------------- output 2: REL- and T-

log('\n=== OUTPUT 2 — REL- distribution (negative suppression) ===');
for (const r of RUNGS) log(statRow(r, describe(rows.filter((x) => x.basis === r).map((x) => x.relMinus))));
log(`  eligible only: ${statRow('all', describe(eligible.map((x) => x.relMinus))).trim()}`);
log('\n  eligible Signals by REL-, top 12 — the population E4 would suppress:');
for (const x of [...eligible].sort((a, b) => b.relMinus - a.relMinus).slice(0, 12)) {
  log(`  REL- ${x.relMinus.toFixed(3)}  REL+ ${x.relPlus.toFixed(3)}  S=${x.strength}  ${x.basis.padEnd(6)}  ${x.url}`);
  log(`        nearest negative: "${negative[x.matchedNeg]}"`);
}

// ------------------------------------------------------- output 4: H, cheaply

log('\n=== OUTPUT 4 — inter-citation gaps (H). MINOR: #9 found decay gates nothing ===');
const gaps = [];
for (const s of signals) {
  if (s.strength < 2) continue;
  const seen = new Set();
  const firsts = [];
  for (const c of [...s.citations].filter((c) => c.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (seen.has(c.publisherId)) continue;
    seen.add(c.publisherId);
    firsts.push(Date.parse(c.at));
  }
  if (firsts.length >= 2) gaps.push({ to2nd: (firsts[1] - firsts[0]) / 3600e3, toLast: (firsts[firsts.length - 1] - firsts[0]) / 3600e3, n: firsts.length });
}
const g2 = describe(gaps.map((g) => g.to2nd));
const gl = describe(gaps.map((g) => g.toLast));
log(statRow('1st→2nd h', g2));
log(statRow('1st→Nth h', gl));
log(`  n=${gaps.length} Signals with >=2 distinct Publishers`);

// ------------------------------------------- output 3: the per-day replay

// The backfill/steady-state trap, handled the only way it can be: every per-day
// number below is derived from CITATION TIMESTAMPS. Nothing is 27 divided by
// anything convenient.
log('\n=== OUTPUT 3 — per-day counts, replayed from Citation timestamps ===');

const allTs = [];
for (const s of signals) for (const c of s.citations) if (c.at) allTs.push(Date.parse(c.at));
allTs.sort((a, b) => a - b);
const spanDays = (allTs[allTs.length - 1] - allTs[0]) / DAY;
log(`  citation timestamps span ${spanDays.toFixed(0)} days (${new Date(allTs[0]).toISOString().slice(0, 10)} → ${new Date(allTs[allTs.length - 1]).toISOString().slice(0, 10)})`);
const p50Ts = allTs[Math.floor(allTs.length / 2)];
log(`  median citation timestamp: ${new Date(p50Ts).toISOString().slice(0, 10)} — the corpus is FRONT-LOADED; days before the dense window are backfill, not steady state`);

const embedCached = makeCachedEmbedder(log);

/**
 * What a Brief cut at the end of `dayMs` would hold, using only Citations at or
 * before the cut. `text_basis` is recomputed at the cut too, because §4's
 * re-embedding-on-rung-improvement means a Signal's rung is a function of time.
 */
async function replay(tPlus, tMinus, { days, prefixed = false }) {
  const admittedEver = new Set(); // E3 / ADR-0007
  const perDay = [];
  const pv = prefixed ? posVecsQ : posVecs;
  const nv = prefixed ? negVecsQ : negVecs;

  for (const cut of days) {
    const cand = [];
    for (const s of signals) {
      if (admittedEver.has(s.id)) continue; // E3
      const cites = s.citations.filter((c) => c.at && Date.parse(c.at) <= cut);
      if (!cites.length) continue;

      // STRENGTH at the cut — distinct voting Publishers, origin excluded, using
      // the same self-citation guard #6 defined.
      const voters = new Set();
      for (const c of cites) {
        const host = (() => { try { return new URL(c.linkUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        const owner = HOST_OWNER.get(host);
        if (owner && owner === c.publisherId) continue; // origin, not a voice
        voters.add(c.publisherId);
      }
      const strength = voters.size;
      if (strength < 2) continue; // E1

      const first = Math.min(...cites.map((c) => Date.parse(c.at)));
      if (cut - first > 7 * DAY) continue; // E2
      const last = Math.max(...cites.map((c) => Date.parse(c.at)));
      cand.push({ s, strength, first, last, tb: textBasisOf(s, items, cut) });
    }
    if (!cand.length) {
      perDay.push({ day: new Date(cut).toISOString().slice(0, 10), eligible: 0, interest: 0, convergence: 0, rejected: 0, suppressed: 0, size: 0 });
      continue;
    }

    const vecs = await embedCached(cand.map((c) => c.tb.text));
    let interest = 0, convergence = 0, rejected = 0, suppressed = 0;
    for (let i = 0; i < cand.length; i++) {
      const c = cand[i];
      const relMinus = nv.length ? maxCos(vecs[i], nv).rel : -1;
      if (relMinus >= tMinus) { suppressed++; continue; } // E4
      const relPlus = maxCos(vecs[i], pv).rel;
      if (relPlus >= tPlus[c.tb.basis]) { interest++; admittedEver.add(c.s.id); }
      else if (c.strength >= 3) { convergence++; admittedEver.add(c.s.id); }
      else rejected++; // the invisible Strength==2-no-match class
    }
    perDay.push({
      day: new Date(cut).toISOString().slice(0, 10),
      eligible: cand.length, interest, convergence, rejected, suppressed,
      size: interest + convergence,
    });
  }
  return perDay;
}

// host -> publisherId, for the replay's self-citation guard.
const { PUBLISHERS } = await import('../PROTOTYPE-clustering/sources.mjs');
const HOST_OWNER = new Map();
for (const p of PUBLISHERS) for (const h of p.hosts || []) HOST_OWNER.set(h.replace(/^www\./, ''), p.id);

// The dense window: the last 30 days the corpus actually covers. Earlier days
// are the years-deep backfill tail and a per-day rate taken over them is the
// exact error the ticket warns about.
const lastDay = Math.floor(allTs[allTs.length - 1] / DAY) * DAY + DAY - 1;
const REPLAY_DAYS = 30;
const days = Array.from({ length: REPLAY_DAYS }, (_, i) => lastDay - (REPLAY_DAYS - 1 - i) * DAY);

// The grid. A single guessed triple would be the error #6's precedent warns
// about; the point is to see density AS A FUNCTION of the bar.
const GRID = [];
for (const own of [0.50, 0.55, 0.60, 0.65, 0.70]) GRID.push(own);
const T_MINUS_GRID = [0.45, 0.50, 0.55, 0.60];

const gridResults = [];
for (const base of GRID) {
  // Per-rung offsets are NOT invented here — they come out of output 1's
  // measured per-rung medians, applied as the shift between rung scales.
  const tPlus = { own: base, citing: base, slug: base };
  const perDay = await replay(tPlus, 0.99, { days });
  const sizes = perDay.map((d) => d.size);
  const trailing14 = sizes.slice(-14).sort((a, b) => a - b);
  gridResults.push({
    tPlus, perDay,
    totalInterest: perDay.reduce((a, d) => a + d.interest, 0),
    totalConvergence: perDay.reduce((a, d) => a + d.convergence, 0),
    totalRejected: perDay.reduce((a, d) => a + d.rejected, 0),
    medianTrailing14: q(trailing14, 0.5),
    meanSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
    emptyDays: sizes.filter((x) => x === 0).length,
  });
  log(`  flat T+=${base.toFixed(2)}  interest ${String(gridResults.at(-1).totalInterest).padStart(3)}  convergence ${String(gridResults.at(-1).totalConvergence).padStart(3)}  rejected ${String(gridResults.at(-1).totalRejected).padStart(4)}  trailing-14 median ${gridResults.at(-1).medianTrailing14}  empty days ${gridResults.at(-1).emptyDays}/${REPLAY_DAYS}`);
}

log('\n  per-day detail at the loosest bar in the grid (the eligible/rejected columns are bar-independent):');
for (const d of gridResults[0].perDay) {
  log(`    ${d.day}  eligible ${String(d.eligible).padStart(3)}  interest ${String(d.interest).padStart(2)}  convergence ${String(d.convergence).padStart(2)}  rejected ${String(d.rejected).padStart(3)}  -> Brief size ${d.size}`);
}

log('\n  T- sweep (how many eligible Signals a negative bar would suppress, over the window):');
for (const tm of T_MINUS_GRID) {
  const perDay = await replay({ own: 0.60, citing: 0.60, slug: 0.60 }, tm, { days });
  log(`    T-=${tm.toFixed(2)}  suppressed ${perDay.reduce((a, d) => a + d.suppressed, 0)}  interest ${perDay.reduce((a, d) => a + d.interest, 0)}  convergence ${perDay.reduce((a, d) => a + d.convergence, 0)}`);
}

// ------------------------------------------------------------------ write out

writeFileSync(join(import.meta.dirname, 'findings.txt'), out.join('\n') + '\n');
writeFileSync(
  join(import.meta.dirname, 'findings.json'),
  JSON.stringify({ now: NOW, interests: { positive, negative }, interestSelfSimilarity: interD, rows, gaps, gridResults }, null, 2)
);
log('\nwrote findings.txt + findings.json');
