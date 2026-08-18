# A presentation control must change neither which information renders nor its order

Status: accepted

Settled by
[Decide whether the reader can customize the Brief's layout](https://github.com/SaKaNa-Y/Zis/issues/23).

Settings holds a light / dark / match-system control today
([`ui-and-ia.md` §8](../ui-and-ia.md)), so "the layout is the product's opinion"
cannot be the rule — appearance is already reader-adjustable. The rule is
narrower, and it is a test rather than a verdict:

**A reader-facing presentation control is admissible only if it changes neither
which information is rendered nor the order it is rendered in.**

The theme passes because dark mode redefines seven semantic tokens and touches no
markup — there is not one `dark:` utility in the design, which is what makes
light/dark parity structural. Every layout control that has been proposed fails,
and the failures are not near misses:

- **Hiding the why-text** removes information, and specifically *the* information:
  under ADR-0003 the matched Interest **is** the explanation. It also disables the
  feedback loop that sharpens a vague Interest (#14) by keeping it visible.
- **Collapsing or hiding the `convergence` register** removes information, and
  removes exactly the entries the reader did not ask for — silently opting them
  out of the filter-bubble puncture that route exists to be (#9).
- **Density / compact mode** changes the type scale, which is two typographic
  systems to hold in light/dark parity against a measure #10 fixed at ~60ch.
- **Reader-settable entry order** changes the order, and is refused at the glossary
  level rather than on preference: `CONTEXT.md` defines a Brief as persisted "so
  that every rendering of it is provably the same brief", and `BriefEntry` freezes
  `position` (#5). Two renderings of one sealed Brief may not differ.
- **Turning off the wide-screen zones.** Milder for the `lg` rail, which is pure
  chrome — but a toggle that hides it leaves a desktop reader with no destinations,
  which is a navigation bug wearing a preference. The `xl` marginalia gutter
  *moves* the why-text out of the flow and the `2xl` aside is where #10 argues a
  contents list renders the boundary of a sealed artefact, so both fail outright.

The surviving candidate set is **empty**. That is the finding — the null answer is
what the test produces, not a deferral dressed up as one.

**The control readers actually want is text size, and the platform already ships
a better one.** Every size in the design is `rem` or `ch`, so browser zoom and OS
root-font-size scale the type **and** the 33rem measure together, holding the line
at ~60ch. A Zis-owned font-size control would break that coupling — it would grow
the type inside a fixed measure, which is the one thing #10 identified as the
highest-leverage decision on a reading surface.

## Consequences

- **No Layout section in Settings.** It is removed rather than left empty: #10
  states "a reading view is unavailable, not unwanted" in the spec document and
  not on the screen, and this follows that precedent. A control panel advertising
  its own emptiness is noise for a single reader who already knows.
- **No layout preference is stored anywhere** — neither the per-device cookie #10
  chose for the theme nor a `User` column. The cookie-vs-row question dissolves
  because there is nothing to store.
- **No `px` in type size, line-height, spacing, or the measure.** This is what the
  text-size answer rests on, it is currently true by accident, and one
  `text-[17px]` breaks zoom silently on a surface with no test that would notice.
  `px` remains permitted for hairline borders, which should *not* scale with zoom.
  Enforced as a CI invariant, not by review — the same reasoning that made #7's
  egress rule a lint rule, and it must ride the explicit CI step #15's finding
  already forces (`next lint` is removed in Next.js 16).
- **Adjustability is answered by the platform, not by Settings.** The seven
  semantic tokens must survive `forced-colors` and honor `prefers-contrast`. This
  is the accessibility half of the question and it costs no schema, no cookie, and
  no new preference state. (`prefers-reduced-motion` is moot; there is no motion.)
- **The state matrix does not multiply.** Short × empty × archive stays the
  full set of Brief states, with no per-reader surface variants crossed into it.
- **The test is the reopening condition.** A control that changes neither which
  information renders nor its order may be proposed against a later Phase. Nothing
  else listed above is licensed by that, and a proposal that ships one control
  retires this test permanently — which is the asymmetry that makes this an ADR
  rather than a preference.
