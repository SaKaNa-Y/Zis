// PROTOTYPE — throwaway. `node run.mjs` — Zis issue #6.
// Fetches real data, runs the cascade, forms Signals, and judges the result
// against the expected clusters and negative controls from the research docs.
// Writes findings.md next to this file. Reruns are free (net.mjs caches).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalizeSync, isPubliclyRoutable, PAGINATION_STANCE } from './canonicalize.mjs';
import { buildCorpus, DEFAULTS, isBoilerplate } from './cluster.mjs';
import { ingestAll } from './ingest.mjs';
import { netStats } from './net.mjs';
import { CANON_CASES, EXPECTED_CLUSTERS, NEGATIVE_CONTROL_PUBLISHERS } from './cases.mjs';
import { ownerOfHost, PUBLISHER_BY_ID, PUBLISHERS } from './sources.mjs';

const out = [];
const log = (s) => {
  console.log(s);
  out.push(s);
};
const md = [];

// ---------------------------------------------------------------- part 1 test

function runCanonCases() {
  const rows = [];
  let pass = 0;
  let fail = 0;
  for (const [input, expected, why] of CANON_CASES) {
    const r = canonicalizeSync(input);
    let got = r?.url ?? null;
    if (got && !isPubliclyRoutable(got)) got = null; // SSRF guard, as the pipeline applies it
    const ok = got === expected;
    if (expected === null && got === null) rows.push([input, '(rejected)', 'ok', why]);
    else rows.push([input, got ?? '(rejected)', ok ? 'ok' : `WANTED ${expected}`, why]);
    ok ? pass++ : fail++;
  }
  return { rows, pass, fail };
}

// ------------------------------------------------------------------ the run

log('=== ingest ===');
const items = await ingestAll({ log });
log(`total items: ${items.length}`);

log('\n=== canonicalization cases ===');
const canon = runCanonCases();
for (const [i, g, v] of canon.rows) if (v !== 'ok') log(`  FAIL ${i}\n       got ${g}\n       ${v}`);
log(`  ${canon.pass} pass / ${canon.fail} fail`);

log('\n=== corpus build (window 72h) ===');
const corpus = await buildCorpus(items, { log, mergeWindowHours: 72, closeAfterHours: 72 });

const { signals, links, citations, notes } = corpus;
const multi = signals.filter((s) => s.strength >= 2);
log(`  signals: ${signals.length}  (strength>=2: ${multi.length}, >=3: ${signals.filter((s) => s.strength >= 3).length}, >=5: ${signals.filter((s) => s.strength >= 5).length})`);
log(`  merges applied: ${corpus.sig.mergeLog.filter((m) => !m.refused).length}, refused (closed/out-of-window): ${corpus.sig.mergeLog.filter((m) => m.refused).length}`);

// ----------------------------------------------------------- window sweep

log('\n=== window sweep (does the window matter?) ===');
const sweep = [];
for (const w of [12, 24, 48, 72, 168]) {
  const c = await buildCorpus(items, { log: () => {}, mergeWindowHours: w, closeAfterHours: w });
  const m2 = c.signals.filter((s) => s.strength >= 2).length;
  const m3 = c.signals.filter((s) => s.strength >= 3).length;
  const refused = c.sig.mergeLog.filter((x) => x.refused).length;
  sweep.push({ w, signals: c.signals.length, m2, m3, refused });
  log(`  ${String(w).padStart(3)}h: signals ${c.signals.length}  s>=2 ${m2}  s>=3 ${m3}  merges refused ${refused}`);
}

// ------------------------------------------------------ layer ablation study

log('\n=== layer ablation (which layers earn their keep?) ===');
const ablations = [
  ['all layers', {}],
  ['no shortener unwrap', { resolveShorteners: false }],
  ['no HN discussion alias', { resolveHnDiscussions: false }],
  ['no rel=canonical', { publisherCanonicalMinCites: 0 }],
  ['no github rename', { resolveGithubRenames: false }],
  ['no release bridge', { releaseBridge: false }],
  ['no reference filter', { dropReferenceOnly: false }],
  ['no intra-publisher filter', { dropIntraPublisherLinks: false }],
  ['no citation-worthiness at all', { dropReferenceOnly: false, dropIntraPublisherLinks: false }],
  ['no vehicle folding', { mergeSingleCitationVehicles: false }],
  ['pure syntactic only', { resolveShorteners: false, resolveHnDiscussions: false, publisherCanonicalMinCites: 0, resolveGithubRenames: false, releaseBridge: false, mergeSingleCitationVehicles: false }],
];
const ablationRows = [];
for (const [name, opts] of ablations) {
  const c = await buildCorpus(items, { log: () => {}, ...opts });
  const row = {
    name,
    links: c.links.size,
    signals: c.signals.length,
    s2: c.signals.filter((s) => s.strength >= 2).length,
    s3: c.signals.filter((s) => s.strength >= 3).length,
    maxStrength: Math.max(0, ...c.signals.map((s) => s.strength)),
  };
  ablationRows.push(row);
  log(`  ${name.padEnd(24)} links ${String(row.links).padStart(5)}  signals ${String(row.signals).padStart(5)}  s>=2 ${String(row.s2).padStart(4)}  s>=3 ${String(row.s3).padStart(4)}  max ${row.maxStrength}`);
}

