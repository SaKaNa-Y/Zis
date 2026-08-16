// PROTOTYPE — throwaway. Zis issue #6, part 2: cluster formation.
//
// Follows ADR-0002 literally: a Signal is created EAGERLY, 1:1 with every Link.
// The clusterer never creates a Signal, it only ever MERGES two that exist.
// Merges leave tombstones (the union-find parent chain here) so every read path
// can resolve an old id.
//
// Every merge edge below is deterministic and replayable — #14 made
// reproducibility a correctness property, so nothing here may consult an LLM,
// a random number, or wall-clock time outside the frozen `now` passed in.

import {
  canonicalizeSync, unwrapRedirects, publisherCanonical, safeHost,
  SHORTENER_HOSTS, isPubliclyRoutable,
} from './canonicalize.mjs';
import { fetchWithPolicy } from './net.mjs';
import { ownerOfHost, PUBLISHER_BY_ID } from './sources.mjs';

export const DEFAULTS = {
  // Cluster-formation window: two citations this far apart still join.
  mergeWindowHours: 72,
  // A Signal stops accepting merges this long after first sight. ADR-0002's
  // "temporal decay" expressed as a lifecycle state, not a score.
  closeAfterHours: 72,
  // Ranking decay half-life.
  halfLifeHours: 36,
  // Network layers are opt-in so the pure cascade can be measured alone.
  resolveShorteners: true,
  resolveHnDiscussions: true,
  resolveGithubRenames: true,
  publisherCanonicalMinCites: 2,
  releaseBridge: true,
  mergeSingleCitationVehicles: true,
  // Citation-worthiness. Both found necessary on real data, both ablatable.
  dropReferenceOnly: true,
  dropIntraPublisherLinks: true,
};

// ---------------------------------------------------------------- union-find

class Signals {
  constructor() {
    this.parent = new Map();
    this.mergeLog = [];
  }
  add(id) {
    if (!this.parent.has(id)) this.parent.set(id, id);
    return id;
  }
  find(id) {
    this.add(id);
    let r = id;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(id) !== r) {
      const n = this.parent.get(id);
      this.parent.set(id, r);
      id = n;
    }
    return r;
  }
  merge(a, b, rule, closedCheck) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    if (closedCheck && !closedCheck(ra, rb)) {
      this.mergeLog.push({ a: ra, b: rb, rule, refused: 'closed-or-out-of-window' });
      return false;
    }
    this.parent.set(rb, ra); // rb is now a tombstone pointing at ra
    this.mergeLog.push({ a: ra, b: rb, rule });
    return true;
  }
  groups() {
    const g = new Map();
    for (const id of this.parent.keys()) {
      const r = this.find(id);
      if (!g.has(r)) g.set(r, []);
      g.get(r).push(id);
    }
    return g;
  }
}

// ----------------------------------------------------------------- the build

