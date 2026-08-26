// PROTOTYPE — throwaway. Zis issue #44: what does the self-citation guard key
// on when a Publisher's hosts are unregistered?
//
// Rides #6's corpus and its on-disk cache — no new network traffic. `node measure.mjs`.
//
// Four candidate keys, measured against each other on the same corpus:
//   K0  host registry            — as shipped (`hosts[]` -> ownerOfHost)
//   K1  registry completed       — every host the corpus SHOWS a Publisher
//                                  publishing on, added to its `hosts[]`
//   K2  registry + authorship    — K0, plus: a Publisher authored a member Link
//   K3  authorship only          — no registry at all
//
// "Authorship" needs no list: pass 1 of the clusterer already records a `self`
// Citation for every Item's own address, so Link -> authoring Publisher is a
// fact the corpus carries. The question is what that fact can and cannot reach.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../PROTOTYPE-clustering/cluster.mjs';
import { ingestAll } from '../PROTOTYPE-clustering/ingest.mjs';
import { safeHost } from '../PROTOTYPE-clustering/canonicalize.mjs';
import { PUBLISHERS, PUBLISHER_BY_ID, HOST_OWNER, ownerOfHost } from '../PROTOTYPE-clustering/sources.mjs';
import { NEGATIVE_CONTROL_PUBLISHERS } from '../PROTOTYPE-clustering/cases.mjs';

const out = [];
const log = (s) => {
  console.log(s);
  out.push(s);
};

const items = await ingestAll({ log: () => {} });
log(`corpus: ${items.length} items, ${PUBLISHERS.length} Publishers, ${HOST_OWNER.size} registered hosts`);

// Build the corpus once under the SHIPPED configuration (#39's row H) — that is
// the guard this ticket is auditing.
const shipped = { vehicleFromCitations: true };
const corpus = await buildCorpus(items, { log: () => {}, ...shipped });

// ===========================================================================
// PART 1 — registry completeness, measured from the corpus's own evidence
// ===========================================================================
// A Publisher's `hosts[]` is a claim. Its own Items' addresses are evidence.
// Every host a Publisher DEMONSTRABLY publishes on but is not registered as
// owning is a hole in the registry, found without asking anyone.

const publishesOn = new Map(); // publisherId -> Map(host -> count)
for (const it of items) {
  const h = safeHost(it.selfUrl || '');
  if (!h) continue;
  if (!publishesOn.has(it.publisherId)) publishesOn.set(it.publisherId, new Map());
  const m = publishesOn.get(it.publisherId);
  m.set(h, (m.get(h) || 0) + 1);
}
// Feed URLs are a second kind of evidence: a Publisher's own feed address.
const feedHosts = new Map();
for (const p of PUBLISHERS) {
  const s = new Set();
  for (const src of p.sources) if (src.url) s.add(safeHost(src.url));
  feedHosts.set(p.id, s);
}

const holes = []; // {publisherId, host, items, registered:[...]}
for (const [pid, m] of publishesOn) {
  for (const [h, n] of m) {
    if (ownerOfHost(h) === pid) continue;
    holes.push({ publisherId: pid, host: h, items: n, ownedBy: ownerOfHost(h) || null, registered: PUBLISHER_BY_ID.get(pid)?.hosts ?? [] });
  }
}
const feedHoles = [];
for (const [pid, hs] of feedHosts) {
  for (const h of hs) {
    if (!h || ownerOfHost(h) === pid) continue;
    feedHoles.push({ publisherId: pid, host: h, ownedBy: ownerOfHost(h) || null });
  }
}

