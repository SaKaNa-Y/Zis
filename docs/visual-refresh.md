# Visual refresh

The approved direction uses the official [Vite+ website](https://viteplus.dev/)
as its color reference: white, near-black and violet. The earlier teal proposal
is superseded. This implementation applies the approved Today design to the
whole reading product, without changing its information architecture.

## Shared visual system

- `globals.css` owns semantic light/dark/system colors, typography and controls.
  `product.css` owns the framed reading canvas, violet accents and responsive
  layouts. Both are loaded once by the root layout.
- `destinations.tsx` provides the shared brand, five-destination top navigation
  and mobile footer from a single route definition. The selected route
  is exposed through `aria-current`.
- Today and dated Briefs retain a bounded text measure, numbered entries and
  an explanation gutter on wide screens. Narrow screens stack the explanation
  below the summary and retain the native Actions disclosure.
- Earlier, Saved, Interests, Settings, provenance and reader access use the
  same palette, borders and type hierarchy. Loading, error and unavailable-page
  presentations share the shell. High contrast and forced colors remain
  supported; no motion is introduced.
- The provenance table is a focusable horizontal scroll region on narrow
  screens. Forms retain visible labels, focus outlines and pending feedback.

## Product contracts retained

All UI copy remains English. The destinations remain Today, Earlier, Saved,
Interests and Settings. Titles link to their original sources, why text links
to provenance, and sealed Brief explanations remain historical snapshots.
Short and empty Briefs remain deliberate; no unread count or browse-all feed
is added. Save/Read, Saved removal/Undo, Interest editing, account controls
and appearance persistence use their existing handlers.

No authentication, data access, ingestion, schema, dependency or deployment
files are changed. Browser QA uses a separate synthetic fixture checkout;
its authentication bypass and stub services are never part of this change.
The production build and full test suite run against this source checkout.

This refresh supersedes the older visual treatment in `ui-and-ia.md` while
preserving its product semantics and ADR-0009. Deployment and production data changes are outside this visual refresh.