export async function buildCorpus(items, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const log = opts.log || (() => {});
  const now = opts.now ?? Date.now();

  const links = new Map(); // canonical url -> {url, host, firstSeen, lastSeen}
  const citations = []; // {itemIdx, publisherId, linkUrl, kind, rawUrl, at}
  const notes = { shortenerHops: 0, shortenerExhausted: 0, ssrfRejects: 0, canonicalHeader: 0, canonicalTag: 0, canonicalCrossSite: 0, ghRenames: 0, hnResolved: 0, releaseBridges: 0, droppedNonHttp: 0, referenceDropped: 0, intraPublisherDropped: 0, vehicleMerges: 0 };

  const touchLink = (url, at) => {
    let l = links.get(url);
    if (!l) {
      l = { url, host: safeHost(url), firstSeen: at, lastSeen: at, citeCount: 0 };
      links.set(url, l);
    }
    if (at) {
      if (!l.firstSeen || at < l.firstSeen) l.firstSeen = at;
      if (!l.lastSeen || at > l.lastSeen) l.lastSeen = at;
    }
    l.citeCount++;
    return l;
  };

  // --- pass 1: canonicalize every raw address into a Link, record Citations --
  const rawToCanonical = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const at = it.publishedAt || null;
    const pairs = [];
    if (it.selfUrl) pairs.push([it.selfUrl, 'self']);
    for (const o of it.outbound || []) pairs.push([o, 'outbound']);

    for (const [raw, kind] of pairs) {
      let c = rawToCanonical.get(raw);
      if (c === undefined) {
        const n = canonicalizeSync(raw, { baseUrl: it.selfUrl || undefined });
        c = n?.url ?? null;
        if (c && !isPubliclyRoutable(c)) {
          notes.ssrfRejects++;
          c = null;
        }
        if (!c) notes.droppedNonHttp++;
        rawToCanonical.set(raw, c);
      }
      if (!c) continue;
      if (isBoilerplate(c)) continue;
      if (kind === 'outbound' && cfg.dropReferenceOnly && isReferenceOnly(c)) {
        notes.referenceDropped++;
        continue;
      }
      // An outbound link to a host this same Publisher owns is internal
      // navigation ("see our other post"), not a citation of someone else's
      // story. Release notes and changelogs are ~entirely this.
      if (kind === 'outbound' && cfg.dropIntraPublisherLinks && ownerOfHost(safeHost(c)) === it.publisherId) {
        notes.intraPublisherDropped++;
        continue;
      }
      touchLink(c, at);
      citations.push({ itemIdx: i, publisherId: it.publisherId, linkUrl: c, kind, rawUrl: raw, at, transport: it.transport });
    }
  }
  log(`  links after pure cascade: ${links.size} (citations ${citations.length})`);

  // --- pass 2: L4 shortener unwrap (network, bounded, re-validated per hop) --
  if (cfg.resolveShorteners) {
    const shorts = [...links.keys()].filter((u) => SHORTENER_HOSTS.has(safeHost(u) || ''));
    for (const s of shorts) {
      const r = await unwrapRedirects(s, { log: () => notes.ssrfRejects++ });
      if (r.exhausted) notes.shortenerExhausted++;
      if (r.url !== s) {
        notes.shortenerHops += r.chain.length - 1;
        remapLink(links, citations, s, r.url, touchLink);
      }
    }
    log(`  shorteners: ${shorts.length} found, ${notes.shortenerHops} hops, ${notes.shortenerExhausted} hit the 3-hop wall`);
  }

  // --- pass 3: GitHub owner renames (an alias, resolved into ONE Link) -------
  if (cfg.resolveGithubRenames) {
    const repos = new Map(); // "o/r" -> canonical "o/r"
    for (const u of [...links.keys()]) {
      if (safeHost(u) !== 'github.com') continue;
      const p = new URL(u).pathname.split('/').filter(Boolean);
      if (p.length < 2) continue;
      const slug = `${p[0]}/${p[1]}`;
      if (repos.has(slug)) continue;
      const res = await fetchWithPolicy(`https://api.github.com/repos/${slug}`, { accept: 'application/vnd.github+json' });
      let full = slug;
      if (res.ok) {
        try {
          full = JSON.parse(res.body).full_name || slug;
        } catch {}
      }
      repos.set(slug, full.toLowerCase());
    }
    for (const u of [...links.keys()]) {
      if (safeHost(u) !== 'github.com') continue;
      const url = new URL(u);
      const p = url.pathname.split('/').filter(Boolean);
      if (p.length < 2) continue;
      const slug = `${p[0]}/${p[1]}`;
      const full = repos.get(slug);
      if (!full || full === slug) continue;
      const [no, nr] = full.split('/');
      p[0] = no;
      p[1] = nr;
      url.pathname = '/' + p.join('/');
      notes.ghRenames++;
      remapLink(links, citations, u, url.href, touchLink);
    }
    log(`  github renames resolved: ${notes.ghRenames} links rewritten`);
  }

  // --- pass 4: publisher-declared canonical, gated on citation count --------
  if (cfg.publisherCanonicalMinCites > 0) {
    const candidates = [...links.values()]
      .filter((l) => l.citeCount >= cfg.publisherCanonicalMinCites)
      .filter((l) => l.host !== 'news.ycombinator.com' && l.host !== 'bsky.app' && l.host !== 'github.com')
      .sort((a, b) => b.citeCount - a.citeCount)
      .slice(0, 120);
    for (const l of candidates) {
      const r = await publisherCanonical(l.url);
      if (r.rejected) notes.canonicalCrossSite++;
      if (r.via && r.url !== l.url) {
        if (r.via === 'http-header') notes.canonicalHeader++;
        else notes.canonicalTag++;
        remapLink(links, citations, l.url, r.url, touchLink);
      }
    }
    log(`  rel=canonical: ${notes.canonicalHeader} via header, ${notes.canonicalTag} via <link>, ${notes.canonicalCrossSite} cross-site rejected`);
  }

  // --- Signals, created eagerly 1:1 with Links (ADR-0002) -------------------
  const sig = new Signals();
  for (const u of links.keys()) sig.add(u);

  const linkAt = (u) => links.get(u)?.firstSeen || null;
  const withinWindow = (a, b) => {
    const ta = Date.parse(linkAt(a) || '');
    const tb = Date.parse(linkAt(b) || '');
    if (Number.isNaN(ta) || Number.isNaN(tb)) return true; // undated: don't block
    return Math.abs(ta - tb) <= cfg.mergeWindowHours * 3600e3;
  };
  const notClosed = (a, b) => {
    for (const r of [a, b]) {
      const t = Date.parse(linkAt(r) || '');
      if (!Number.isNaN(t) && now - t > cfg.closeAfterHours * 3600e3) return false;
    }
    return withinWindow(a, b);
  };

  // FOUND ON REAL DATA: gating alias merges on the temporal window was wrong,
  // and it was costing 160 merges on one day's corpus. Two kinds of merge look
  // identical in code and are completely different claims:
  //
  //   ALIAS   — "these two Links are the same address" (HN thread and its
  //             target, a post and the sole article it exists to point at, a
  //             renamed repo). An identity claim does not expire, so it must
  //             NEVER be refused for being old. `alwaysAllow`.
  //   ACCRUAL — "this new citation joins that existing story". This is what
  //             temporal decay is for, and what ADR-0002's "this Signal no
  //             longer accepts merges" means. `notClosed`.
  const alwaysAllow = null;

  // Merge rule A — an HN thread is a DISCUSSION OF a URL, not the URL.
  // The submitted URL and the thread must land in one Signal.
  const hnTargets = new Map(); // storyId -> canonical target link
  if (cfg.resolveHnDiscussions) {
    for (const it of items) {
      if (it.transport !== 'hn' || !it.hnSubmittedUrl || !it.selfUrl) continue;
      const thread = rawToCanonical.get(it.selfUrl);
      const target = rawToCanonical.get(it.hnSubmittedUrl);
      if (!thread || !target) continue;
      const t = resolveRemap(links, target);
      hnTargets.set(String(it.hnStoryId), t);
      if (links.has(thread) && links.has(t)) sig.merge(t, thread, 'hn-thread->target', alwaysAllow);
    }
    // The other direction: someone ELSE cites news.ycombinator.com/item?id=N.
    for (const l of [...links.keys()]) {
      if (safeHost(l) !== 'news.ycombinator.com') continue;
      const id = new URL(l).searchParams.get('id');
      if (!id) continue;
      let target = hnTargets.get(id);
      if (!target) {
        const res = await fetchWithPolicy(`https://hn.algolia.com/api/v1/items/${id}`);
        if (res.ok) {
          try {
            const j = JSON.parse(res.body);
            if (j.url) {
              const c = canonicalizeSync(j.url);
              if (c) target = resolveRemap(links, c.url);
            }
          } catch {}
        }
      }
      if (!target) continue; // Ask HN / Show HN text post: the thread IS the thing
      if (!links.has(target)) touchLink(target, links.get(l)?.firstSeen || null);
      notes.hnResolved++;
      sig.merge(target, l, 'hn-item-cited-by-other', alwaysAllow);
    }
    log(`  HN discussion links resolved to their targets: ${notes.hnResolved}`);
  }

  // Merge rule A2 — the HN rule, generalized.
  //
  // FOUND ON REAL DATA: the HN-thread-is-a-discussion-of insight is not special
  // to HN. A Bluesky post that exists to link one article is the same shape, and
  // leaving its self Link as its own Signal means every such post competes for a
  // Brief slot against the article it is pointing at. On this corpus that is
  // where most of the 5k singleton Signals come from.
  //
  // The rule needs the "exactly one" guard: a post citing three URLs is a
  // roundup and genuinely is its own item, so merging it into any one target
  // would be a false merge.
  if (cfg.mergeSingleCitationVehicles) {
    for (const it of items) {
      if (!VEHICLE_TRANSPORTS.has(it.transport)) continue;
      if (it.transport === 'hn') continue; // rule A already handled these
      if (!it.selfUrl) continue;
      const self = resolveRemap(links, rawToCanonical.get(it.selfUrl) || '');
      const targets = [
        ...new Set(
          (it.outbound || [])
            .map((o) => rawToCanonical.get(o))
            .filter(Boolean)
            .map((u) => resolveRemap(links, u))
            .filter((u) => links.has(u) && u !== self)
        ),
      ];
      if (targets.length !== 1) continue;
      if (!links.has(self)) continue;
      if (sig.merge(targets[0], self, 'vehicle-post->sole-target', alwaysAllow)) notes.vehicleMerges++;
    }
    log(`  single-citation vehicle posts folded into their target: ${notes.vehicleMerges}`);
  }

  // Merge rule B — the release/announcement alias, REVERSED.
  //
  // The ticket proposed "does a release exist for this event?" as the
  // discriminator, and read the GitHub release BODY looking for a declared
  // announcement URL. That found 0 matches on real data, because release notes
  // do not link the blog post — THE BLOG POST LINKS THE RELEASE.
  //
  // So the declaration runs the other way, and it is still publisher-declared
  // rather than inferred from co-occurrence:
  //
  //   framework release -> an announcement Item cites `…/releases/tag/T`, so the
  //                        tag and the announcement are one event. Join them.
  //   trending breakout -> no release tag is cited anywhere, so the repo root
  //                        stands alone as the canonical thing. No bridge.
  //
  // "Cites a release TAG" IS the discriminator, and it gives the two cases the
  // opposite answers they wanted: a repo-root citation never bridges.
  if (cfg.releaseBridge) {
    for (const it of items) {
      // Only an announcement can declare the bridge. A GitHub release Item
      // citing its own tag is just self-citation.
      if (it.transport === 'github-releases') continue;
      if (!it.selfUrl) continue;
      const self = resolveRemap(links, rawToCanonical.get(it.selfUrl) || '');
      if (!links.has(self)) continue;
      const tags = [
        ...new Set(
          (it.outbound || [])
            .map((o) => rawToCanonical.get(o))
            .filter((u) => u && /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\//.test(u))
            .map((u) => resolveRemap(links, u))
            .filter((u) => links.has(u))
        ),
      ];
      // Same guard as the vehicle rule: an Item citing several release tags is a
      // roundup ("this week in releases"), not one event.
      if (tags.length !== 1) continue;
      if (sig.merge(self, tags[0], 'announcement->cited-release-tag', alwaysAllow)) notes.releaseBridges++;
    }
    log(`  release/announcement bridges (reversed rule): ${notes.releaseBridges}`);
  }

  // ---------------------------------------------------- strength & provenance
  const groups = sig.groups();
  const byRoot = new Map();
  for (const [root, members] of groups) byRoot.set(root, { root, links: members, citations: [] });
  for (const c of citations) {
    const cur = resolveRemap(links, c.linkUrl);
    const root = sig.find(cur);
    const g = byRoot.get(root);
    if (g) g.citations.push({ ...c, linkUrl: cur });
  }

  const signals = [];
  for (const g of byRoot.values()) {
    const votes = new Map(); // publisherId -> {vote:bool, cites:n}
    let origin = null;
    for (const c of g.citations) {
      const owner = ownerOfHost(safeHost(c.linkUrl));
      // SELF-CITATION GUARD. A publisher citing its own address is provenance
      // (it is the origin), not an independent voice agreeing.
      const isOwn = owner && owner === c.publisherId;
      if (isOwn) origin = c.publisherId;
      const v = votes.get(c.publisherId) || { vote: false, cites: 0, origin: false };
      v.cites++;
      if (isOwn) v.origin = true;
      else v.vote = true;
      votes.set(c.publisherId, v);
    }
    // BURST SUPPRESSION, structural: Strength counts distinct Publishers, so N
    // posts from one voice is 1. Origin is excluded from the count entirely.
    const voters = [...votes.entries()].filter(([, v]) => v.vote).map(([p]) => p);
    const strength = voters.length;
    const firstSeen = g.citations.reduce((a, c) => (c.at && (!a || c.at < a) ? c.at : a), null);
    const lastSeen = g.citations.reduce((a, c) => (c.at && (!a || c.at > a) ? c.at : a), null);
    const ageH = firstSeen ? (now - Date.parse(firstSeen)) / 3600e3 : null;
    signals.push({
      id: g.root,
      links: g.links,
      citations: g.citations,
      strength,
      // The research doc's target counts ("Cited by: react.dev (origin) · React
      // Status · …") INCLUDE the origin. CONTEXT.md's Strength does not. Both
      // are reported so the C1..C10 comparison is apples-to-apples.
      strengthWithOrigin: strength + (origin && !voters.includes(origin) ? 1 : 0),
      voters,
      origin,
      totalCitations: g.citations.length,
      distinctSources: new Set(g.citations.map((c) => c.sourceKey ?? c.transport + ':' + c.publisherId)).size,
      firstSeen,
      lastSeen,
      ageHours: ageH,
      closed: ageH != null && ageH > cfg.closeAfterHours,
      decay: ageH == null ? 1 : Math.pow(0.5, ageH / cfg.halfLifeHours),
      get score() {
        return this.strength * this.decay;
      },
    });
  }
  signals.sort((a, b) => b.strength - a.strength || b.decay - a.decay);
  return { links, citations, signals, sig, notes, cfg, items };
}