log('\n=== PART 1: hosts a Publisher publishes on but is not registered as owning ===');
log(`  Publishers with at least one such host: ${new Set(holes.map((h) => h.publisherId)).size} of ${PUBLISHERS.length}`);
log(`  distinct (publisher, host) pairs: ${holes.length}`);
log('  publisher          unregistered host                 items  currently owned by');
for (const h of holes.sort((a, b) => b.items - a.items)) {
  log(`  ${h.publisherId.padEnd(18)}${h.host.padEnd(34)}${String(h.items).padStart(5)}  ${h.ownedBy ?? '(nobody)'}`);
}
log('\n  and the same test on feed addresses rather than Item addresses:');
for (const h of feedHoles) log(`  ${h.publisherId.padEnd(18)}${h.host.padEnd(34)}       ${h.ownedBy ?? '(nobody)'}`);

// How many of those holes are SHARED hosts — a host more than one Publisher
// publishes on? Those are the ones K1 cannot fix, because registering them
// hands one Publisher a host that is several Publishers' venue.
const publishersPerHost = new Map();
for (const [pid, m] of publishesOn) for (const h of m.keys()) {
  if (!publishersPerHost.has(h)) publishersPerHost.set(h, new Set());
  publishersPerHost.get(h).add(pid);
}
const shared = [...publishersPerHost.entries()].filter(([, s]) => s.size > 1);
log('\n  of those hosts, the SHARED ones (more than one Publisher publishes there):');
for (const [h, s] of shared.sort((a, b) => b[1].size - a[1].size)) {
  log(`  ${h.padEnd(34)} ${s.size} Publishers: ${[...s].sort().join(', ')}`);
}

// ===========================================================================
// PART 2 — the own-vote audit, keyed on authorship rather than on hosts
// ===========================================================================
// Link -> authoring Publisher, from the `self` Citations pass 1 already writes.
// This is the whole of the authorship key: no list, no host, nothing to keep
// up to date.

const authorOfLink = new Map(); // canonical link url -> publisherId
for (const c of corpus.citations) if (c.kind === 'self') authorOfLink.set(c.linkUrl, c.publisherId);

log('\n=== PART 2: what authorship covers ===');
log(`  Links in corpus: ${corpus.links ? corpus.links.size ?? '-' : '-'}   Links with a known author: ${authorOfLink.size}`);
const citedLinks = new Set(corpus.citations.filter((c) => c.kind === 'outbound').map((c) => c.linkUrl));
const citedAuthored = [...citedLinks].filter((u) => authorOfLink.has(u));
log(`  Links cited by someone (outbound): ${citedLinks.size}, of which authored-in-corpus: ${citedAuthored.length} (${((100 * citedAuthored.length) / citedLinks.size).toFixed(1)}%)`);

// Signal-level authorship: a Publisher is the author of a Signal if it authored
// ANY member Link. Strength is per-Signal, so "one voice" is a question about
// the story, not about a URL.
function authorsOfSignal(s) {
  const a = new Set();
  for (const u of s.links) {
    const p = authorOfLink.get(u);
    if (p) a.add(p);
  }
  return a;
}

// Every Signal where the SHIPPED guard counts a voter that authored a member
// Link. That is the failure #39 found, stated without reference to a host list.
log('\n=== PART 2b: voters that authored a member Link of the Signal they voted on ===');
const ownVotes = [];
for (const s of corpus.signals) {
  const a = authorsOfSignal(s);
  const bad = s.voters.filter((v) => a.has(v));
  if (bad.length) ownVotes.push({ s, bad, authors: [...a] });
}
log(`  Signals affected: ${ownVotes.length}   (of ${corpus.signals.length})`);
const atAdmission = ownVotes.filter((o) => o.s.strength >= 2);
log(`  of which at Strength >= 2 (i.e. reachable by a Brief): ${atAdmission.length}`);
for (const o of atAdmission.sort((x, y) => y.s.strength - x.s.strength)) {
  log(`  s=${o.s.strength} origin=${o.s.origin ?? '-'} own-voter(s)=${o.bad.join(',')}  voters=${o.s.voters.join(',')}`);
  for (const u of o.s.links) log(`     member  ${u}${authorOfLink.has(u) ? `   [authored by ${authorOfLink.get(u)}]` : ''}`);
  for (const c of o.s.citations) log(`     cite    ${c.publisherId.padEnd(16)} ${c.kind.padEnd(8)} ${c.linkUrl}`);
}

