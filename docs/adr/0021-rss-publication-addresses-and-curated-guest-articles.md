# ADR-0021 — Separate RSS publication addresses from outbound links

**Status:** Accepted, 2026-09-05. Owner decision during [#91](https://github.com/SaKaNa-Y/Zis/issues/91).
**Amends:** ADR-0015's host-only register and ADR-0020's refusal of exact-address
ownership assertions, only for explicitly curated guest articles in the existing
source register. Shared hosts still belong to at most one Publisher.

The first populated production corpus exposed three distinct cases. CSS Weekly
puts a FeedPress tracking address in `link` and its own permalink in `guid`.
Console's RSS contains its own tool reviews but links directly to the reviewed
projects. Josh Comeau's RSS includes his guest article on Smashing Magazine;
the [article's byline](https://www.smashingmagazine.com/2022/05/you-dont-need-ui-framework/)
identifies Josh. Treating every RSS link as an Item's publication address either
blocks these valid Sources or falsely attributes somebody else's entire host.

The owner chose to retain the Sources and distinguish the utterance from its
Citation, rather than exclude the affected data:

- A publisher-owned RSS GUID declared a permalink may replace an off-host link.
  `isPermaLink="false"` and Atom IDs do not establish publication addresses.
- Only a Source explicitly marked `itemLinkRole: outbound` in the register may
  treat its link as an outbound Citation. Its Item has no separate URL; its title
  anchors the Citation. External identity remains stable across this correction.
  The registered Publisher must still own the Source's asserted host.
- The register may assert an exact canonical guest-publication URL for a
  Publisher, based on verified authorship. This grants no host or path-prefix
  ownership. Stage 0 requires the configured author Source and Publisher; the
  Strength guard uses the same exact assertion on the Signal target, so the
  author cannot vote on their own guest article, including via an alias.
  The outbound Citation filter also drops the author's link to that exact guest
  article, extending ADR-0020's host-based intra-Publisher filter by the same
  curated assertion. Other Publishers' outbound Citations remain eligible.

No ownership is inferred from arbitrary feed links, author strings, GUIDs marked
as opaque, or domain similarity. Unknown external publication addresses still
fail Stage 0. The initial assertion is solely Josh's named article; future guest
articles require explicit curation in the register. These rules introduce no
new Source, Publisher, admission threshold, or density target.

Production backfill must preserve Items and Citation provenance, run atomically,
and refuse to rewrite a corpus that already has a Brief. The reviewed one-off
script repairs the 24 tracking addresses and 6 review Citations observed before
the first successful cut. Josh's Item address needs no data rewrite.
