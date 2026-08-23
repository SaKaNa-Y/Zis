// PROTOTYPE — throwaway. The corpus for this spike.
// Publisher is the unit Strength counts (CONTEXT.md), so the registry is keyed
// by publisher and a Source hangs off it. `hosts` is what makes the
// self-citation guard possible: a Citation whose Item's Publisher owns the
// cited host is origin provenance, not a vote.

export const PUBLISHERS = [
  // --- Tier 1 aggregators (they manufacture clusters) -----------------------
  { id: 'simonwillison', name: 'Simon Willison', hosts: ['simonwillison.net'], sources: [
    { transport: 'rss', url: 'https://simonwillison.net/atom/everything/' },
    { transport: 'bluesky-author', did: 'did:plc:kft6lu4trxowqmter2b6vg6z' },
  ]},
  { id: 'tldr', name: 'TLDR', hosts: ['tldr.tech'], sources: [
    { transport: 'rss', url: 'https://tldr.tech/api/rss/tech' },
  ]},
  { id: 'jsweekly', name: 'JavaScript Weekly', hosts: ['javascriptweekly.com'], sources: [
    { transport: 'rss', url: 'https://javascriptweekly.com/rss' },
  ]},
  { id: 'reactstatus', name: 'React Status', hosts: ['react.statuscode.com'], sources: [
    { transport: 'rss', url: 'https://react.statuscode.com/rss' },
  ]},
  { id: 'frontendfocus', name: 'Frontend Focus', hosts: ['frontendfoc.us'], sources: [
    { transport: 'rss', url: 'https://frontendfoc.us/rss' },
  ]},
  { id: 'twir', name: 'This Week in Rust', hosts: ['this-week-in-rust.org'], sources: [
    { transport: 'rss', url: 'https://this-week-in-rust.org/rss.xml' },
  ]},
  { id: 'jimnielsen', name: 'Jim Nielsen', hosts: ['blog.jim-nielsen.com'], sources: [
    { transport: 'rss', url: 'https://blog.jim-nielsen.com/feed.xml' },
  ]},
  { id: 'pycoders', name: "PyCoder's Weekly", hosts: ['pycoders.com'], sources: [
    { transport: 'rss', url: 'https://pycoders.com/feed' },
  ]},

  // --- Origin blogs --------------------------------------------------------
  { id: 'react', name: 'React', hosts: ['react.dev'], sources: [
    { transport: 'rss', url: 'https://react.dev/rss.xml' },
  ]},
  { id: 'nextjs', name: 'Next.js', hosts: ['nextjs.org'], sources: [
    { transport: 'rss', url: 'https://nextjs.org/feed.xml' },
  ]},
  { id: 'typescript', name: 'TypeScript', hosts: ['devblogs.microsoft.com', 'typescriptlang.org'], sources: [
    { transport: 'rss', url: 'https://devblogs.microsoft.com/typescript/feed/' },
  ]},
  { id: 'nodejs', name: 'Node.js', hosts: ['nodejs.org'], sources: [
    { transport: 'rss', url: 'https://nodejs.org/en/feed/blog.xml' },
  ]},
  { id: 'rust', name: 'Rust', hosts: ['blog.rust-lang.org', 'rust-lang.org'], sources: [
    { transport: 'rss', url: 'https://blog.rust-lang.org/feed.xml' },
  ]},
  { id: 'go', name: 'Go', hosts: ['go.dev'], sources: [
    { transport: 'rss', url: 'https://go.dev/blog/feed.atom' },
  ]},
  { id: 'cloudflare', name: 'Cloudflare', hosts: ['blog.cloudflare.com', 'cloudflare.com'], sources: [
    { transport: 'rss', url: 'https://blog.cloudflare.com/rss/' },
  ]},
  // FOUND BY THE NEGATIVE CONTROL: `github` and `ghchangelog` were originally
  // two Publishers sharing the host `github.blog`. HOST_OWNER is a Map, so the
  // second registration won, the self-citation guard stopped firing for GitHub's
  // own posts, and GitHub appeared as an independent VOTER on its own changelog.
  // That is the vendor-manufactures-its-own-cluster failure, arriving through a
  // data-modelling slip rather than a rule. CONTEXT.md already forbids it: a
  // Publisher is one owning voice and a Source is one pollable endpoint, so the
  // blog and the changelog are two Sources of ONE Publisher.
  { id: 'github', name: 'GitHub', hosts: ['github.blog', 'github.com'], sources: [
    { transport: 'rss', url: 'https://github.blog/feed/' },
    { transport: 'rss', url: 'https://github.blog/changelog/feed/', control: true },
  ]},
  { id: 'openai', name: 'OpenAI', hosts: ['openai.com'], sources: [
    { transport: 'rss', url: 'https://openai.com/news/rss.xml' },
  ]},
  { id: 'deepmind', name: 'Google DeepMind', hosts: ['deepmind.google'], sources: [
    { transport: 'rss', url: 'https://deepmind.google/blog/rss.xml' },
  ]},
  { id: 'webkit', name: 'WebKit', hosts: ['webkit.org'], sources: [
    { transport: 'rss', url: 'https://webkit.org/feed/atom/' },
  ]},
  { id: 'chromedev', name: 'Chrome for Developers', hosts: ['developer.chrome.com'], sources: [
    { transport: 'rss', url: 'https://developer.chrome.com/static/blog/feed.xml' },
  ]},
  { id: 'svelte', name: 'Svelte', hosts: ['svelte.dev'], sources: [
    { transport: 'rss', url: 'https://svelte.dev/blog/rss.xml' },
  ]},
  { id: 'astro', name: 'Astro', hosts: ['astro.build'], sources: [
    { transport: 'rss', url: 'https://astro.build/rss.xml' },
  ]},
  { id: 'deno', name: 'Deno', hosts: ['deno.com', 'deno.land'], sources: [
    { transport: 'rss', url: 'https://deno.com/feed' },
  ]},
  { id: 'bun', name: 'Bun', hosts: ['bun.com', 'bun.sh'], sources: [
    { transport: 'rss', url: 'https://bun.com/rss.xml' },
  ]},

  // --- Press ---------------------------------------------------------------
  { id: 'arstechnica', name: 'Ars Technica', hosts: ['arstechnica.com'], sources: [
    { transport: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  ]},
  // REMOVED for #11, on #29 and ADR-0014 rather than on yield:
  //   theregister — `Disallow: /` under `User-agent: *`, verified primary
  //     robots.txt on both subdomain and apex. Contributed 40 citations in #6.
  //   infoq — both `feed.infoq.com` (406) and the apex (405 + AWS WAF) refuse to
  //     answer, so there is no rule to quote. `Unverifiable`, a third register
  //     state, not a synonym for excluded. Contributed 15 citations in #6.
  // arstechnica STAYS: `feeds.arstechnica.com` answers 404, which under ADR-0014
  // is a verdict whatever the body, and Zis never contacts the apex.
  { id: 'lwn', name: 'LWN', hosts: ['lwn.net'], sources: [
    { transport: 'rss', url: 'https://lwn.net/headlines/newrss' },
  ]},
  { id: '404media', name: '404 Media', hosts: ['404media.co'], sources: [
    { transport: 'rss', url: 'https://www.404media.co/rss/' },
  ]},
  { id: 'thenewstack', name: 'The New Stack', hosts: ['thenewstack.io'], sources: [
    { transport: 'rss', url: 'https://thenewstack.io/blog/feed/' },
  ]},

  // --- Citational individuals ---------------------------------------------
  { id: 'bramus', name: 'Bramus', hosts: ['bram.us'], sources: [
    { transport: 'rss', url: 'https://www.bram.us/feed/' },
  ]},
  { id: 'rachelandrew', name: 'Rachel Andrew', hosts: ['rachelandrew.co.uk'], sources: [
    { transport: 'rss', url: 'https://rachelandrew.co.uk/feed/' },
    { transport: 'bluesky-author', did: 'did:plc:xi53lkcvx4b3bl5tgsb7tnqe' },
  ]},
  { id: 'armin', name: 'Armin Ronacher', hosts: ['lucumr.pocoo.org'], sources: [
    { transport: 'rss', url: 'https://lucumr.pocoo.org/feed.atom' },
  ]},
  { id: 'interconnects', name: 'Interconnects', hosts: ['interconnects.ai'], sources: [
    { transport: 'rss', url: 'https://www.interconnects.ai/feed' },
  ]},
  { id: 'latentspace', name: 'Latent Space', hosts: ['latent.space'], sources: [
    { transport: 'rss', url: 'https://www.latent.space/feed' },
  ]},
  { id: 'pragmaticengineer', name: 'Pragmatic Engineer', hosts: ['blog.pragmaticengineer.com'], sources: [
    { transport: 'rss', url: 'https://blog.pragmaticengineer.com/rss/' },
  ]},
  { id: 'chriscoyier', name: 'Chris Coyier', hosts: ['chriscoyier.net', 'css-tricks.com'], sources: [
    { transport: 'rss', url: 'https://chriscoyier.net/feed/' },
    { transport: 'bluesky-author', did: 'did:plc:xhhcrzsilpamjmz4dvrpt7df' },
  ]},
  { id: 'adactio', name: 'Jeremy Keith', hosts: ['adactio.com'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:r4p4qrbwfv7fbvpem5hjdmvl' },
  ]},
  { id: 'kentcdodds', name: 'Kent C. Dodds', hosts: ['kentcdodds.com'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:xzefkiajzjmmyp6zq6ftczg3' },
  ]},
  { id: 'juliaevans', name: 'Julia Evans', hosts: ['jvns.ca'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:nzrozayxq764zbgl4qtp5ald' },
    { transport: 'rss', url: 'https://jvns.ca/atom.xml' },
  ]},
  { id: 'glyph', name: 'Glyph', hosts: ['glyph.im'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:vaa5e4jzfpx6znz3jzxqixym' },
  ]},
  { id: 'emollick', name: 'Ethan Mollick', hosts: ['oneusefulthing.org'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:flxq4uyjfotciovpw3x3fxnu' },
  ]},
  { id: 'una', name: 'Una Kravets', hosts: ['una.im'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:kesmfbtx2loscqj7ktw5shtt' },
  ]},
  { id: 'cassidoo', name: 'Cassidy Williams', hosts: ['cassidoo.co'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:bhdap3w2bseikypfnjmaskzf' },
  ]},

  // --- Hacker News ---------------------------------------------------------
  { id: 'hn', name: 'Hacker News', hosts: ['news.ycombinator.com'], sources: [
    { transport: 'hn', list: 'topstories' },
    { transport: 'hn', list: 'newstories' },
  ]},

  // --- Negative controls: high volume, near-zero external citation ---------
  { id: 'aws', name: 'AWS', hosts: ['aws.amazon.com'], control: true, sources: [
    { transport: 'rss', url: 'https://aws.amazon.com/blogs/aws/feed/' },
  ]},
  { id: 'huggingface', name: 'Hugging Face', hosts: ['huggingface.co'], control: true, sources: [
    { transport: 'rss', url: 'https://huggingface.co/blog/feed.xml' },
  ]},
  { id: 'vercel', name: 'Vercel', hosts: ['vercel.com'], control: true, sources: [
    { transport: 'rss', url: 'https://vercel.com/atom' },
  ]},
];

// GitHub releases, attached to the OWNING publisher rather than to `github`.
// A React release on GitHub is React speaking, not GitHub speaking — hanging
// these off `github` would be the vendor-manufactures-its-own-cluster bug in
// reverse, splitting one voice into two.
const GITHUB_RELEASE_REPOS = {
  react: 'facebook/react',
  typescript: 'microsoft/TypeScript',
  nodejs: 'nodejs/node',
  rust: 'rust-lang/rust',
  svelte: 'sveltejs/svelte',
  astro: 'withastro/astro',
  deno: 'denoland/deno',
  bun: 'oven-sh/bun',
  nextjs: 'vercel/next.js',
};
for (const [pubId, repo] of Object.entries(GITHUB_RELEASE_REPOS)) {
  const p = PUBLISHERS.find((x) => x.id === pubId);
  if (p) p.sources.push({ transport: 'github-releases', repo });
}

// --------------------------------------------------------------- #11 variants
//
// `PUBLISHERS` above is the baseline: #6's roster minus the two robots
// casualties. The two mutations below are #11's, applied under env flags so one
// tree serves every run and the diff between logs is honest.
//
//   ZIS_ADD=1       apply the candidate additions
//   ZIS_COOPER=1    collapse the Cooper Press family into ONE Publisher
//
// Both are applied BEFORE `HOST_OWNER` is built, because the self-citation guard
// reads that map and a variant that changed the roster after it was built would
// be measuring a corpus with a guard pointed at the wrong owners.
let ROSTER = PUBLISHERS;

// eslint-disable-next-line no-lone-blocks
if (process.env.ZIS_ADD === '1') {
  const { ALL_ADDITIONS, ADD_SOURCES_TO_EXISTING } = await import('./additions.mjs');
  for (const p of ALL_ADDITIONS) {
    // A duplicate host would silently disable the self-citation guard for the
    // loser — the #6 negative-control bug. Refuse loudly instead.
    for (const h of p.hosts) {
      const clash = ROSTER.find((q) => q.hosts.includes(h));
      if (clash) throw new Error(`addition ${p.id} claims host ${h} already owned by ${clash.id}`);
    }
    ROSTER.push(p);
  }
  for (const { publisherId, source } of ADD_SOURCES_TO_EXISTING) {
    const p = ROSTER.find((x) => x.id === publisherId);
    if (!p) throw new Error(`no such publisher for added source: ${publisherId}`);
    p.sources.push(source);
  }
}

if (process.env.ZIS_COOPER === '1') {
  const { collapseCooperPress } = await import('./additions.mjs');
  ROSTER = collapseCooperPress(ROSTER);
}

// The collapse returns a NEW array, so fold it back into `PUBLISHERS` in place
// rather than exporting a second name — every other module in the prototype
// already imports `PUBLISHERS`, and two roster identities is precisely the
// double-counting shape this ticket is investigating.
if (ROSTER !== PUBLISHERS) {
  PUBLISHERS.length = 0;
  PUBLISHERS.push(...ROSTER);
}

// Host -> publisher id, for the self-citation guard.
export const HOST_OWNER = new Map();
for (const p of PUBLISHERS) for (const h of p.hosts) HOST_OWNER.set(h, p.id);

export function ownerOfHost(host) {
  if (!host) return null;
  if (HOST_OWNER.has(host)) return HOST_OWNER.get(host);
  // one level of subdomain tolerance (blog.x.com -> x.com)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const cand = parts.slice(i).join('.');
    if (HOST_OWNER.has(cand)) return HOST_OWNER.get(cand);
  }
  return null;
}

export const PUBLISHER_BY_ID = new Map(PUBLISHERS.map((p) => [p.id, p]));