// ===========================================================================
// PART 3 — the two live cases from #39, checked against each key
// ===========================================================================
const CASES = [
  ['bsky.app transport host (Willison)', '3mr5ucqec2s24'],
  ['cloudflare.net unregistered 2nd host', 'cloudflare.net'],
];
log('\n=== PART 3: #39\'s two live cases under the shipped guard ===');
for (const [label, needle] of CASES) {
  const hits = corpus.signals.filter((s) => s.links.some((u) => u.includes(needle)));
  log(`  ${label} — ${hits.length} Signal(s) matching "${needle}"`);
  for (const s of hits) {
    const a = authorsOfSignal(s);
    log(`     s=${s.strength} origin=${s.origin ?? '-'} voters=${s.voters.join(',')} authors-in-corpus=${[...a].join(',') || '(none)'}`);
    for (const u of s.links) log(`       member ${u}`);
    for (const c of s.citations) log(`       cite   ${c.publisherId.padEnd(16)} ${c.kind.padEnd(8)} ${c.linkUrl}`);
  }
}

// ===========================================================================
// PART 4 — the four keys, re-scored over the same Signals
// ===========================================================================
// Strength is recomputed from each Signal's Citations under each key, so the
// clustering is held constant and only the guard moves.

const completedRegistry = new Map(HOST_OWNER); // K1
for (const h of holes) if (!completedRegistry.has(h.host)) completedRegistry.set(h.host, h.publisherId);

function ownerIn(map, host) {
  if (!host) return null;
  if (map.has(host)) return map.get(host);
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const cand = parts.slice(i).join('.');
    if (map.has(cand)) return map.get(cand);
  }
  return null;
}

// The TARGET of a Signal is its union-find root. Both directional alias rules
// merge INTO the thing: `merge(target, thread)` and `merge(into, self)`, so the
// surviving root is the story and every tombstone is a vehicle pointing at it.
const targetOf = (s) => s.id;

const KEYS = {
  // per-Citation scope (as shipped): a Publisher can be BOTH origin and voter
  // on one Signal, because the test is applied to each Citation separately.
  'K0 host registry (shipped)': { scope: 'citation', own: (s, c) => ownerIn(HOST_OWNER, safeHost(c.linkUrl)) === c.publisherId },
  'K1 registry completed': { scope: 'citation', own: (s, c) => ownerIn(completedRegistry, safeHost(c.linkUrl)) === c.publisherId },
  'K2 registry + member authorship': { scope: 'citation', own: (s, c) => ownerIn(HOST_OWNER, safeHost(c.linkUrl)) === c.publisherId || authorsOfSignal(s).has(c.publisherId) },
  'K3 member authorship only': { scope: 'citation', own: (s, c) => authorsOfSignal(s).has(c.publisherId) },
  // per-Publisher scope, keyed on the TARGET rather than on the Citation: a
  // Publisher that owns or authored the story does not vote on it at all.
  'K4 target, registry only': { scope: 'publisher', ownsTarget: (s, p) => ownerIn(HOST_OWNER, safeHost(targetOf(s))) === p },
  'K5 target, registry + authorship': { scope: 'publisher', ownsTarget: (s, p) => ownerIn(HOST_OWNER, safeHost(targetOf(s))) === p || authorOfLink.get(targetOf(s)) === p },
  'K6 target, completed + authorship': { scope: 'publisher', ownsTarget: (s, p) => ownerIn(completedRegistry, safeHost(targetOf(s))) === p || authorOfLink.get(targetOf(s)) === p },
};

