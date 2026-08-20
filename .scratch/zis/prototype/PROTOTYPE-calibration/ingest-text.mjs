// PROTOTYPE — throwaway. Fetch real Items + their Citations.
// Deliberately hand-rolled parsers: zero deps, and the point is to see what the
// real bytes look like, not to be a good feed library.
//
// FORK of PROTOTYPE-clustering/ingest.mjs for issue #21, with exactly one
// addition: every Item keeps a `text` field — the stripped feed body. #6 threw
// the body away the moment it had harvested hrefs from it, because clustering
// never reads text. Relevance does: `text_basis: own` is defined as "the
// ingested Item's title + extracted summary" (ranking-model.md §4), so without
// this the `own` rung cannot be measured at all.
//
// Everything else is byte-identical to #6's file, and the shared modules
// (net / sources / canonicalize / cluster) are imported rather than copied, so
// the corpus this produces is the same corpus #6 measured.

import { fetchWithPolicy } from '../PROTOTYPE-clustering/net.mjs';
import { PUBLISHERS } from '../PROTOTYPE-clustering/sources.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ' };
const decode = (s) =>
  String(s || '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (ENT[k]) return ENT[k];
      if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
      return m;
    })
    .trim();

const strip = (s) => decode(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? strip(m[1]) : null;
}

