// PROTOTYPE — throwaway. Zis issue #6, part 1.
// The canonicalization cascade. Layers L1..L5; L4/L5 touch the network.
//
// Design stance: DENYLIST for query params (stripping an unknown param can
// change what the URL points at), and a hard split between two operations that
// look the same and are not:
//   - canonicalize: "which representation defines this Link" -> one Link row
//   - alias:        "these two distinct Links are the same event"  -> a merge edge
// L1..L3 + L5 are canonicalization. GitHub-release <-> announcement is an alias
// and lives in cluster.mjs, NOT here.

import { fetchWithPolicy } from './net.mjs';

// ---------------------------------------------------------------- L2 denylist

// Tracking / attribution only. Anything that can change the rendered document
// (page, p, q, sort, id, v, tab, lang, version) is deliberately absent.
export const PARAM_DENYLIST = [
  /^utm_/i,
  /^ga_/i,
  /^_hs(enc|mi|_)/i,
  /^at_(medium|campaign|custom\d)$/i,
  /^guce_referrer/i,
  ...[
    'ref', 'ref_src', 'ref_url', 'referrer', 'referer',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'yclid', 'twclid',
    'igshid', 'igsh', 'mibextid',
    'mc_cid', 'mc_eid', 'mkt_tok', '__s', 'vero_id', 'vero_conv',
    'sc_channel', 'sc_campaign', 'sc_publisher', 'sc_content', 'sc_geo',
    'hss_channel', 'trk', 'trkcampaign', 'guccounter',
    'cmp', 'cmpid', 'campaign_id', 'spm', 'scm',
    'smid', 'smtyp', 'partner', 'source_impression_id',
    'featured_on', 'triedredirect', 'giftcopy',
  ].map((k) => new RegExp(`^${k}$`, 'i')),
];

// Per-host overrides. The research doc's warning ("not every query param is
// noise") cuts both ways: some hosts need an ALLOWLIST because everything else
// is player/session state.
// FOUND ON REAL DATA: `{allow: ['v']}` alone is a bug. `/playlist?list=…`
// carries its identity in `list`, so stripping it collapsed every playlist in
// the corpus into one Link `youtube.com/playlist` — which then accumulated
// citations from three publishers and presented as a strength-3 Signal. An
// allowlist must be per-PATH-SHAPE, not per-host: any host whose identity lives
// in a param needs every identifying param enumerated, and a path shape whose
// identifying param is missing is not a Link at all.
export const HOST_PARAM_POLICY = {
  // Path-shape aware, because `watch` and `playlist` carry their identity in
  // DIFFERENT params. A flat per-host allowlist gets one of the two wrong
  // whichever way you write it: `['v']` collapses all playlists into one Link,
  // `['v','list']` splits one video into as many Links as playlists embed it.
  'youtube.com': { allowByPath: { '/watch': ['v'], '/playlist': ['list'] }, allow: [] },
  'www.youtube.com': { allowByPath: { '/watch': ['v'], '/playlist': ['list'] }, allow: [] },
  'news.ycombinator.com': { allow: ['id'] },
  'lobste.rs': { allow: [] },
  'x.com': { allow: [] },
  'twitter.com': { allow: [] },
  'medium.com': { allow: [] },
  'open.substack.com': { allow: [] },
  'reddit.com': { allow: [] },
  'www.reddit.com': { allow: [] },
};

// ------------------------------------------------------------- L4 shorteners

export const SHORTENER_HOSTS = new Set([
  't.co', 'bit.ly', 'buff.ly', 'ow.ly', 'lnkd.in', 'dlvr.it', 'trib.al',
  'tinyurl.com', 'is.gd', 'goo.gl', 'rb.gy', 'cutt.ly', 's.id', 'shorturl.at',
  'po.st', 'hubs.li', 'hubs.ly', 'ift.tt', 'feedproxy.google.com',
  'feeds.feedblitz.com', 'flip.it', 'apple.co', 'spoti.fi', 'amzn.to',
  'go.dev.to', 'l.facebook.com', 'href.li', 'urlgeni.us', 'sq.gs',
]);

export const MAX_REDIRECT_HOPS = 3;

// ------------------------------------------------------------- L1/L2/L3 pure

const TRACKING_SUBDOMAINS = /^(www|www2|m|mobile|amp)\./;

