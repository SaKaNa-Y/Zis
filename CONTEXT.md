# Zis

A personal, single-user, bounded daily brief of what actually mattered in tech.
Sources are polled on a fixed schedule into a global corpus; URL co-citation
detects which stories many independent voices converged on; an explicit interest
model decides which of those reach the reader. Not an RSS reader. Not an inbox.

## Language

### Ingestion

**Publisher**:
A single owning voice on the web — an organization, a person, or a community —
regardless of how many accounts or feeds it speaks through. Vercel's GitHub
releases, YouTube channel, and Bluesky account are one Publisher.
_Avoid_: Entity, Voice, Outlet, Actor

**Source**:
One configured pollable endpoint belonging to a Publisher. A Publisher may have
many Sources; "HN top stories" is one Source, "Show HN" is another.
_Avoid_: Feed, Account, Channel

**Transport**:
Which protocol a Source is polled over — RSS, the HN Firebase API, GitHub
GraphQL, a Bluesky feed. A property of a Source, never a thing in its own right.
_Avoid_: Adapter (that is the code implementing a Transport, not a domain term)

**Aggregator**:
A Source whose Items exist to cite other people's work rather than to carry their
own — a newsletter issue or a link roundup. Its value to the corpus is the list of
addresses it points at, which is why an Aggregator whose Items are excerpts must
have the cited list recovered before those Citations exist at all. A Publisher may
speak through both Aggregator and ordinary Sources.
_Avoid_: Newsletter, Roundup, Digest (that is the delivery of a Brief), Curator

**Dormant**:
A Source that answers correctly and has published nothing for a long time.
Deliberately distinct from a failing Source: a Publisher's silence is not a fault,
so a Dormant Source is surfaced for a human to judge rather than treated as
broken. A Source can be Dormant indefinitely and still be worth keeping.
_Avoid_: Dead, Stale, Inactive, Broken (a Source that errors is failing, not
Dormant — the two are different signals with different consequences)

**Unverifiable**:
A host whose crawling policy cannot be read at all, because the policy file
itself is behind a bot defence. Deliberately distinct from a host that forbids
crawling: one has stated a rule, the other has stated nothing, and recording the
second as the first invents a rule that does not exist. A Source none of whose
fetched hosts can answer is not excluded and not in — it is Unverifiable, and so
not a Source for now. The state belongs to a **host**, never to a Publisher: one
Publisher can own an answering host and an Unverifiable one at the same time.
_Avoid_: Blocked, Excluded, Ambiguous (that is what one unreadable *response* is,
not what the host becomes), Pending

**Item**:
One normalized unit fetched from a Source — a blog article, a release, a forum
thread, a social post, a video. Deliberately generic, because the corpus is
genuinely heterogeneous.
_Avoid_: Article, Post, Entry, Story, Document

### Clustering

**Link**:
One address on the web after canonicalization, existing independently of whether
anything was ever ingested from it. A Link may be cited by many Items and never
be an Item itself.
_Avoid_: CanonicalUrl, Url, Target, Reference

**Citation**:
An Item pointing at a Link — either at its own address (`self`) or at one it
links out to (`outbound`). Citations are the provenance record: which Source,
first seen when, via which raw address. They are also the explanation of why
something surfaced.
_Avoid_: Mention, Reference, Occurrence

**Signal**:
A cluster of Links judged to be one story. A Signal of a single Link cited by a
single Publisher is an ordinary Signal, not a special case. Signals are merged
into one another, never deleted.
_Avoid_: Cluster, Story, Thread

**Strength**:
How many distinct **Publishers** cite a Signal's Links. Never a count of
Citations, Items, or Sources — one loud voice must not be able to manufacture
agreement with itself.
_Avoid_: Score, Mentions, Popularity

**Text Basis**:
Which rung of available text a Signal was embedded from — its own ingested title
and summary, the concatenated titles of the Items citing it, or its URL slug.
Most Signals have no ingested Item of their own, so the rung is recorded rather
than assumed, and a Signal is re-embedded when its rung improves.
_Avoid_: Source text, Content, Excerpt

**Tag**:
An extracted label attached to an Item or a Signal, used to explain and to
retrieve. A Tag is not something a reader follows; relevance comes from the
Interest Profile.
_Avoid_: Entity, Topic, Keyword, Category

### The brief

**Brief**:
One reader's dated, ranked selection of Signals. Persisted rather than computed,
so that what was shown on a given day remains answerable and so that every
rendering of it is provably the same brief. A Brief is **sealed**: once cut it
never changes, so a reader can be finished with it. A story that grows after the
cut leads a later Brief; it does not reopen this one. A Brief may honestly hold
very few Signals, and says so when it does.
_Avoid_: Digest (that is the delivery of a Brief by email, not a second thing),
Feed, Edition

**Brief Entry**:
One Signal's place in a Brief, carrying its position and the frozen text
explaining why it surfaced. A Signal has at most one Brief Entry for a given
reader, ever: it is never shown twice, whether or not it was read.
_Avoid_: Slot, Card, Story

**Admission**:
Why a Signal earned its place in a Brief — because one of the reader's Interests
matched it, or because enough Publishers converged on it without one. Every Brief
Entry records which, and the two are the only ways in. Admission is decided by
absolute tests a reader could check by hand; there is no score and no fixed
number of places to compete for.
_Avoid_: Lane, Slot, Quota, Rank, Score

### The reader

**Interest Profile**:
The complete set of a reader's Interests. The product's relevance mechanism —
there is no second one.
_Avoid_: Preferences, Filters, Topics

**Interest**:
One free-text statement of something the reader cares about, held in their
Interest Profile. Each Interest stands alone: a Signal is relevant if it matches
any single Interest, and the Interest it matched is the reason the Signal
surfaced. A menu of suggested wordings may help a reader write one, but a
suggestion becomes an ordinary Interest the moment it is taken — nothing records
that it came from a menu, and nothing a reader did not choose to keep survives.
_Avoid_: Topic, Keyword, Preference, Filter, Tag

**Bookmark**:
A Signal the reader has saved to return to.
_Avoid_: Save, Star, Favorite, Read Later

**Read State**:
Whether a reader has read a Signal. Attaches to the Signal, not to the day it
appeared, so a story already seen stays seen when it recurs.
_Avoid_: Seen, Unread, Status

## Terms this project does not use

- **Entity** — ambiguous between an owning voice and an extracted label. Use
  **Publisher** or **Tag**.
- **Topic** — implies a followable subject, a second relevance mechanism
  competing with the **Interest Profile**. Use **Tag** for labels.
- **Digest** — reserved for email delivery of a **Brief**, never for the thing
  itself.
- **Article** — lies about releases, threads, posts, and videos. Use **Item**.
- **Unread count** — deliberately absent from the product; do not model one.
- **Slot** / **Quota** — imply a fixed number of places competing to be filled,
  which is a top-N cut and would license padding. A Brief holds however many
  Signals cleared the bar. Use **Brief Entry** and **Admission**.
- **Score** — no single number ranks a Signal; admission is a conjunction of
  absolute tests. Use **Strength** for convergence and **Admission** for why
  something surfaced.