// A remap is a canonicalization correction: the OLD url is not a separate Link,
// it never existed. (Distinct from a merge, which keeps both Links.)
function remapLink(links, citations, from, to, touchLink) {
  const old = links.get(from);
  links.set('__remap__' + from, { remapTo: to });
  if (!links.has(to)) touchLink(to, old?.firstSeen || null);
  const t = links.get(to);
  if (old) {
    t.citeCount += old.citeCount - 1;
    if (old.firstSeen && (!t.firstSeen || old.firstSeen < t.firstSeen)) t.firstSeen = old.firstSeen;
    if (old.lastSeen && (!t.lastSeen || old.lastSeen > t.lastSeen)) t.lastSeen = old.lastSeen;
  }
  links.delete(from);
  for (const c of citations) if (c.linkUrl === from) c.linkUrl = to;
}

function resolveRemap(links, url) {
  let u = url;
  for (let i = 0; i < 5; i++) {
    const r = links.get('__remap__' + u);
    if (!r) break;
    u = r.remapTo;
  }
  return u;
}

// A REFERENCE is not a CITATION.
//
// FOUND ON REAL DATA: the biggest false-positive class by far. `nodejs.org/api/
// packages.html` reached strength 3 (TypeScript + Svelte + Julia Evans) because
// three unrelated posts each linked the Node docs in passing. Same shape for
// MDN, specs, caniuse, npm package pages, and GitHub PR/issue/commit links
// inside release notes. These are *supporting references* — a reader citing the
// docs is not a voice saying "this is the story today".
//
// This is the layer the ticket's plan didn't have and the corpus insists on:
// citation-worthiness, applied BEFORE strength is counted.
const REFERENCE_ONLY = [
  /^https:\/\/developer\.mozilla\.org\//i,
  /^https:\/\/(www\.)?(w3\.org|whatwg\.org|rfc-editor\.org|ietf\.org|unicode\.org|khronos\.org)\//i,
  /^https:\/\/(www\.)?caniuse\.com\//i,
  /^https:\/\/([a-z]{2}\.)?wikipedia\.org\//i,
  /^https:\/\/(www\.)?npmjs\.com\/package\//i,
  /^https:\/\/(www\.)?stackoverflow\.com\/questions\//i,
  /^https:\/\/(bugs|bugzilla|bugreport)\./i,
  /^https:\/\/(crbug\.com|issues\.chromium\.org|bugs\.webkit\.org|bugzilla\.mozilla\.org)\//i,
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull|issues|commit|commits|compare|blob|discussions|labels|milestone|projects|wiki)\b/i,
  // NOT here: `github.com/o/r/releases/tag/T`. It was, and that severed the only
  // edge the release alias can travel on — a release tag is a citable event, and
  // an announcement citing it is what declares the bridge.
  /^https:\/\/[^/]+\/(docs|api|reference|guide|guides|manual|spec|schema)\//i,
  /^https:\/\/(www\.)?(youtube|youtu)\.[a-z.]+\/playlist/i, // a playlist is a shelf, not a story
  /^https:\/\/(www\.)?doi\.org\//i,
  // arXiv is deliberately NOT here: in the AI slice a paper genuinely IS the
  // story, and `arxiv.org/abs/…` is exactly the kind of URL C5-shaped clusters
  // form around. Adding it would trade a false positive for a false negative in
  // the corpus slice that matters most.
];
// Transports whose Items exist to point at something else rather than to BE
// something. Their self Link is a vehicle, not a story.
export const VEHICLE_TRANSPORTS = new Set(['hn', 'bluesky']);