/** L1 + L2 + L3, no network. Idempotent — safe to re-run after every hop. */
export function canonicalizeSync(rawUrl, { baseUrl } = {}) {
  let u;
  try {
    u = new URL(rawUrl, baseUrl);
  } catch {
    return null;
  }
  const notes = [];

  // L1 — scheme, host, port, fragment
  if (u.protocol === 'http:') {
    u.protocol = 'https:';
    notes.push('scheme:http->https');
  }
  if (u.protocol !== 'https:') return null; // mailto:, javascript:, ftp:, feed:
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  u.port = '';
  u.username = '';
  u.password = '';
  if (u.hash) {
    // A hashbang is (was) real routing state. Everything else is a scroll target.
    if (u.hash.startsWith('#!')) notes.push('hash:kept-hashbang');
    else u.hash = '';
  }

  // AMP shapes, before the www strip so `amp.` is caught by the same regex.
  const preAmpHost = u.hostname;
  u.hostname = u.hostname.replace(TRACKING_SUBDOMAINS, '');
  if (!u.hostname) u.hostname = preAmpHost;
  if (preAmpHost !== u.hostname) notes.push(`host:${preAmpHost}->${u.hostname}`);
  if (/\/amp\/?$/.test(u.pathname)) {
    u.pathname = u.pathname.replace(/\/amp\/?$/, '');
    notes.push('amp:path-suffix');
  }
  if (u.pathname.startsWith('/amp/')) {
    u.pathname = u.pathname.slice(4);
    notes.push('amp:path-prefix');
  }

  // L2 — params
  const policy = HOST_PARAM_POLICY[u.hostname];
  const allow = policy && (policy.allowByPath?.[u.pathname.replace(/\/$/, '') || '/'] ?? policy.allow);
  const kept = [];
  for (const [k, v] of [...u.searchParams]) {
    if (allow) {
      if (allow.includes(k.toLowerCase())) kept.push([k, v]);
      else notes.push(`param:allowlist-drop:${k}`);
      continue;
    }
    if (PARAM_DENYLIST.some((re) => re.test(k))) {
      notes.push(`param:deny:${k}`);
      continue;
    }
    if (k.toLowerCase() === 'amp' || k.toLowerCase() === 'output' && v === 'amp') {
      notes.push(`param:amp:${k}`);
      continue;
    }
    kept.push([k, v]);
  }
  // Sort so 304s fire and two orderings of one URL are one Link.
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  u.search = '';
  for (const [k, v] of kept) u.searchParams.append(k, v);

  // L1 cont. — trailing slash, index files, doubled slashes
  u.pathname = u.pathname.replace(/\/{2,}/g, '/');
  u.pathname = u.pathname.replace(/\/index\.(html?|php)$/i, '/');
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  if (u.pathname === '') u.pathname = '/';

  // L3 — shape aliases (same thing wearing a different address)
  const out = applyShapeAliases(u, notes);
  return { url: out.href, notes };
}

function applyShapeAliases(u, notes) {
  // youtu.be/<id> and /shorts/<id> and /embed/<id> are all watch?v=<id>
  if (u.hostname === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (id) {
      const n = new URL('https://youtube.com/watch');
      n.searchParams.set('v', id);
      notes.push('alias:youtu.be');
      return n;
    }
  }
  if (u.hostname === 'youtube.com') {
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]+)/);
    if (m) {
      const n = new URL('https://youtube.com/watch');
      n.searchParams.set('v', m[2]);
      notes.push(`alias:youtube-${m[1]}`);
      return n;
    }
  }
  // GitHub: strip the noise segments that are the same page.
  if (u.hostname === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      parts[0] = parts[0].toLowerCase();
      parts[1] = parts[1].toLowerCase().replace(/\.git$/, '');
      // /o/r/tree/main and /o/r/blob/main/README.md are the repo, not the event.
      if (parts[2] === 'tree' && parts.length === 4) {
        notes.push('alias:gh-tree->root');
        parts.length = 2;
      }
      // /releases/latest is whatever is latest today — not a stable Link.
      if (parts[2] === 'releases' && parts[3] === 'latest') {
        notes.push('alias:gh-releases-latest->releases');
        parts.length = 3;
      }
      u.pathname = '/' + parts.join('/');
    }
  }
  return u;
}

/** The `?page=2` question, answered explicitly rather than by accident. */
export const PAGINATION_STANCE = `KEPT. A denylist strips only params known to be
attribution noise; page/p/offset/cursor survive because page 2 of a doc is not
page 1. The failure mode this avoids (two real documents collapsing into one
Link) is silent and unrecoverable; the failure mode it accepts (a paginated
aggregator page cited two ways) is visible as a thin duplicate Signal and is
exactly what the one-click user merge exists for.`;

