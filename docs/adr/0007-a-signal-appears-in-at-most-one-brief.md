# A Signal appears in at most one Brief, read or not

Status: accepted

`CONTEXT.md` says a story that grows after the cut "leads a later Brief", and that
Read State "stays seen when it recurs". Read together they suggest recurrence is
normal and suppressed only by having been *read*. **It is not: a `BriefEntry`
exists for at most one `(user_id, signal_id)` pair, ever, whether the reader read
it or not.**

The alternative — recurrence suppressed by Read State alone — is an unread count
with extra steps. A Signal the reader deliberately skipped returns every morning
until they tap it, the "all caught up" state becomes unreachable by any action
except capitulation, and the product has rebuilt the mechanic it exists to delete.

Under this decision "leads a later Brief" reads as *a Signal not yet in any Brief
that grows into eligibility*, which is what #14 actually needed and what ADR-0004
already guarantees by removing the cluster-formation window: a story that gains its
third Publisher on Friday competes for Friday's Brief.

Read State then does the smaller job `CONTEXT.md` gives it — suppressing a Signal
the reader already met through Bookmarks or the archive rather than through a
Brief.

## Consequences

- Uniqueness on `(user_id, signal_id)` in `brief_entry`, enforced at the schema
  level rather than by the cut query's discipline.
- A Signal has exactly one chance, so the 7-day eligibility cutoff is the window
  in which it must clear a bar or be lost. This is what makes re-embedding on
  `text_basis` improvement worth doing rather than academic: a Signal first seen
  as a bare URL gets a real relevance evaluation within its one window.
- The archive, not tomorrow's Brief, is where a reader finds something they
  skipped.