export function isReferenceOnly(url) {
  return REFERENCE_ONLY.some((re) => re.test(url));
}

// Nav chrome, share widgets and feed plumbing are not citations. Without this
// every RSS item "cites" the publisher's /about page and Twitter intent links.
const BOILERPLATE = [
  /^https:\/\/(twitter\.com|x\.com)\/(intent|share)/i,
  /^https:\/\/(www\.)?facebook\.com\/sharer/i,
  /^https:\/\/(www\.)?linkedin\.com\/(share|sharing)/i,
  /^https:\/\/(www\.)?reddit\.com\/submit/i,
  /^https:\/\/bsky\.app\/intent/i,
  /^https:\/\/mailto/i,
  /\/(feed|rss|atom)(\.xml)?$/i,
  /\/(about|contact|privacy|terms|subscribe|unsubscribe|sponsor|advertise|archive|login|signup)\/?$/i,
  /^https:\/\/(gravatar|gmpg|w\.org|s\.w\.org|fonts\.googleapis|schema\.org|creativecommons\.org)/i,
  /^https:\/\/(www\.)?patreon\.com/i,
  /^https:\/\/buttondown\.(email|com)\/[^/]+$/i,
  /^https:\/\/[^/]+\/?$/, // a bare homepage is a nav link, not a citation
];
export function isBoilerplate(url) {
  return BOILERPLATE.some((re) => re.test(url));
}