// ------------------------------------------------------- L4 redirect unwrap

/**
 * Unwrap shorteners / redirect chains. Bounded at MAX_REDIRECT_HOPS, and
 * canonicalizeSync re-runs after EVERY hop because nested shorteners are real
 * (bit.ly re-shortened by ow.ly then t.co).
 *
 * Every hop is re-validated: the SSRF validator from #7 must run per hop, not
 * once on the URL the feed gave us. Modelled here by `isPubliclyRoutable`.
 */
export async function unwrapRedirects(startUrl, { log = () => {} } = {}) {
  let current = startUrl;
  const chain = [startUrl];
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const host = safeHost(current);
    if (!host) break;
    if (!SHORTENER_HOSTS.has(host)) break;
    const res = await fetchWithPolicy(current, { method: 'GET', redirect: 'manual' });
    if (!res.ok && !(res.status >= 300 && res.status < 400)) break;
    const loc = res.headers?.get?.('location');
    if (!loc) break;
    const next = canonicalizeSync(loc, { baseUrl: current });
    if (!next) break;
    if (!isPubliclyRoutable(next.url)) {
      log(`SSRF-REJECT hop ${hop + 1}: ${next.url}`);
      break;
    }
    if (chain.includes(next.url)) break; // redirect loop
    current = next.url;
    chain.push(current);
  }
  const exhausted = chain.length - 1 >= MAX_REDIRECT_HOPS && SHORTENER_HOSTS.has(safeHost(current) || '');
  return { url: current, chain, exhausted };
}

export function safeHost(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

/** Stand-in for #7's validator, so the interaction is visible in the prototype. */
export function isPubliclyRoutable(url) {
  const h = safeHost(url);
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) return false;
  }
  if (h.includes(':')) return false; // bare IPv6 literal
  return true;
}

// ------------------------------------------- L5 publisher-declared canonical

const CANON_HEADER = /<([^>]+)>\s*;\s*rel\s*=\s*"?canonical"?/i;
const CANON_TAG = /<link[^>]+rel=["']?canonical["']?[^>]*>/i;
const HREF = /href=["']([^"']+)["']/i;

/**
 * Layer 2 of the cascade the map says was skipped: prefer what the PUBLISHER
 * declares over what we normalized locally.
 *
 * Two guards, both learned the hard way in prior art:
 *  - accept only a SAME-SITE canonical. A cross-domain rel=canonical is a
 *    syndication claim (Medium mirrors, dev.to crossposts) and following it
 *    would collapse two publishers' rows into one, destroying provenance.
 *  - the header form is checked FIRST, because rel=canonical arrives as an HTTP
 *    header at least as often as a <link> tag and header-only publishers exist.
 */
export async function publisherCanonical(url) {
  const res = await fetchWithPolicy(url, { method: 'GET', maxBytes: 96 * 1024 });
  if (!res.ok) return { url, status: res.status, via: null };
  const linkHeader = res.headers?.get?.('link') || '';
  let declared = null;
  let via = null;
  const hm = linkHeader.match(CANON_HEADER);
  if (hm) {
    declared = hm[1].trim();
    via = 'http-header';
  } else if ((res.contentType || '').includes('html')) {
    const tag = res.body?.match(CANON_TAG);
    const href = tag && tag[0].match(HREF);
    if (href) {
      declared = href[1].trim();
      via = 'link-tag';
    }
  }
  if (!declared) return { url, status: res.status, via: null };
  const norm = canonicalizeSync(declared, { baseUrl: url });
  if (!norm) return { url, status: res.status, via: null };
  if (registrable(norm.url) !== registrable(url)) {
    return { url, status: res.status, via: null, rejected: `cross-site:${norm.url}` };
  }
  return { url: norm.url, status: res.status, via, declared };
}

export function registrable(u) {
  const h = safeHost(u);
  if (!h) return null;
  const parts = h.split('.');
  // Good enough for a prototype; production wants the PSL.
  const twoLevelTlds = new Set(['co.uk', 'com.au', 'co.jp', 'org.uk', 'co.nz', 'com.br']);
  const last2 = parts.slice(-2).join('.');
  return twoLevelTlds.has(last2) ? parts.slice(-3).join('.') : last2;
}
