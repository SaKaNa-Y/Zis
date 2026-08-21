// PROTOTYPE — throwaway. Zis issue #35, third follow-up.
//
// #35 decided the why-text needs a SECOND condition beyond T+: the winning
// Interest must beat the runner-up by some gap, because a flat ranking is the
// profile saying it has no opinion (the mechanism is #21's 0.659 floor — the
// reader's own statements are nearly as similar to each other as a Signal is to
// its best match, so a flat ranking's winner is decided by noise).
//
// Failing the gap means failing the INTEREST ROUTE (there is no surface for
// "matched, weakly" — #10 has no badge anywhere in the product). So the floor
// costs entries, and two settled numbers move when it does:
//
//   1. DENSITY. ranking-model.md §9 targets a trailing-14-day median of >=5 and
//      already misses it by a factor of five. This makes it worse.
//   2. SEPARABILITY. positioning.md §7's falsifier — "if the Interest Profile
//      selects nothing convergence would not have surfaced anyway, the reason
//      each story appears is decoration". It is currently NOT firing because
//      all five interest-route entries are Strength 2, below convergence's
//      threshold of 3. If the floor removes exactly the Strength-2 entries, the
//      falsifier moves toward firing — and that is a positioning claim, so it
//      gets measured rather than guessed.
//
// This is run.mjs's replay, with the settled per-rung T+ and a gap floor swept
// over it. Same cached corpus, same injected `now`, no network.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { PUBLISHERS } from '../PROTOTYPE-clustering/sources.mjs';
import { ingestAll } from './ingest-text.mjs';
import { embedAll, cos } from './embed.mjs';
import { loadInterests } from './interests.mjs';
import { textBasisOf, primaryLink } from './text-basis.mjs';

const out = [];
const log = (s) => { console.log(s); out.push(s); };
const DAY = 86400000;

/** The settled bars — ranking-model.md §4. `slug` fails the route by rule. */
const T_PLUS = { own: 0.70, citing: 0.67, slug: Infinity };

const items = await ingestAll({ log: () => {} });
const lastAt = items.reduce((a, i) => (i.publishedAt && i.publishedAt > a ? i.publishedAt : a), '');
const NOW = Date.parse(lastAt);
const { signals } = await buildCorpus(items, { log: () => {}, mergeWindowHours: 72, closeAfterHours: 72, now: NOW });
const { positive } = loadInterests();
const posVecs = await embedAll(positive, {});

const HOST_OWNER = new Map();
for (const p of PUBLISHERS) for (const h of p.hosts || []) HOST_OWNER.set(h.replace(/^www\./, ''), p.id);

// One embedding cache across the whole sweep — the same (signal, cut) text
// recurs on every floor, and re-embedding it would make this take minutes.
const cache = new Map();
async function embedCached(texts) {
  const missing = texts.filter((t) => !cache.has(t));
  if (missing.length) {
    const uniq = [...new Set(missing)];
    const vs = await embedAll(uniq, {});
    uniq.forEach((t, i) => cache.set(t, vs[i]));
  }
  return texts.map((t) => cache.get(t));
}

const allTs = signals
  .flatMap((s) => s.citations.map((c) => (c.at ? Date.parse(c.at) : NaN)))
  .filter((t) => !Number.isNaN(t))
  .sort((a, b) => a - b);
const lastDay = Math.floor(allTs[allTs.length - 1] / DAY) * DAY + DAY - 1;
const REPLAY_DAYS = 30;
const days = Array.from({ length: REPLAY_DAYS }, (_, i) => lastDay - (REPLAY_DAYS - 1 - i) * DAY);