// --------------------------------------------------- expected-cluster judging

log('\n=== expected clusters (C1..C10) ===');
const clusterVerdicts = [];
for (const ec of EXPECTED_CLUSTERS) {
  const hits = signals
    .filter((s) => s.links.some(ec.match))
    .sort((a, b) => b.strength - a.strength);
  const best = hits[0];
  const verdict = !best
    ? 'ABSENT — no Link of this shape in the corpus at all'
    : best.strengthWithOrigin >= ec.min
      ? `MET (${best.strength}+origin=${best.strengthWithOrigin})`
      : `THIN (${best.strength}, +origin=${best.strengthWithOrigin}, wanted >=${ec.min})`;
  clusterVerdicts.push({ ...ec, count: hits.length, best, verdict });
  log(`  ${ec.id.padEnd(4)} ${ec.name.padEnd(42)} ${verdict}`);
  if (best) {
    log(`        ${best.links[0]}`);
    log(`        voters: ${best.voters.map((v) => PUBLISHER_BY_ID.get(v)?.name || v).join(', ') || '(none)'}${best.origin ? `  [origin: ${PUBLISHER_BY_ID.get(best.origin)?.name}]` : ''}`);
  }
}

// ------------------------------------------------------- negative controls

log('\n=== negative controls (must NOT cluster) ===');
const controlFalsePositives = [];
for (const pid of NEGATIVE_CONTROL_PUBLISHERS) {
  const own = PUBLISHER_BY_ID.get(pid)?.hosts || [];
  const bad = signals.filter(
    (s) => s.strength >= 2 && s.links.some((u) => own.some((h) => u.includes(h)))
  );
  log(`  ${pid.padEnd(14)} multi-publisher signals touching its hosts: ${bad.length}`);
  for (const s of bad.slice(0, 6)) {
    log(`      s=${s.strength} ${s.links[0]}`);
    log(`         voters: ${s.voters.join(', ')}`);
    controlFalsePositives.push({ pid, strength: s.strength, url: s.links[0], voters: s.voters });
  }
}

// ---------------------------------------------- part 3: second-pass headroom
// Lexical proxy for an embedding pass. NOT embeddings — a deterministic
// token-Jaccard over titles, used only to BOUND how much a second pass could
// add. If the headroom is small here it will be small for embeddings too;
// if it is large, the false-merge rate below is what embeddings must beat.