function atomLink(xml) {
  // rel="alternate" (or absent) wins; rel="self"/"replies"/"enclosure" do not.
  const links = [...xml.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  for (const attrs of links) {
    const rel = (attrs.match(/rel=["']([^"']+)["']/i) || [])[1];
    if (rel && rel !== 'alternate') continue;
    const href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
    if (href) return decode(href);
  }
  return null;
}

/**
 * #21 addition. The `own` rung embeds "title + extracted summary", so this is
 * the extraction: strip tags, decode entities, collapse whitespace, cap length.
 * The cap matters for the measurement rather than for storage — cosine
 * similarity is not length-portable, which is the whole reason `T+` is keyed by
 * rung, so an unbounded `own` text would make that rung's distribution a
 * function of which publishers happen to ship full text.
 */
function plainText(html, maxChars = 1200) {
  const s = decode(
    String(html || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
  return s.slice(0, maxChars);
}

const HREF_RE = /<a\b[^>]*?href=["']([^"'#][^"']*)["']/gi;

function extractHrefs(html) {
  const out = [];
  for (const m of String(html || '').matchAll(HREF_RE)) out.push(decode(m[1]));
  return out;
}

const ANCHOR_RE = /<a\b[^>]*?href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

/**
 * #21 addition: the ANCHOR TEXT of each outbound link.
 *
 * #6 kept only the href, because clustering needs an address and nothing else.
 * Relevance needs to know what the citing Publisher SAID the link was, and the
 * difference is not cosmetic: for a newsletter, the citing Item's title is the
 * ISSUE title ("Zuckerberg's manifesto, Elon's $1T shortcut"), which is about
 * every story in the issue and therefore about none of them. Newsletters are
 * the corpus's densest citers, so a `citing` rung built from Item titles
 * embeds the wrong subject for a large share of the very Signals that reach
 * Strength >= 2.
 */
function extractAnchors(html) {
  const map = new Map();
  for (const m of String(html || '').matchAll(ANCHOR_RE)) {
    const url = decode(m[1]);
    const label = decode(String(m[2]).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!label || label.length < 3) continue;
    if (/^(read more|continue reading|here|link|more|\W+)$/i.test(label)) continue;
    // First non-boilerplate label wins; later repeats of the same href in one
    // body are usually "read more" tails.
    if (!map.has(url)) map.set(url, label.slice(0, 300));
  }
  return Object.fromEntries(map);
}

/** Newsletters whose feed body is an excerpt — the link list is on the issue page. */
export const EXCERPT_AGGREGATORS = new Set([
  'jsweekly', 'reactstatus', 'frontendfocus', 'tldr', 'twir', 'pycoders',
]);

export async function ingestRss(pub, source, log) {
  const res = await fetchWithPolicy(source.url, { accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8' });
  if (!res.ok) {
    log(`  ! ${pub.id} ${source.url} -> ${res.status} ${res.error || ''}`);
    return [];
  }
  const xml = res.body;
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items = [];
  for (const b of blocks.slice(0, 40)) {
    const self = atomLink(b) || tag(b, 'link') || tag(b, 'guid');
    const title = tag(b, 'title') || '';
    const date = tag(b, 'published') || tag(b, 'updated') || tag(b, 'pubDate') || tag(b, 'dc:date');
    const body =
      (b.match(/<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i) || [])[1] ||
      (b.match(/<content(?:\s[^>]*)?>([\s\S]*?)<\/content>/i) || [])[1] ||
      (b.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i) || [])[1] ||
      (b.match(/<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>/i) || [])[1] ||
      '';
    items.push({
      publisherId: pub.id,
      sourceKey: `rss:${source.url}`,
      transport: 'rss',
      title,
      selfUrl: self,
      publishedAt: parseDate(date),
      outbound: extractHrefs(strip(body)),
      // #21: the extracted summary. Tags dropped, entities decoded, capped —
      // ADR-0005 stores no HTML, and `own` embeds title + summary, not a page.
      text: plainText(body),
      anchors: extractAnchors(strip(body)),
      needsIssuePage: EXCERPT_AGGREGATORS.has(pub.id),
    });
  }
  return items;
}

/**
 * The prerequisite the RSS research flagged: for excerpt-only aggregators the
 * cited URLs are NOT in the feed. Fetch the issue page and harvest from there.
 * This is measured in the report — it is the single biggest lever on cluster
 * yield in the whole corpus.
 */
export async function hydrateIssuePages(items, log) {
  const targets = items.filter((i) => i.needsIssuePage && i.selfUrl).slice(0, 24);
  for (const it of targets) {
    const res = await fetchWithPolicy(it.selfUrl, { maxBytes: 2 * 1024 * 1024, accept: 'text/html' });
    if (!res.ok) {
      log(`  ! issue page ${it.selfUrl} -> ${res.status}`);
      continue;
    }
    const before = it.outbound.length;
    const harvested = extractHrefs(res.body);
    it.outbound = [...new Set([...it.outbound, ...harvested])];
    it.issuePageGain = it.outbound.length - before;
    // #21: the issue page is where a newsletter's anchor text lives, and
    // newsletters are exactly the Publishers whose Item title is useless as a
    // description of any one link. Feed-body anchors win over issue-page ones
    // only because they were seen first; both are the same Publisher's words.
    it.anchors = { ...extractAnchors(res.body), ...(it.anchors || {}) };
  }
  return targets.length;
}

// --------------------------------------------------------------------- HN

export async function ingestHn(pub, source, log, limit = 120) {
  const list = await fetchWithPolicy(`https://hacker-news.firebaseio.com/v0/${source.list}.json`);
  if (!list.ok) {
    log(`  ! HN ${source.list} -> ${list.status}`);
    return [];
  }
  let ids;
  try {
    ids = JSON.parse(list.body).slice(0, limit);
  } catch {
    return [];
  }
  // Algolia in one query per page beats 120 Firebase calls for a spike.
  const items = [];
  const pages = Math.ceil(ids.length / 60);
  for (let p = 0; p < pages; p++) {
    const slice = ids.slice(p * 60, (p + 1) * 60);
    const q = slice.map((id) => `story_${id}`).join(',');
    const res = await fetchWithPolicy(
      `https://hn.algolia.com/api/v1/search?tags=(${q})&hitsPerPage=60`
    );
    if (!res.ok) continue;
    let hits = [];
    try {
      hits = JSON.parse(res.body).hits || [];
    } catch {}
    for (const h of hits) {
      const discussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      items.push({
        publisherId: pub.id,
        sourceKey: `hn:${source.list}`,
        transport: 'hn',
        title: h.title || h.story_title || '',
        // The Item's own address is the HN thread; the submitted URL is an
        // OUTBOUND citation. CONTEXT.md: an Item's own URL is a Citation of
        // kind `self`, not a privileged column.
        selfUrl: discussionUrl,
        publishedAt: h.created_at ? new Date(h.created_at).toISOString() : null,
        outbound: h.url ? [h.url] : [],
        // #21: only Ask HN / Show HN text posts carry any. A link submission's
        // own text is empty, which is correct — the thread is not the story.
        text: plainText(h.story_text || ''),
        hnStoryId: h.objectID,
        hnPoints: h.points,
        hnSubmittedUrl: h.url || null,
      });
    }
  }
  return items;
}

// ----------------------------------------------------------------- Bluesky

export async function ingestBluesky(pub, source, log) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(source.did)}&limit=60&filter=posts_no_replies`;
  const res = await fetchWithPolicy(url);
  if (!res.ok) {
    log(`  ! bsky ${pub.id} -> ${res.status}`);
    return [];
  }
  let feed = [];
  try {
    feed = JSON.parse(res.body).feed || [];
  } catch {
    return [];
  }
  const items = [];
  let repostsDropped = 0;
  for (const fi of feed) {
    // THE trap from the platforms research: an item carrying `reason` is a
    // repost, and post.author is the REPOSTED account, not the one we asked
    // for. Attributing it to `pub` silently inflates Strength.
    if (fi.reason) {
      repostsDropped++;
      continue;
    }
    const post = fi.post;
    if (!post) continue;
    const urls = new Set();
    for (const f of post.record?.facets || [])
      for (const feat of f.features || [])
        if (feat.$type === 'app.bsky.richtext.facet#link' && feat.uri) urls.add(feat.uri);
    const ext = post.embed?.external?.uri || post.record?.embed?.external?.uri;
    if (ext) urls.add(ext);
    if (!urls.size) continue;
    items.push({
      publisherId: pub.id,
      sourceKey: `bsky:${source.did}`,
      transport: 'bluesky',
      title: (post.record?.text || '').slice(0, 200),
      selfUrl: atUriToWeb(post.uri, post.author?.handle),
      publishedAt: post.record?.createdAt || post.indexedAt || null,
      outbound: [...urls],
      // #21: a Bluesky post's text IS its title here (already the sliced
      // record text), so there is no separate summary to add.
      text: '',
    });
  }
  if (repostsDropped) log(`    bsky ${pub.id}: dropped ${repostsDropped} reposts (reason field)`);
  return items;
}

function atUriToWeb(uri, handle) {
  const m = String(uri || '').match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)$/);
  if (!m) return null;
  return `https://bsky.app/profile/${handle || m[1]}/post/${m[2]}`;
}

// ------------------------------------------------------------ GitHub releases
// Needed to exercise the release<->announcement bridge at all: without a
// releases source the corpus contains no `releases/tag/…` Links and that rule
// is untestable. Unauthenticated REST (60/hr) is plenty for a spike.

export async function ingestGithubReleases(pub, source, log) {
  const res = await fetchWithPolicy(
    `https://api.github.com/repos/${source.repo}/releases?per_page=5`,
    { accept: 'application/vnd.github+json' }
  );
  if (!res.ok) {
    log(`  ! gh releases ${source.repo} -> ${res.status}`);
    return [];
  }
  let rels = [];
  try {
    rels = JSON.parse(res.body);
  } catch {
    return [];
  }
  if (!Array.isArray(rels)) return [];
  return rels.map((r) => ({
    publisherId: pub.id,
    sourceKey: `gh:${source.repo}`,
    transport: 'github-releases',
    title: `${source.repo} ${r.name || r.tag_name}`,
    selfUrl: r.html_url,
    publishedAt: parseDate(r.published_at),
    // Links declared in the release body. The bridge rule reads these.
    outbound: [...String(r.body || '').matchAll(/https?:\/\/[^\s)<>\]"']+/g)].map((m) => m[0]),
    // #21: release notes, with markdown link syntax reduced to its label so the
    // embedded text is prose rather than a wall of URLs.
    text: plainText(String(r.body || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')),
    githubRepo: source.repo,
    isPrerelease: r.prerelease,
  }));
}

// ------------------------------------------------------------------ driver

export function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  // Feeds lie: TLDR has a 2018 item, Render a future-dated one. Clamp.
  const now = Date.now();
  return new Date(Math.min(t, now)).toISOString();
}

export async function ingestAll({ log = console.log, includeControls = true } = {}) {
  const items = [];
  for (const pub of PUBLISHERS) {
    if (pub.control && !includeControls) continue;
    for (const source of pub.sources) {
      let got = [];
      if (source.transport === 'rss') got = await ingestRss(pub, source, log);
      else if (source.transport === 'hn') got = await ingestHn(pub, source, log);
      else if (source.transport === 'bluesky-author') got = await ingestBluesky(pub, source, log);
      else if (source.transport === 'github-releases') got = await ingestGithubReleases(pub, source, log);
      log(`  ${pub.id.padEnd(20)} ${source.transport.padEnd(15)} ${String(got.length).padStart(4)} items`);
      items.push(...got);
    }
  }
  const hydrated = await hydrateIssuePages(items, log);
  log(`  issue-page hydration: ${hydrated} newsletter issues fetched`);
  return items;
}
