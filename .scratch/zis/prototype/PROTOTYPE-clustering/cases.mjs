// PROTOTYPE — throwaway. The hard cases from issue #6, as executable rows.
// Each row is `[input, expected-or-null, why]`. `null` expected means "I want to
// see what it does" rather than an assertion.

export const CANON_CASES = [
  ['https://react.dev/blog/2026/01/01/react-19?utm_source=tldr&utm_medium=email',
   'https://react.dev/blog/2026/01/01/react-19', 'utm_* stripped'],
  ['http://WWW.React.dev/blog/foo/',
   'https://react.dev/blog/foo', 'scheme, host case, www, trailing slash'],
  ['https://react.dev:443/blog/foo',
   'https://react.dev/blog/foo', 'default port'],
  ['https://example.com/post#section-3',
   'https://example.com/post', 'fragment is a scroll target'],
  ['https://example.com/post#!/route',
   'https://example.com/post#!/route', 'hashbang is routing state — KEPT'],
  ['https://example.com/a//b///c',
   'https://example.com/a/b/c', 'doubled slashes'],
  ['https://example.com/docs/index.html',
   'https://example.com/docs', 'index.html is the directory, then the trailing slash goes too'],

  // pagination / sort — the explicit question in the ticket
  ['https://lobste.rs/?page=2', 'https://lobste.rs/', 'lobste.rs is allowlist-empty: page dropped; root keeps its slash'],
  ['https://example.com/blog?page=2',
   'https://example.com/blog?page=2', '?page=2 KEPT — denylist only'],
  ['https://example.com/blog?sort=new',
   'https://example.com/blog?sort=new', 'sort KEPT — changes the document'],
  ['https://example.com/p?b=2&a=1',
   'https://example.com/p?a=1&b=2', 'params sorted so one URL is one Link'],

  // AMP
  ['https://amp.theguardian.com/tech/story',
   'https://theguardian.com/tech/story', 'amp. subdomain'],
  ['https://example.com/story/amp/',
   'https://example.com/story', 'amp path suffix'],
  ['https://example.com/story?amp=1',
   'https://example.com/story', 'amp param'],

  // YouTube
  ['https://youtu.be/dQw4w9WgXcQ?t=42',
   'https://youtube.com/watch?v=dQw4w9WgXcQ', 'shortener + player state'],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&pp=xx&si=abc',
   'https://youtube.com/watch?v=dQw4w9WgXcQ', 'allowlist: only v survives'],
  ['https://www.youtube.com/shorts/dQw4w9WgXcQ',
   'https://youtube.com/watch?v=dQw4w9WgXcQ', 'shorts is the same video'],
  ['https://www.youtube.com/playlist?list=PL123&si=abc',
   'https://youtube.com/playlist?list=PL123', 'playlist identity is `list`, not `v`'],

  // GitHub
  ['https://github.com/Facebook/React.git',
   'https://github.com/facebook/react', 'owner/repo case + .git'],
  ['https://github.com/facebook/react/tree/main',
   'https://github.com/facebook/react', '/tree/<branch> is the repo root'],
  ['https://github.com/facebook/react/releases/latest',
   'https://github.com/facebook/react/releases', '/latest is not a stable Link'],
  ['https://github.com/facebook/react/releases/tag/v19.0.0',
   'https://github.com/facebook/react/releases/tag/v19.0.0', 'a release tag IS the event'],

  // HN — canonicalization keeps it; the ALIAS is a merge, not a rewrite
  ['https://news.ycombinator.com/item?id=12345678&p=2',
   'https://news.ycombinator.com/item?id=12345678', 'allowlist: only id'],

  // things that must NOT become Links
  ['mailto:someone@example.com', null, 'non-http rejected'],
  ['javascript:void(0)', null, 'rejected'],
  ['/relative/path', null, 'no base: rejected'],
  ['https://localhost/admin', null, 'SSRF guard (checked separately)'],
  ['https://192.168.1.1/', null, 'SSRF guard (checked separately)'],
];

/**
 * The 10 expected co-citation clusters from the RSS research, as host/path
 * matchers. `min` is the target distinct-Publisher count from that document.
 */
export const EXPECTED_CLUSTERS = [
  { id: 'C1', name: 'React release / React Team post', min: 7, match: (u) => /^https:\/\/react\.dev\/blog\//.test(u) },
  { id: 'C2', name: 'TypeScript release', min: 6, match: (u) => /devblogs\.microsoft\.com\/typescript\//.test(u) },
  { id: 'C3', name: 'Rust release / major RFC', min: 5, match: (u) => /^https:\/\/blog\.rust-lang\.org\//.test(u) },
  { id: 'C4', name: 'Cloudflare Birthday/Developer Week', min: 6, match: (u) => /^https:\/\/blog\.cloudflare\.com\/[^/]+/.test(u) },
  { id: 'C5', name: 'Frontier-model launch', min: 7, match: (u) => /^https:\/\/(openai\.com\/(index|news)\/|deepmind\.google\/|mistral\.ai\/news\/)/.test(u) },
  { id: 'C6', name: 'Anthropic announcement (ZERO from origin)', min: 5, match: (u) => /^https:\/\/(www\.)?anthropic\.com\/(news|engineering|research|index)\//.test(u) },
  { id: 'C7', name: 'Web-platform / CSS feature ships', min: 5, match: (u) => /^https:\/\/(webkit\.org\/blog\/|developer\.chrome\.com\/blog\/|web\.dev\/blog\/)/.test(u) },
  { id: 'C8', name: 'Postgres release / major extension', min: 4, match: (u) => /^https:\/\/(www\.)?postgresql\.org\/about\/news\//.test(u) },
  { id: 'C9', name: 'Viral long-form engineering post', min: 4, match: (u) => /^https:\/\/(danluu\.com|lucumr\.pocoo\.org|oxide\.computer\/blog|jvns\.ca|netflixtechblog\.com)\//.test(u) },
  { id: 'C10', name: 'Node.js security release', min: 4, match: (u) => /^https:\/\/nodejs\.org\/en\/blog\/(vulnerability|release)\//.test(u) },
];

/**
 * Publishers whose items must NOT produce multi-publisher clusters.
 *
 * `ghchangelog` was in this list and has been removed: the GitHub changelog is
 * a SOURCE of the GitHub Publisher, not a Publisher of its own, and modelling it
 * as one is what let GitHub vote on itself. Its items are still in the corpus
 * (see sources.mjs) — they are just judged under `github`.
 */
export const NEGATIVE_CONTROL_PUBLISHERS = ['aws', 'huggingface', 'vercel'];