const STOP = new Set('a an the and or of for to in on is are with from at by new now you your we our it its this that how why what release released announcing announcement introducing update updates version blog post'.split(' '));
const toks = (t) =>
  new Set(
    String(t || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
const jac = (a, b) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
};

log('\n=== part 3: second-pass headroom (lexical proxy, NOT embeddings) ===');
// A Signal's title may ONLY come from an Item that IS one of its Links. Taking
// the first citing Item's title instead (the prototype's first attempt) labels
// a cited-only Link with the headline of whatever happened to link it — which
// made every newsletter's 40 outbound Links share the newsletter's title and
// produced ~19.5k bogus "duplicate" pairs. C6 proves cited-only Links are the
// common case, so most Signals legitimately have NO title of their own; that
// is itself the finding about what an embedding pass can and cannot see.
const titleFor = (s) => {
  const c = s.citations.find((x) => x.kind === 'self' && s.links.includes(x.linkUrl));
  return c ? items[c.itemIdx]?.title || '' : '';
};
const titled = signals.filter((s) => titleFor(s));
log(`  Signals with a title of their own (an ingested Item): ${titled.length} / ${signals.length}`);
log(`  Signals that are cited-only (no ingested Item — the C6 shape): ${signals.length - titled.length}`);
const cand = titled.filter((s) => toks(titleFor(s)).size >= 3).slice(0, 900);
const pairs = [];
for (let i = 0; i < cand.length; i++) {
  const a = toks(titleFor(cand[i]));
  for (let j = i + 1; j < cand.length; j++) {
    const b = toks(titleFor(cand[j]));
    const sc = jac(a, b);
    if (sc >= 0.45) pairs.push({ sc, a: cand[i], b: cand[j] });
  }
}
pairs.sort((x, y) => y.sc - x.sc);
log(`  candidate cross-Signal pairs at Jaccard>=0.45: ${pairs.length} (of ${(cand.length * (cand.length - 1)) / 2} pairs)`);
for (const p of pairs.slice(0, 25)) {
  log(`   ${p.sc.toFixed(2)} "${titleFor(p.a)}" [${p.a.voters.length}p]`);
  log(`        vs "${titleFor(p.b)}" [${p.b.voters.length}p]`);
  log(`        ${p.a.links[0]}`);
  log(`        ${p.b.links[0]}`);
}

// ------------------------------------------------------------- top signals

log('\n=== top signals by strength ===');
for (const s of signals.slice(0, 30)) {
  log(`  s=${String(s.strength).padStart(2)} score=${s.score.toFixed(2)} ${s.closed ? '[closed]' : '        '} ${s.links[0]}`);
  log(`        "${(titleFor(s) || '').slice(0, 90)}"`);
  log(`        ${s.voters.map((v) => PUBLISHER_BY_ID.get(v)?.name || v).join(', ')}${s.origin ? ` | origin=${PUBLISHER_BY_ID.get(s.origin)?.name}` : ''}`);
  if (s.links.length > 1) log(`        merged links: ${s.links.length} -> ${s.links.slice(1, 4).join(' , ')}`);
}

// ------------------------------------------------------- issue-page leverage

const agg = items.filter((i) => i.needsIssuePage);
const gained = agg.filter((i) => i.issuePageGain > 0);
log('\n=== issue-page hydration leverage ===');
log(`  aggregator items: ${agg.length}, hydrated with gain: ${gained.length}, links gained: ${gained.reduce((a, b) => a + b.issuePageGain, 0)}`);

// --------------------------------------------------------------- #11 supply

// The currency this ticket trades in is not citations, it is DISTINCT PUBLISHERS
// voting on one URL. A publisher with 1,205 citations that never lands on a URL
// anyone else cited has raised Strength exactly zero times, and is therefore
// worth less to supply than a publisher with 20 citations that overlaps.
log('\n=== #11 supply: which publishers actually raise Strength ===');
const multiSignals = signals.filter((s) => s.strength >= 2);
const votesInMulti = new Map();
const votesInS3 = new Map();
for (const s of multiSignals) {
  for (const v of s.voters) votesInMulti.set(v, (votesInMulti.get(v) || 0) + 1);
  if (s.strength >= 3) for (const v of s.voters) votesInS3.set(v, (votesInS3.get(v) || 0) + 1);
}
const rosterIds = PUBLISHERS.map((p) => p.id);
const supplyRows = rosterIds
  .map((id) => ({
    id,
    cites: citations.filter((c) => c.publisherId === id).length,
    votesS2: votesInMulti.get(id) || 0,
    votesS3: votesInS3.get(id) || 0,
    control: !!PUBLISHER_BY_ID.get(id)?.control,
  }))
  .sort((a, b) => b.votesS2 - a.votesS2 || b.cites - a.cites);
log('  publisher              cites  votes(s>=2)  votes(s>=3)  cites-per-vote');
for (const r of supplyRows) {
  const cpv = r.votesS2 ? (r.cites / r.votesS2).toFixed(1) : '—';
  log(
    `  ${r.id.padEnd(22)}${String(r.cites).padStart(5)}${String(r.votesS2).padStart(13)}${String(r.votesS3).padStart(13)}${String(cpv).padStart(16)}${r.control ? '  [control]' : ''}`
  );
}
const deadWeight = supplyRows.filter((r) => !r.control && r.votesS2 === 0);
log(`\n  publishers in the roster: ${rosterIds.length}`);
log(`  publishers that raised Strength at least once: ${supplyRows.filter((r) => r.votesS2 > 0).length}`);
log(`  publishers that raised Strength ZERO times (non-control): ${deadWeight.length}`);
log(`    ${deadWeight.map((r) => `${r.id}(${r.cites})`).join(' ')}`);
const strengthHist = new Map();
for (const s of signals) strengthHist.set(s.strength, (strengthHist.get(s.strength) || 0) + 1);
log(`  strength histogram: ${[...strengthHist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`);

// ------------------------------------------------- #11 per-day supply replay
//
// A backfill total is not a daily rate — the correction #9 made to this map's
// own Notes. #21 replayed the corpus from Citation timestamps and found 18 of
// the last 30 days carried NO eligible Signal, with a trailing-14-day median
// Brief of 1 *at every bar tested, including one low enough to admit
// everything*. That is the number this ticket is measured against, and the
// target from #9 is a trailing-14-day median of >=5.
//
// The date a Signal *becomes* eligible is not `firstSeen` — it is the moment the
// SECOND distinct non-origin Publisher cites it. Bucketing on `firstSeen` would
// credit a Signal to the day its first citation landed, which can be years
// earlier in a backfill window and is exactly the artifact that makes a
// backfill look like a rate.
function crossingDay(signal, threshold) {
  const seen = new Set();
  const ordered = signal.citations
    .filter((c) => c.at)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const c of ordered) {
    const owner = ownerOfHost(safeHostOf(c.linkUrl));
    if (owner && owner === c.publisherId) continue; // origin is not a voter
    seen.add(c.publisherId);
    if (seen.size >= threshold) return c.at.slice(0, 10);
  }
  return null;
}
function safeHostOf(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

log('\n=== #11 per-day supply replay ===');
for (const threshold of [2, 3]) {
  const byDay = new Map();
  let undated = 0;
  for (const s of signals) {
    if (s.strength < threshold) continue;
    const d = crossingDay(s, threshold);
    if (!d) {
      undated++;
      continue;
    }
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  const days = [...byDay.keys()].sort();
  const newest = days[days.length - 1];
  const span = days.length ? `${days[0]} .. ${newest}` : 'none';
  // Walk the calendar, not the keys — a day with zero Signals has no key, and
  // dropping it is what turns "18 of 30 days are empty" into a healthy median.
  const window = [];
  if (newest) {
    const end = Date.parse(`${newest}T00:00:00Z`);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end - i * 86400e3).toISOString().slice(0, 10);
      window.push({ d, n: byDay.get(d) || 0 });
    }
  }
  const last14 = window.slice(-14).map((x) => x.n).sort((a, b) => a - b);
  const median = last14.length
    ? last14.length % 2
      ? last14[(last14.length - 1) / 2]
      : (last14[last14.length / 2 - 1] + last14[last14.length / 2]) / 2
    : 0;
  const empty30 = window.filter((x) => x.n === 0).length;
  log(`  Strength >=${threshold}:`);
  log(`    signals with a datable crossing: ${signals.filter((s) => s.strength >= threshold).length - undated} (undatable: ${undated})`);
  log(`    crossing days span: ${span} over ${days.length} distinct days`);
  log(`    last 30 calendar days: ${window.map((x) => x.n).join(',')}`);
  log(`    empty days in that 30: ${empty30}   trailing-14-day MEDIAN: ${median}   (#9 target: >=5)`);
}

