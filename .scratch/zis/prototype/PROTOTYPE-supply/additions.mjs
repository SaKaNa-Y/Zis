// PROTOTYPE — throwaway. Zis issue #11.
//
// Candidate additions to the roster, and the two roster REWRITES that #11 found.
// Everything here is applied to `PUBLISHERS` by `run.mjs` under an env flag, so
// one tree serves the baseline and the variants and the diff is honest.
//
// Selection rule, from Run A: the currency is not citations, it is
// **cites-per-vote** — how many Citations a Publisher spends to raise Strength
// once. Run A's spread is three orders of magnitude wide (React Status 3.9,
// Latent Space 172.1, This Week in Rust ∞), and it does not track volume,
// prestige, or topical fit. So additions are chosen by GENRE — does this
// Publisher's job involve linking other people's URLs — and then measured.
//
// The second filter is the reader's own 20 Interests (#46), by number.

// ---------------------------------------------------------------------------
// A. The Cooper Press collapse — a rewrite, not an addition.
// ---------------------------------------------------------------------------
// JavaScript Weekly, React Status, Frontend Focus, Node Weekly, Golang Weekly,
// Postgres Weekly and Ruby Weekly are ONE company (Cooper Press), one editorial
// operation, on seven hosts. Run A has the first three as the top three
// suppliers of Strength in the whole corpus — 102 of the votes between them —
// and `candidate-sources-rss.md` says of Frontend Focus "Overlaps JS Weekly
// heavily — good, that's the point."
//
// Under the map's owning-entity rule that overlap is not the point, it is
// SELF-CITATION. `host -> publisher_id` UNIQUE cannot catch it because the hosts
// genuinely differ — the same blind spot that forced #8 to ban `hnrss.org` as a
// Transport by decision rather than by constraint.
//
// This variant merges them into one Publisher and re-measures. If the votes
// survive the merge they were independent; if they collapse, Run A's headline is
// an artifact and so is the "buy the aggregators first" advice in the research.
export const COOPER_PRESS_IDS = ['jsweekly', 'reactstatus', 'frontendfocus', 'nodeweekly', 'golangweekly'];

export function collapseCooperPress(PUBLISHERS) {
  const members = PUBLISHERS.filter((p) => COOPER_PRESS_IDS.includes(p.id));
  if (members.length < 2) return PUBLISHERS;
  const merged = {
    id: 'cooperpress',
    name: 'Cooper Press',
    hosts: members.flatMap((p) => p.hosts),
    sources: members.flatMap((p) => p.sources),
  };
  const rest = PUBLISHERS.filter((p) => !COOPER_PRESS_IDS.includes(p.id));
  // Keep roster position stable so ingest order — and therefore any remaining
  // order-dependent behaviour — does not shift under the variant.
  const at = PUBLISHERS.findIndex((p) => COOPER_PRESS_IDS.includes(p.id));
  rest.splice(Math.max(0, at), 0, merged);
  return rest;
}

// ---------------------------------------------------------------------------
// B. Additions, by genre.
// ---------------------------------------------------------------------------

/** B1. Newsletters and aggregators — the genre whose job IS linking out. */
export const ADD_AGGREGATORS = [
  // Cooper Press siblings not yet in the roster. Measured as separate
  // Publishers here so the collapse variant has something to collapse; the
  // register's final shape depends on which variant wins.
  // Interests #9 (release announcements), #10 (tooling and build systems).
  { id: 'nodeweekly', name: 'Node Weekly', hosts: ['nodeweekly.com'], excerptAggregator: true, sources: [
    { transport: 'rss', url: 'https://nodeweekly.com/rss' },
  ]},
  { id: 'golangweekly', name: 'Golang Weekly', hosts: ['golangweekly.com'], excerptAggregator: true, sources: [
    { transport: 'rss', url: 'https://golangweekly.com/rss' },
  ]},
  // Not Cooper Press. Tooling-centric, so it should overlap #10 heavily.
  { id: 'webtoolsweekly', name: 'Web Tools Weekly', hosts: ['webtoolsweekly.com'], excerptAggregator: true, sources: [
    { transport: 'rss', url: 'https://webtoolsweekly.com/feed/' },
  ]},
  { id: 'consoledev', name: 'Console.dev', hosts: ['console.dev'], excerptAggregator: true, sources: [
    { transport: 'rss', url: 'https://console.dev/rss.xml' },
  ]},
  // Flagged stale in the research (newest 2026-05-26). Included precisely so
  // "stale" is a measured verdict rather than an inherited note.
  { id: 'cssweekly', name: 'CSS Weekly', hosts: ['css-weekly.com'], excerptAggregator: true, sources: [
    { transport: 'rss', url: 'https://css-weekly.com/feed/' },
  ]},
];

