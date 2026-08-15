# 09 — Design the information architecture and UI

Type: prototype
Status: open
Blocked by: 04

## Question

The product is a **bounded daily brief**, and the UI has to make that feel like
confidence rather than scarcity. Prototype it — this is a "how should it look"
question, so build rough screens rather than discuss them.

**Hard constraints** (from the map's Notes — the prototype must not violate
these, and if it wants to, that's a finding worth reporting):

- No unread counts, anywhere.
- No infinite scroll.
- No "Everything" escape hatch.
- Responsive: phone and desktop, same app.
- Every route behind auth; **no public landing page at all**.

**Design questions:**

1. **Navigation.** The charting session's sketch was Home / Discover / Following
   / Topics / Saved / AI. Under a bounded-brief model, most of that may be
   unnecessary — Discover and Following in particular presuppose a subscription
   model that doesn't exist in v1. What's the minimum that serves the actual
   product? Argue for the smallest nav that works.
2. **The brief.** How does a Signal render? It needs: title, AI summary, the
   contributing Sources with their icons, the why-it-surfaced explanation, and
   links out. A 4-source cluster and a 1-source notable single must be visibly
   *different kinds of thing* without one looking like a degraded version of the
   other.
3. **Source icons.** Favicons per source, fetched once, cached. Design the
   fallback for sources with no usable icon (generated letter-mark). Show how a
   multi-source cluster displays its contributors compactly.
4. **Images.** Text-first. Optional thumbnail. **"No image" is the common case
   and must be the default layout, not a broken state.**
5. **Yesterday.** What does looking back at previous briefs feel like? An
   archive is *not* an infinite feed — dated, discrete, finite. This is where
   Ticket 04's "is the brief a persisted entity" question shows up in the UI.
6. **Interest profile editing.** A text area is the honest interface for free
   text. Where does it live, and does the user see the effect of an edit
   immediately or only on tomorrow's brief?
7. **antfu/design** — the user wants to try this design language. Evaluate
   whether it fits a text-dense brief; report honestly if it doesn't.

Deliverable: a throwaway prototype (static HTML or a scratch Next.js route),
mobile and desktop layouts, plus a written IA decision listing the nav items
that survived and why the rest were cut.