// ---------------------------------------------------------------- diagnostics

log('\n=== diagnostics ===');
log(`  ${JSON.stringify(notes)}`);
log(`  net: ${JSON.stringify(netStats())}`);
log(`  citations by kind: self=${citations.filter((c) => c.kind === 'self').length} outbound=${citations.filter((c) => c.kind === 'outbound').length}`);
const perPub = new Map();
for (const c of citations) perPub.set(c.publisherId, (perPub.get(c.publisherId) || 0) + 1);
log(`  citations per publisher: ${[...perPub.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`);

writeFileSync(join(import.meta.dirname, 'findings.txt'), out.join('\n'));
writeFileSync(
  join(import.meta.dirname, 'findings.json'),
  JSON.stringify(
    {
      itemCount: items.length,
      linkCount: links.size,
      citationCount: citations.length,
      signalCount: signals.length,
      canonCases: canon,
      sweep,
      ablationRows,
      clusterVerdicts: clusterVerdicts.map((c) => ({ id: c.id, name: c.name, min: c.min, verdict: c.verdict, best: c.best ? { url: c.best.links[0], strength: c.best.strength, voters: c.best.voters, origin: c.best.origin, links: c.best.links } : null })),
      controlFalsePositives,
      secondPassPairs: pairs.slice(0, 60).map((p) => ({ score: p.sc, a: titleFor(p.a), b: titleFor(p.b), aUrl: p.a.links[0], bUrl: p.b.links[0], aStrength: p.a.strength, bStrength: p.b.strength })),
      notes,
      paginationStance: PAGINATION_STANCE,
      config: DEFAULTS,
    },
    null,
    2
  )
);
console.log('\nwrote findings.txt + findings.json');