/** B2. Link blogs and citational individuals matching the reader's profile. */
export const ADD_INDIVIDUALS = [
  // Interest #20 — software design writing, module boundaries, API design.
  // The roster has NO source for #20 at all.
  { id: 'martinfowler', name: 'Martin Fowler', hosts: ['martinfowler.com'], sources: [
    { transport: 'rss', url: 'https://martinfowler.com/feed.atom' },
  ]},
  { id: 'lethain', name: 'Will Larson', hosts: ['lethain.com'], sources: [
    { transport: 'rss', url: 'https://lethain.com/feeds/' },
  ]},
  // CUT, and the reason is a rule rather than a yield number (0 votes / 154
  // citations, so the yield agrees, but that is not why).
  //
  // Hillel Wayne's only feed address is `buttondown.com/hillelwayne` — a PATH on
  // a shared newsletter platform. `host -> publisher_id` is UNIQUE and keyed on
  // the host alone, so there are exactly two things this Publisher can declare
  // and both are wrong: claim `buttondown.com` and the next Buttondown
  // newsletter collides (silently disabling the self-citation guard for one of
  // them — the #6 negative-control bug), or claim nothing and the guard never
  // fires for him at all.
  //
  // This is the `rsshub.app` exclusion generalized: the map excluded that
  // Transport wholesale because "N Publishers behind one host would break the
  // `host -> publisher_id` UNIQUE rule the self-citation guard depends on." The
  // same sentence applies to any shared publishing platform reached by path.
  // Medium-hosted publishers are FINE by contrast — `netflixtechblog.com` and
  // `blog.angular.dev` are custom domains, one host each.
  // { id: 'hillelwayne', ... } — see docs/source-register.md §6.
  { id: 'danluu', name: 'Dan Luu', hosts: ['danluu.com'], sources: [
    { transport: 'rss', url: 'https://danluu.com/atom.xml' },
    { transport: 'bluesky-author', did: 'did:plc:2mrgzk6xlemfv6yugn644xxy' },
  ]},
  // Interest #16 — web platform features landing in browsers.
  { id: 'jakearchibald', name: 'Jake Archibald', hosts: ['jakearchibald.com'], sources: [
    { transport: 'rss', url: 'https://jakearchibald.com/posts.rss' },
  ]},
  { id: 'leaverou', name: 'Lea Verou', hosts: ['lea.verou.me'], sources: [
    { transport: 'rss', url: 'https://lea.verou.me/feed.xml' },
  ]},
  { id: 'stefanjudis', name: 'Stefan Judis', hosts: ['stefanjudis.com'], sources: [
    { transport: 'rss', url: 'https://www.stefanjudis.com/rss.xml' },
  ]},
  { id: 'nolanlawson', name: 'Nolan Lawson', hosts: ['nolanlawson.com'], sources: [
    { transport: 'rss', url: 'https://nolanlawson.com/feed/' },
  ]},
  // Interest #12 — React itself, its release cycle and ecosystem.
  { id: 'joshwcomeau', name: 'Josh Comeau', hosts: ['joshwcomeau.com'], sources: [
    { transport: 'rss', url: 'https://www.joshwcomeau.com/rss.xml' },
  ]},
  { id: 'danabramov', name: 'Dan Abramov', hosts: ['overreacted.io'], sources: [
    { transport: 'rss', url: 'https://overreacted.io/rss.xml' },
    { transport: 'bluesky-author', did: 'did:plc:fpruhuo22xkm5o7ttr2ktxdo' },
  ]},
  { id: 'sophiebits', name: 'Sophie Alpert', hosts: ['sophiebits.com'], sources: [
    { transport: 'rss', url: 'https://www.sophiebits.com/atom.xml' },
    { transport: 'bluesky-author', did: 'did:plc:lq6wgt3qcyog37cw65o5c277' },
  ]},
  // Interest #8 — the AI industry as a business.
  { id: 'baldur', name: 'Baldur Bjarnason', hosts: ['baldurbjarnason.com'], sources: [
    { transport: 'rss', url: 'https://www.baldurbjarnason.com/index.xml' },
  ]},
  // Bluesky-only, chosen on measured external-link density (#platforms 3.1),
  // not on follower count. All >=22%.
  { id: 'hynek', name: 'Hynek Schlawack', hosts: ['hynek.me'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:6k63663icgdybm5evgszxjn2' },
  ]},
  { id: 'crawshaw', name: 'David Crawshaw', hosts: ['crawshaw.io'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:sbgmax2bfm5dlje36qwvzuuq' },
  ]},
  { id: 'wesbos', name: 'Wes Bos', hosts: ['wesbos.com'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:etdjdgnly5tz5l5xdd4jq76d' },
  ]},
  { id: 'bradfitz', name: 'Brad Fitzpatrick', hosts: ['bradfitz.com'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:7r2fy3b4u7mmnhgbdxnflovv' },
  ]},
  { id: 'antirez', name: 'Salvatore Sanfilippo', hosts: ['antirez.com'], sources: [
    { transport: 'bluesky-author', did: 'did:plc:ipt7y6qaf6fn7oeeduboqe44' },
  ]},
];