/** gapFloor = 0 reproduces the settled model exactly, as the control. */
async function replay(gapFloor) {
  const admittedEver = new Set(); // E3 / ADR-0007
  const perDay = [];
  const entries = [];

  for (const cut of days) {
    const cand = [];
    for (const s of signals) {
      if (admittedEver.has(s.id)) continue;
      const cites = s.citations.filter((c) => c.at && Date.parse(c.at) <= cut);
      if (!cites.length) continue;
      const voters = new Set();
      for (const c of cites) {
        const host = (() => { try { return new URL(c.linkUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        const owner = HOST_OWNER.get(host);
        if (owner && owner === c.publisherId) continue;
        voters.add(c.publisherId);
      }
      const strength = voters.size;
      if (strength < 2) continue; // E1
      const first = Math.min(...cites.map((c) => Date.parse(c.at)));
      if (cut - first > 7 * DAY) continue; // E2
      cand.push({ s, strength, tb: textBasisOf(s, items, cut) });
    }
    if (!cand.length) {
      perDay.push({ day: new Date(cut).toISOString().slice(0, 10), eligible: 0, interest: 0, convergence: 0, flat: 0, rejected: 0, size: 0 });
      continue;
    }

    const vecs = await embedCached(cand.map((c) => c.tb.text));
    let interest = 0, convergence = 0, flat = 0, rejected = 0;
    for (let i = 0; i < cand.length; i++) {
      const c = cand[i];
      const r = posVecs.map((pv, k) => ({ k, rel: cos(vecs[i], pv) })).sort((a, b) => b.rel - a.rel);
      const relPlus = r[0].rel;
      const gap = r[0].rel - r[1].rel;
      const clears = relPlus >= T_PLUS[c.tb.basis];
      const opinionated = gap >= gapFloor;

      if (clears && opinionated) {
        interest++;
        admittedEver.add(c.s.id);
        entries.push({ day: new Date(cut).toISOString().slice(0, 10), route: 'interest', strength: c.strength, rel: relPlus, gap, basis: c.tb.basis, url: primaryLink(c.s), idx: r[0].k, text: c.tb.text });
      } else if (c.strength >= 3) {
        convergence++;
        admittedEver.add(c.s.id);
        entries.push({ day: new Date(cut).toISOString().slice(0, 10), route: 'convergence', strength: c.strength, rel: relPlus, gap, basis: c.tb.basis, url: primaryLink(c.s), idx: r[0].k, text: c.tb.text });
      } else {
        if (clears && !opinionated) flat++;
        rejected++;
      }
    }
    perDay.push({ day: new Date(cut).toISOString().slice(0, 10), eligible: cand.length, interest, convergence, flat, rejected, size: interest + convergence });
  }

  const sizes = perDay.map((d) => d.size);
  const trailing14 = [];
  for (let i = 13; i < sizes.length; i++) trailing14.push(sizes.slice(i - 13, i + 1).reduce((a, b) => a + b, 0) / 14);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  return {
    gapFloor, perDay, entries,
    interest: perDay.reduce((a, d) => a + d.interest, 0),
    convergence: perDay.reduce((a, d) => a + d.convergence, 0),
    flat: perDay.reduce((a, d) => a + d.flat, 0),
    emptyDays: perDay.filter((d) => d.size === 0).length,
    medianTrailing14: med(perDay.map((d, i) => sizes.slice(Math.max(0, i - 13), i + 1).reduce((a, b) => a + b, 0))),
  };
}

log('=== the 30-day replay, settled bars (own 0.70 / citing 0.67 / slug fails) ===');
log('   gapFloor 0.000 is the CONTROL — it reproduces the settled model exactly.\n');
log('  gapFloor  interest  convergence  brief entries  flat-suppressed  trailing-14 median  empty days');

const results = [];
for (const floor of [0, 0.02, 0.03, 0.038, 0.05, 0.06]) {
  const r = await replay(floor);
  results.push(r);
  log(`  ${floor.toFixed(3)}     ${String(r.interest).padStart(4)}      ${String(r.convergence).padStart(6)}       ${String(r.interest + r.convergence).padStart(6)}         ${String(r.flat).padStart(6)}              ${String(r.medianTrailing14).padStart(5)}          ${r.emptyDays}/${REPLAY_DAYS}`);
}

log('\n\n=== SEPARABILITY (positioning.md §7) ===');
log('   The falsifier: if the Interest Profile selects nothing convergence would');
log('   not have surfaced anyway, the why-text is decoration. An interest-route');
log('   entry at Strength >=3 is one convergence WOULD have caught — those are the');
log('   ones that make the profile look decorative.\n');
for (const r of results) {
  const ir = r.entries.filter((e) => e.route === 'interest');
  const rescued = ir.filter((e) => e.strength < 3).length;
  const dupe = ir.filter((e) => e.strength >= 3).length;
  log(`  gapFloor ${r.gapFloor.toFixed(3)}: ${ir.length} interest-route entries — ${rescued} at Strength 2 (only the profile could surface these), ${dupe} at Strength >=3 (convergence would have too)`);
  log(`                  ${rescued === 0 ? '*** FALSIFIER FIRES — the profile selects nothing convergence would not ***' : 'falsifier does NOT fire'}`);
}

log('\n\n=== the surviving interest-route entries, per floor ===');
for (const r of results) {
  log(`\n-- gapFloor ${r.gapFloor.toFixed(3)}`);
  for (const e of r.entries.filter((x) => x.route === 'interest')) {
    log(`  ${e.day}  S=${e.strength}  REL+ ${e.rel.toFixed(3)}  gap ${e.gap.toFixed(3)}  ${e.basis.padEnd(6)}  #${e.idx + 1} ${positive[e.idx].slice(0, 40)}`);
    log(`              ${e.text.slice(0, 92)}`);
  }
}

writeFileSync(join(import.meta.dirname, 'argmax-replay.txt'), out.join('\n') + '\n');
writeFileSync(join(import.meta.dirname, 'argmax-replay.json'), JSON.stringify({ interests: positive, results }, null, 2));
log('\nwrote argmax-replay.txt + argmax-replay.json');