function rescore(key) {
  const rows = corpus.signals.map((s) => {
    const votes = new Map();
    let origin = null;
    if (key.scope === 'publisher') {
      for (const c of s.citations) {
        const own = key.ownsTarget(s, c.publisherId);
        if (own) origin = c.publisherId;
        const v = votes.get(c.publisherId) || { vote: false, origin: false };
        if (own) v.origin = true;
        else v.vote = true;
        votes.set(c.publisherId, v);
      }
      // per-Publisher: owning the target disqualifies the Publisher entirely,
      // not just the Citation that happened to land on its own host.
      for (const [p, v] of votes) if (key.ownsTarget(s, p)) v.vote = false;
    } else {
      for (const c of s.citations) {
        const own = key.own(s, c);
        if (own) origin = c.publisherId;
        const v = votes.get(c.publisherId) || { vote: false, origin: false };
        if (own) v.origin = true;
        else v.vote = true;
        votes.set(c.publisherId, v);
      }
    }
    const voters = [...votes.entries()].filter(([, v]) => v.vote).map(([p]) => p).sort();
    return { id: s.id, links: s.links, citations: s.citations, strength: voters.length, voters, origin };
  });
  return rows;
}

function controlFPs(rows) {
  const detail = [];
  for (const pid of NEGATIVE_CONTROL_PUBLISHERS) {
    const own = PUBLISHER_BY_ID.get(pid)?.hosts || [];
    for (const s of rows) {
      if (s.strength >= 2 && s.links.some((u) => own.some((h) => u.includes(h)))) detail.push(`${pid} s=${s.strength} ${s.links[0]}`);
    }
  }
  return detail;
}

const scored = {};
log('\n=== PART 4: the four keys ===');
log('  key                            s>=2  s>=3  max  own-votes-left  control-FPs');
for (const [name, fn] of Object.entries(KEYS)) {
  const rows = rescore(fn);
  scored[name] = rows;
  const left = rows.filter((s) => s.voters.some((v) => authorsOfSignal(s).has(v))).length;
  const fps = controlFPs(rows);
  log(
    `  ${name.padEnd(30)}${String(rows.filter((s) => s.strength >= 2).length).padStart(5)}${String(rows.filter((s) => s.strength >= 3).length).padStart(6)}${String(Math.max(0, ...rows.map((s) => s.strength))).padStart(5)}${String(left).padStart(16)}${String(fps.length).padStart(13)}`
  );
  for (const d of fps) log(`        FP  ${d}`);
}