/**
 * B3. Coverage holes against the reader's profile.
 *
 * These are added on RELEVANCE grounds, not Strength grounds — they are origin
 * blogs, and Run A established that origin blogs vote zero times by
 * construction (Strength excludes the origin, #9). What they buy is the `own`
 * text rung, which #21 measured as the best-scoring rung at 0.70. They are
 * expected to score badly on cites-per-vote and that is not a verdict on them.
 */
export const ADD_COVERAGE = [
  // Interest #13 — Vue 3 Composition API and the Vue ecosystem. The roster has
  // NOTHING for this, and it is one of only two framework Interests the reader
  // named by name.
  { id: 'vuejs', name: 'Vue.js', hosts: ['vuejs.org', 'blog.vuejs.org'], sources: [
    { transport: 'rss', url: 'https://blog.vuejs.org/feed.rss' },
  ]},
  { id: 'nuxt', name: 'Nuxt', hosts: ['nuxt.com'], sources: [
    { transport: 'rss', url: 'https://nuxt.com/blog/rss.xml' },
  ]},
  { id: 'antfu', name: 'Anthony Fu', hosts: ['antfu.me'], sources: [
    { transport: 'rss', url: 'https://antfu.me/feed.xml' },
  ]},
  // Interest #14 — Tailwind CSS v4. Also nothing in the roster.
  { id: 'tailwind', name: 'Tailwind CSS', hosts: ['tailwindcss.com'], sources: [
    { transport: 'rss', url: 'https://tailwindcss.com/feeds/feed.xml' },
  ]},
  // Interest #10 — developer tooling and build systems.
  { id: 'vite', name: 'Vite', hosts: ['vite.dev', 'vitejs.dev'], sources: [
    { transport: 'rss', url: 'https://vite.dev/blog.rss' },
  ]},
  // Interests #3, #6, #7 — lab research, open-weight models, OSS AI projects.
  { id: 'importai', name: 'Import AI', hosts: ['importai.substack.com', 'jack-clark.net'], sources: [
    { transport: 'rss', url: 'https://importai.substack.com/feed' },
  ]},
  { id: 'raschka', name: 'Sebastian Raschka', hosts: ['magazine.sebastianraschka.com', 'sebastianraschka.com'], sources: [
    { transport: 'rss', url: 'https://magazine.sebastianraschka.com/feed' },
  ]},
  { id: 'googleresearch', name: 'Google Research', hosts: ['research.google'], sources: [
    { transport: 'rss', url: 'https://research.google/blog/rss/' },
  ]},
  { id: 'mistral', name: 'Mistral AI', hosts: ['mistral.ai'], sources: [
    { transport: 'rss', url: 'https://mistral.ai/rss.xml' },
  ]},
  { id: 'ollama', name: 'Ollama', hosts: ['ollama.com'], sources: [
    { transport: 'rss', url: 'https://ollama.com/blog/rss.xml' },
  ]},
];

