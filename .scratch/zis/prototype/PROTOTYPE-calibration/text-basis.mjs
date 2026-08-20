// PROTOTYPE — throwaway. Zis issue #21.
//
// `text_basis` (ranking-model.md §4) — which text a Signal is embedded from, and
// which rung that was. This file is the whole reason `T+` is keyed by rung: the
// three rungs differ by an order of magnitude in length, and cosine similarity
// is not portable across lengths.

import { VEHICLE_TRANSPORTS } from '../PROTOTYPE-clustering/cluster.mjs';
import { EXCERPT_AGGREGATORS as AGGREGATORS } from './ingest-text.mjs';

const CAP = 1200;
const MAX_CITING_TITLES = 8;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * A vehicle Item is a post that exists to point at one URL — an HN thread, a
 * Bluesky post with a single link. #6 merges these INTO their target, so after
 * the merge the vehicle's own Link sits inside the target's Signal and its
 * `self` Citation looks exactly like the story's own Item.
 *
 * It is not. The `own` rung means "this Signal's own text", and an HN thread is
 * a discussion OF the story, not the story. Counting it as `own` would hand a
 * long, on-topic-by-construction text to precisely the Signals that #6 measured
 * as having no ingested text at all — inflating the `own` rung's population and
 * emptying `citing` of its most common member.
 *
 * The guard is the same "exactly one target" test the merge rule itself uses: a
 * vehicle-transport Item with no outbound link is not a vehicle (Ask HN / Show
 * HN — the thread IS the thing), so it keeps its `own` rung.
 */
function isVehicle(item) {
  return VEHICLE_TRANSPORTS.has(item.transport) && (item.outbound || []).length > 0;
}

/**
 * One description of the story, chosen rather than concatenated.
 *
 * Order of preference:
 *   1. the longest anchor text any citing Publisher gave this exact URL —
 *      longest, because "Learning more about Claude's mathematical
 *      capabilities" beats "the spec" and "announced";
 *   2. the title of a citing Item from a Publisher that is NOT an excerpt
 *      newsletter — an HN submission title or a Bluesky post's text is a
 *      description of the link, an issue title is not;
 *   3. any citing title, as the floor.
 */
function pickBest(anchors, titles, visible, items) {
  const byLen = [...anchors].sort((a, b) => b.length - a.length);
  if (byLen.length) return byLen[0].slice(0, CAP);

  const nonAggregator = visible
    .filter((c) => c.kind === 'outbound')
    .map((c) => items[c.itemIdx])
    .filter((it) => it && !AGGREGATORS.has(it.publisherId) && clean(it.title))
    .map((it) => clean(it.title))
    .sort((a, b) => b.length - a.length);
  if (nonAggregator.length) return nonAggregator[0].slice(0, CAP);

  return (titles[0] || '').slice(0, CAP);
}

/** The Link a reader would call "the story" — never the vehicle that cites it. */
export function primaryLink(signal) {
  const counts = new Map();
  for (const c of signal.citations) counts.set(c.linkUrl, (counts.get(c.linkUrl) || 0) + 1);
  const scored = signal.links
    .map((u) => {
      let host = '';
      try {
        host = new URL(u).hostname.replace(/^www\./, '');
      } catch {}
      const vehicleHost = host === 'news.ycombinator.com' || host === 'bsky.app';
      return { u, host, vehicleHost, cites: counts.get(u) || 0 };
    })
    .sort((a, b) => Number(a.vehicleHost) - Number(b.vehicleHost) || b.cites - a.cites || a.u.length - b.u.length);
  return scored[0]?.u || signal.links[0] || signal.id;
}

