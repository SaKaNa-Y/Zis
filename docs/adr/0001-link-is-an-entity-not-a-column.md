# A cited URL is an entity, not a column on Item

Status: accepted

The obvious model puts a `canonical_url` column on Item and clusters by grouping
Items on that value. We rejected it: **a Link must exist whether or not anything
was ever ingested from it.** The case that forces this is an announcement cited
by five or six sources whose publisher runs no feed at all — the origin URL never
becomes an Item, so a column-based model has no row to group on and the strongest
cluster of the day silently fails to form. Zis therefore models `Link` as a
first-class record, with `Citation` joining Items to Links.

## Consequences

- A Link is also the only sensible home for state the URL itself carries: the
  resolved redirect chain, whether the publisher declared `rel=canonical` (and
  whether by header or tag), first-seen time, URL-validator verdict, and the
  alias addresses that collapsed into it.
- `Citation` doubles as the provenance record, so the clustering table and the
  "why this surfaced" explanation are the same table — collapse duplicates,
  never delete them.
- Clustering keys on the **cited** URL, not on URLs Zis happens to have
  ingested. Any future change that reintroduces "group the Items we have" is a
  regression of this decision, not an optimization.
- Reversal cost is high: it is the join key for the product's differentiating
  feature, so unwinding it means rewriting ingestion, clustering, and
  explainability together.