/**
 * B4. The press tier, on trial.
 *
 * `candidate-sources-rss.md` cut TechCrunch and The Verge "as noise" — high
 * volume, low external-citation-per-item — and that judgement was made before
 * cites-per-vote existed as a measurement. It is also made against a profile
 * that turns out to WANT them: Interest #8 is "the AI industry as a business —
 * funding rounds, valuations, acquisitions, executive moves, and lawsuits",
 * which #46 recorded the reader confirming, and which no other Publisher in the
 * roster covers. So they go on trial rather than staying cut on an inherited note.
 */
// ALL FOUR ACQUITTED THE RESEARCH'S JUDGEMENT AND ARE CUT. Kept here as the
// measured record, because "cut as noise" was an inherited note and is now a
// number. `ZIS_PRESS=1` re-runs the trial.
export const ADD_PRESS = [
  // 20 citations, **0 votes**. Cannot raise Strength at any volume: the feed is
  // an excerpt that barely links out. So Interest #8 — the AI industry as a
  // business, which #46 recorded the reader confirming they want — has no
  // voting supplier in the register, and admitting TechCrunch would not give it
  // one. Recorded as a hole rather than filled with a Publisher that cannot vote.
  { id: 'techcrunch', name: 'TechCrunch', hosts: ['techcrunch.com'], sources: [
    { transport: 'rss', url: 'https://techcrunch.com/feed/' },
  ]},
  // 30 citations, **0 votes**. Same shape.
  { id: 'theverge', name: 'The Verge', hosts: ['theverge.com'], sources: [
    { transport: 'rss', url: 'https://www.theverge.com/rss/index.xml' },
  ]},
  // 783 citations, 2 votes — **391.5 cites per vote**, the worst ratio in the
  // whole corpus bar Dan Luu. Interest #16 is already the densest neighbourhood
  // in the register (Bramus, Rachel Andrew, Lea Verou, Stefan Judis, CSS Weekly,
  // Web Tools Weekly), so this buys redundancy on top of redundancy.
  { id: 'smashing', name: 'Smashing Magazine', hosts: ['smashingmagazine.com'], sources: [
    { transport: 'rss', url: 'https://www.smashingmagazine.com/feed/' },
  ]},
  // 40 citations, 0 votes.
  { id: 'stackoverflow', name: 'Stack Overflow', hosts: ['stackoverflow.blog'], sources: [
    { transport: 'rss', url: 'https://stackoverflow.blog/feed/' },
  ]},
];

/**
 * B5. Sources that attach to an EXISTING Publisher rather than creating one.
 *
 * This is the `host -> publisher_id` UNIQUE rule doing its job at curation time
 * instead of at schema time. CSS-Tricks is not a new voice: `chriscoyier` already
 * declares `css-tricks.com` among its hosts, so adding the CSS-Tricks feed as a
 * new Publisher would register a duplicate host and silently disable the
 * self-citation guard — the exact bug the #6 negative control found with GitHub.
 */
export const ADD_SOURCES_TO_EXISTING = [
  { publisherId: 'chriscoyier', source: { transport: 'rss', url: 'https://css-tricks.com/feed/' } },
  // Julia Evans is already in the roster on both transports; nothing to add.
  // Simon Willison stays on exactly ONE feed (`everything`) — `links` and
  // `entries` are subsets and would double-count one voice, which the research
  // flagged and which the Cooper Press question above is the general form of.
];

export const ALL_ADDITIONS = [
  ...ADD_AGGREGATORS,
  ...ADD_INDIVIDUALS,
  ...ADD_COVERAGE,
  // The press tier is behind a flag because it was measured and REFUSED. Left
  // runnable so the refusal can be re-tested rather than re-argued.
  ...(process.env.ZIS_PRESS === '1' ? ADD_PRESS : []),
];

/** Which additions belong to which group, for the per-group report. */
export const ADDITION_GROUPS = {
  aggregators: ADD_AGGREGATORS.map((p) => p.id),
  individuals: ADD_INDIVIDUALS.map((p) => p.id),
  coverage: ADD_COVERAGE.map((p) => p.id),
  press: ADD_PRESS.map((p) => p.id),
};