// The supply ledger, labelling-artifact-free (#39's method note: a count is not
// a ledger; compare the MULTISET of admitted voter-sets).
const bag = (rows) => {
  const m = new Map();
  for (const s of rows.filter((x) => x.strength >= 2)) {
    const k = `${s.strength}|${s.voters.join(',')}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};
const base = bag(scored['K0 host registry (shipped)']);
log('\n=== PART 4b: admitted voter-sets vs the shipped key ===');
for (const [name, rows] of Object.entries(scored)) {
  if (name.startsWith('K0')) continue;
  const b = bag(rows);
  const add = [];
  const rm = [];
  for (const [k, n] of b) if (n > (base.get(k) || 0)) add.push(`${k} x${n - (base.get(k) || 0)}`);
  for (const [k, n] of base) if (n > (b.get(k) || 0)) rm.push(`${k} x${n - (b.get(k) || 0)}`);
  log(`  ${name}`);
  log(`     + ${add.join('   ') || '(none)'}`);
  log(`     - ${rm.join('   ') || '(none)'}`);
}

// Which Signals actually change, so each change can be hand-classified.
log('\n=== PART 4c: every Signal whose Strength moves, per key ===');
const k0 = new Map(scored['K0 host registry (shipped)'].map((s) => [s.id, s]));
for (const [name, rows] of Object.entries(scored)) {
  if (name.startsWith('K0')) continue;
  const moved = rows.filter((s) => k0.get(s.id) && k0.get(s.id).strength !== s.strength);
  const movedAtAdmission = moved.filter((s) => Math.max(s.strength, k0.get(s.id).strength) >= 2);
  log(`  ${name}: ${moved.length} Signals move, ${movedAtAdmission.length} of them at or above Strength 2`);
  for (const s of movedAtAdmission) {
    const b = k0.get(s.id);
    log(`     ${b.strength} -> ${s.strength}   [${b.voters.join(',')}] -> [${s.voters.join(',')}]`);
    log(`        target ${targetOf(s)}   [host owned by ${ownerIn(HOST_OWNER, safeHost(targetOf(s))) ?? '(nobody)'}, authored by ${authorOfLink.get(targetOf(s)) ?? '(not ingested)'}]`);
    for (const u of s.links) log(`        member ${u}${authorOfLink.has(u) ? `  [authored by ${authorOfLink.get(u)}]` : ''}`);
  }
}

// ===========================================================================
// PART 5 — the registry's SECOND consumer: citation-worthiness (§3)
// ===========================================================================
// `dropIntraPublisherLinks` keys on the same registry, so a hole there is a
// second silent failure: a Publisher's navigation link to its own unregistered
// host survives as a Citation and can create a Link nobody else would have.

log('\n=== PART 5: the registry\'s second consumer — intra-publisher drops (§3) ===');
log(`  drops under the shipped registry: ${corpus.notes.intraPublisherDropped}`);
let wouldDropMore = 0;
const extra = [];
for (const c of corpus.citations) {
  if (c.kind !== 'outbound') continue;
  const h = safeHost(c.linkUrl);
  if (ownerIn(HOST_OWNER, h) === c.publisherId) continue;
  if (ownerIn(completedRegistry, h) === c.publisherId) {
    wouldDropMore++;
    extra.push(`${c.publisherId.padEnd(16)} ${c.linkUrl}`);
  }
}
log(`  additional drops a COMPLETED registry would make: ${wouldDropMore}`);
for (const e of extra.slice(0, 40)) log(`     ${e}`);
if (extra.length > 40) log(`     … and ${extra.length - 40} more`);
let authorshipDrops = 0;
for (const c of corpus.citations) {
  if (c.kind !== 'outbound') continue;
  if (ownerIn(HOST_OWNER, safeHost(c.linkUrl)) === c.publisherId) continue;
  if (authorOfLink.get(c.linkUrl) === c.publisherId) authorshipDrops++;
}
log(`  additional drops AUTHORSHIP alone would make (link-level, not signal-level): ${authorshipDrops}`);

writeFileSync(join(import.meta.dirname, 'findings.txt'), out.join('\n'));
writeFileSync(
  join(import.meta.dirname, 'findings.json'),
  JSON.stringify(
    {
      registeredHosts: HOST_OWNER.size,
      publishers: PUBLISHERS.length,
      holes,
      feedHoles,
      sharedHosts: shared.map(([h, s]) => ({ host: h, publishers: [...s].sort() })),
      authorship: { authoredLinks: authorOfLink.size, citedLinks: citedLinks.size, citedAndAuthored: citedAuthored.length },
      ownVotes: ownVotes.map((o) => ({ id: o.s.id, strength: o.s.strength, voters: o.s.voters, ownVoters: o.bad, authors: o.authors, links: o.s.links })),
      keys: Object.fromEntries(
        Object.entries(scored).map(([name, rows]) => [
          name,
          {
            s2: rows.filter((s) => s.strength >= 2).length,
            s3: rows.filter((s) => s.strength >= 3).length,
            controlFPs: controlFPs(rows),
          },
        ])
      ),
      secondConsumer: { shippedDrops: corpus.notes.intraPublisherDropped, completedRegistryExtraDrops: wouldDropMore, authorshipExtraDrops: authorshipDrops },
    },
    null,
    2
  )
);
console.log('\nwrote findings.txt + findings.json');