/** The `slug` rung: the canonical URL's path, tokenised. */
export function slugText(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return clean(url);
  }
  const host = u.hostname.replace(/^www\./, '');
  const path = decodeURIComponent(u.pathname || '')
    .replace(/\.(html?|php|aspx?|md)$/i, '')
    .split(/[/\-_.]+/)
    .filter(Boolean)
    // A date path segment is not a word. `/2026/08/12/` tells a reader nothing
    // and drags every slug in the corpus toward the same vector.
    .filter((t) => !/^\d{1,4}$/.test(t))
    .filter((t) => !/^[0-9a-f]{8,}$/i.test(t));
  const hostWords = host.split('.').filter((t) => t !== 'com' && t !== 'org' && t !== 'net' && t !== 'io' && t !== 'dev' && t !== 'co');
  // Host words carry real signal on the slug rung and nowhere else: for a Link
  // Zis never fetched and nobody titled, `anthropic` + `research` + `riemann`
  // + `zeta` is the entire text there is.
  return clean([...hostWords, ...path].join(' ')).slice(0, CAP);
}

/**
 * Which rung a Signal sits on, and the text it embeds, using only Citations at
 * or before `cutMs`. Passing `Infinity` gives the corpus's final state.
 */
export function textBasisOf(signal, items, cutMs = Infinity) {
  const at = (c) => (c.at ? Date.parse(c.at) : NaN);
  const visible = signal.citations.filter((c) => {
    const t = at(c);
    return Number.isNaN(t) ? cutMs === Infinity : t <= cutMs;
  });

  // rung 1 — `own`: the ingested Item's title + extracted summary.
  const ownItems = visible
    .filter((c) => c.kind === 'self')
    .map((c) => items[c.itemIdx])
    .filter((it) => it && !isVehicle(it) && clean(it.title));
  if (ownItems.length) {
    // Several Items can be `self` in one Signal after an alias merge (a renamed
    // repo, an announcement bridged to its release tag). Longest text wins —
    // it is the one closest to what the reader would read.
    const best = ownItems.sort((a, b) => (b.text || '').length - (a.text || '').length)[0];
    const text = clean(`${best.title}. ${best.text || ''}`).slice(0, CAP);
    return { basis: 'own', text, textTitlesOnly: text, anchorCount: 0, publisherId: best.publisherId };
  }

  // rung 2 — `citing`. Two candidate texts, measured against each other:
  //   titles  — ranking-model.md §4 as written: "the concatenated titles of the
  //             Items citing it".
  //   anchors — what the citing Publisher actually called THIS link.
  // They diverge hardest on newsletters, whose Item title describes an issue
  // rather than any one story in it.
  const titles = [];
  const anchors = [];
  const seenT = new Set();
  const seenA = new Set();
  for (const c of visible) {
    if (c.kind !== 'outbound') continue;
    const it = items[c.itemIdx];
    if (!it) continue;

    const t = clean(it.title);
    if (t && !seenT.has(t.toLowerCase()) && titles.length < MAX_CITING_TITLES) {
      seenT.add(t.toLowerCase());
      titles.push(t);
    }

    const a = clean(it.anchors?.[c.rawUrl]);
    if (a && !seenA.has(a.toLowerCase()) && anchors.length < MAX_CITING_TITLES) {
      seenA.add(a.toLowerCase());
      anchors.push(a);
    }
  }
  if (titles.length || anchors.length) {
    // MEASURED, not chosen: concatenating every description of one story is
    // itself the noise. On the eligible set, the single most specific anchor
    // text is the only variant that produces a defensible argmax Interest —
    // and the concatenated form scores HIGHER while being about the wrong
    // subject, so a bar on REL+ over concatenated text selects for pollution.
    const best = pickBest(anchors, titles, visible, items);
    return {
      basis: 'citing',
      text: best,
      // §4 exactly as currently written, kept so the comparison is measurable
      // rather than asserted.
      textTitlesOnly: titles.join('. ').slice(0, CAP),
      anchorCount: anchors.length,
      publisherId: null,
    };
  }

  // rung 3 — `slug`.
  const url = primaryLink(signal);
  const t = slugText(url);
  return { basis: 'slug', text: t, textTitlesOnly: t, anchorCount: 0, publisherId: null };
}
