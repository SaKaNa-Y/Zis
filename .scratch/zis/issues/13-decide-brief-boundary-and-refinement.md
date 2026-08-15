# 13 — Decide the brief's boundary and refinement layer

Type: grilling
Status: open
Blocked by: none

## Question

Graduated out of fog by the prior-art research
([rss-reader-prior-art.md](../research/rss-reader-prior-art.md)), which
contradicted two things the charting session treated as settled. Both are about
the same underlying issue: **what makes the bound real, and what makes the
clusters good enough to fill it.**

### Part 1 — the digest is the boundary, not a delivery channel

The map filed digest delivery under *Not yet specified*, "blocked on nothing
except attention." The evidence says that understates it.

Every product that successfully holds a bounded output ships a **finished
artefact**: Readwise Daily Digest (20–25/day), Brief Digest (one LLM briefing),
Digest (one email at a chosen time), TLDR (8–15 items). Products that bound only
the *interaction pattern* — Electric Pants, Newsfeed — do not actually cap
volume; if 300 items arrive you still face 300.

A web page with a bounded view is a **promise** of boundedness. A sent email is a
**structural** boundary.

Settle:

1. Is the daily digest the **primary artefact**, with the web app a view onto it?
   Or is the web app primary with email as a convenience?
2. Is a brief **sealed** once sent? If the 3pm crawl finds something big, does
   today's brief change, or does it wait for tomorrow? Sealing is what makes
   "finished" mean anything; not sealing makes the brief a live feed with a cap.
3. **May the brief be honestly short?** 5–10/day is below every documented
   precedent, so thin days are the real risk. Three items on a quiet Tuesday, or
   pad to a fixed count? The map's bias is never pad — confirm or overturn it.
4. What replaces the unread count as an orientation signal? Reeder removed counts
   and replaced them with synced timeline position — it did not leave nothing.
   The dated brief is a stronger answer, but only if it is complete-in-itself.
5. Adopt the **"All Caught Up" completion ritual**? Electric Pants treats
   finishing as "a satisfying moment most apps deliberately hide from you."

### Part 2 — who refines the clusters

Techmeme runs this exact algorithm with **3 full-time and 23 part-time editors**
on top, and has since 2008. memeorandum is the same engine unedited, and its
documented failures are: duplicate clusters that never merge, stale items
lingering at the top, thin clusters elevated by correlated bursts, and headlines
carrying the source's spin.

The raw engine was never bad — it "handled duplicates well and picked up related
stories even without links." **The editors are a refinement layer, not a
rescue.** But at 5–10 slots/day, one unmerged duplicate is a 10–20% quality
regression.

Pick an owner for that layer — this must be decided **before Ticket 05**:

- **(a) LLM adjudication.** The naming/summarising pass does double duty: given
  candidate clusters, it decides merge/split. Cheap (it is already being called),
  but non-deterministic and it re-introduces the LLM into detection, which the
  map's invariant deliberately excluded. Does adjudication over *candidates*
  violate that invariant, or respect it?
- **(b) Interest-profile filtering.** Relevance does the pruning; a duplicate
  that fails the interest filter never surfaces. Free, but does nothing about
  duplicates that *are* relevant — arguably the worst case.
- **(c) The user.** One-click merge / kill / "not interesting" on the brief.
  Honest, deterministic, and at one user the volume is trivial. But it makes the
  product require maintenance, and the whole premise is reducing effort.
- **(d) Deterministic rules only** — temporal decay plus burst suppression plus
  source-diversity requirements, no adjudicator at all.

Note (c) and (d) compose well, and the four failure modes above are the
**acceptance criteria** for whatever is chosen — Ticket 05's prototype should be
judged against them explicitly.

### Part 3 — the standing assumption to record

Nuzzel got relevance free from the follow graph. Zis has no graph, so
co-citation count alone measures general tech salience — the thing Techmeme
already publishes. The interest profile is what bridges that gap, which makes it
**load-bearing rather than a nice-to-have**.

Feedly's Leo is the cautionary case: it works for users who trained it and
disappoints those who did not. Confirm the assumption explicitly, because if it
is false the product degrades into a worse-latency Techmeme: **the user is
willing to write and maintain an interest profile.**

Deliverable: answers to Parts 1 and 2 written up, the assumption in Part 3
confirmed or challenged, and the four memeorandum failure modes recorded as
acceptance criteria on Ticket 05.
