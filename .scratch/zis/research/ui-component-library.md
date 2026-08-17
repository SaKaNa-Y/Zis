# UI component library — research for #15

Resolves [#15](https://github.com/SaKaNa-Y/Zis/issues/15). Unblocks
[#10](https://github.com/SaKaNa-Y/Zis/issues/10).

**Date of research: 2026-08-17.** Every version number below was read from the npm
registry or a shipped tarball on that date, not from memory. Where a claim could
not be verified against a primary source it is labelled **UNVERIFIED** or
**ASSUMPTION**, following the precedent set by #2's Reddit finding.

**Method, so its limits are legible.** Claims come from four kinds of primary
source: (a) `registry.npmjs.org` metadata, (b) **the shipped tarballs**, unpacked
and grepped, (c) official documentation sites, (d) the projects' own GitHub repos
and issue trackers. **No Next.js 16 app was built against any candidate.** So
every "server-renderable" claim is an artifact-level claim about where
`"use client"` sits in the published files, not a runtime observation. That is a
stronger source than a docs page — twice below the tarball contradicts the docs —
but it is not the same as a build.

---

## Recommendation

**No component library enters Phase 0. Tailwind v4 and nothing else.**

Not "no library for now, add one when it hurts" as a deferral — the inventory
below is *finished*. Zis's rendering surface is fully enumerated by closed
tickets, and it contains **no widget that a component library is for**. The
interactive surface is a passphrase field, a set of textareas, and a handful of
buttons that submit Server Actions. Everything else is text and links.

Three concrete sub-decisions that follow, each argued below:

1. **No headless primitive either — not even one.** Not Radix, not Base UI. The
   one plausible need (a confirm dialog for #14's kill action) is covered by
   native `<dialog>`, which is Baseline Widely available since March 2022
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog))
   and therefore *already inside* Next.js 16's own stated browser floor of
   Chrome/Edge/Firefox 111+ and Safari 16.4+
   ([Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)).
   A ranked escape hatch is specified at the end.
2. **No `next-themes`.** Verified trap; details in §6. The theme is a
   server-rendered class on `<html>`, which Zis can do and a normal app cannot,
   because every route is auth-gated and there is no public landing page.
3. **No typography plugin, and this is where the ticket's own premise breaks.**
   Both `@tailwindcss/typography` and the new `shadcn/typeset` are verified
   working on Tailwind v4 — and **neither has a job in Zis**, because under
   ADR-0005 and #7 there is no HTML-you-don't-control anywhere in the product.
   §7.

The single strongest argument *for* shadcn/ui is that its registry is a good
place to **read** code. That survives the recommendation intact: the registry is
public JSON over HTTP and needs no install (§2.4). Reading it is free. Running
`init` is not, and no longer means what the ticket says it means (§2.2).

---

## 1. What Zis actually renders

This is the load-bearing section. Every other section is scored against it.

Assembled from #1's Notes, #10's design questions, #14, #17, #9, ADR-0005 and
`CONTEXT.md`. Terms are used as `CONTEXT.md` defines them.

### 1.1 The reading surface

**The Brief page** — the product. Contains:

- The **date**. #14: orientation is the date, and there are no counts in any
  disguise.
- Between ~3 and ~12 **Brief Entries** (#14's hard-coded ceiling, which never
  appears in the UI), and **often fewer**. #14: a Brief "may be honestly short
  and say so". #9 targets a trailing-14-day median of ≥5 entries, which means
  half of all days land at or below five.
- Each **Brief Entry** is, exhaustively (#17): a title, an AI summary, a
  **Publisher** name, the frozen matched-Interest why-text, and a link out.
  #9 adds that the why-text shows origin-excluded **Strength** with the origin
  labelled separately, and names only the argmax **Interest**.
- **No images. At all.** No thumbnail, no favicon, no **Source** icon (#17).
  There is no image loading state, no broken-image state, and no
  image-vs-no-image layout fork.
- An explicit **"all caught up"** state (#14).
- Two visibly different kinds of **Admission** — `interest` and `convergence`
  (#9) — which #10 requires read as different *kinds of thing*, neither looking
  like a degraded version of the other.

**The archive.** Dated, discrete, finite — a list of past Briefs, each a link.
Not a feed: no infinite scroll, no unread counts, no "Everything" tab (#1).

That is the entire reading surface. Its widget inventory is: **headings,
paragraphs, a list, and anchors.**

### 1.2 The interactive surface

Every item here, with what it needs:

| Thing | Where it's settled | Honest implementation |
|---|---|---|
| Login: one passphrase field + submit | #4, #1 | `<form>` + Server Action |
| **Interest** statements: add / edit / remove, ~200 chars each, ~10–20 of them | ADR-0003, #14 | `<form>` + `<textarea>` + Server Actions |
| Brief size, inside a ceiling that never appears in the UI | #14 | native `<select>` or radios. **Explicitly not a free number input** — #14 says that is how the invariant dies |
| One-click merge / kill (the correction loop) | #14 | `<button>` + Server Action; optional native `<dialog>` confirm |
| **Bookmark** toggle | #5 | `<button>` + Server Action |
| **Read State** toggle | #5 | `<button>` + Server Action |
| Nav, phone and desktop | #10 | links; a `<details>` or a checkbox for a mobile drawer |
| Dark mode | this doc §6 | server-rendered class + Server Action |

**Count of items on that list that need a component library: zero.** Count that
need client-side JavaScript state at all: arguably one, the mobile nav, and
`<details>` covers even that.

Note the structural reason this is not a coincidence. Server Functions POST to
the route they are used on (#4's finding), and `verifySession()` is the auth
boundary — so the natural idiom for every mutation in Zis is already a plain
`<form>` posting to a Server Action on a server-rendered page. A component
library's value is concentrated in exactly the widgets Zis does not have:
comboboxes, date pickers, data tables, multi-step wizards, toasts, command
palettes, sheets, carousels.

### 1.3 The state that gets rendered most

Worth flagging for #10 and #21. Given #9's median-of-five target and #14's
licence to be honestly short, **the short Brief and the "all caught up" state
are not edge cases — they are among the most-rendered states in the product.**
#1's "Not yet specified" lists empty and error states as still dim. They should
be designed *first*, not last, and no component library helps with either.

---

## 2. shadcn/ui

### 2.1 Current state, verified

| Fact | Value | Source |
|---|---|---|
| CLI latest | `shadcn@4.18.0`, published **2026-08-13** | [registry](https://registry.npmjs.org/shadcn) |
| Repo | `shadcn-ui/ui`, 121,462 stars, **2,293 open issues**, pushed 2026-08-13 | GitHub API |
| Release cadence | 4.15.0 → 4.18.0 in 19 days | [releases](https://github.com/shadcn-ui/ui/releases) |

Actively developed, no question. Two things about it have changed since the
ticket was written, and both change the decision.

### 2.2 CORRECTION: shadcn is no longer "a copy-in generator, not a dependency"

The ticket's framing — "It is a copy-in generator, not a dependency, which
matters" — was true and is now false.

From the [CLI docs](https://ui.shadcn.com/docs/cli), on the `eject` command:

> `"inline shadcn/tailwind.css and remove the shadcn dependency"`

and, describing what `init` does:

> init adds `@import "shadcn/tailwind.css"` to global CSS, supplying shared
> Tailwind v4 utilities like `data-open:` variants and accordion animations

So `init` installs the `shadcn` package **as a project dependency** and imports a
stylesheet out of `node_modules`. Verified in the tarball: `shadcn@4.18.0`
exports `"./tailwind.css" -> "./dist/tailwind.css"`, a **16,041-byte** file whose
content is `@theme inline` accordion keyframes and `@custom-variant data-open`
declarations. Zis has no accordion.

`eject` exists to undo this, and the docs warn: **`"This action is
irreversible."`**

**This lands directly on #7's security model.** `shadcn@4.18.0` declares **33
dependencies**, and the list includes **`undici`**, plus `execa`, `socks`,
`open`, `@babel/core`, `ts-morph` and `@modelcontextprotocol/sdk` (read from the
tarball's `package.json`). #7's settled rule is a **lint rule banning `fetch` and
`undici` outside one `safeFetch` module, with no exemption list**. A lint rule
scans source, not `node_modules`, so **CI would not break** — but the trade is
still bad on its face: 33 transitive packages including an HTTP client and a
SOCKS proxy library, admitted into the dependency tree of a security-conscious
single-user app, to obtain a 16 KB CSS file of animations for components it does
not have. Route to **#12** as a dependency-policy note.

### 2.3 CORRECTION: the default base is Base UI, not Radix

The ticket asks whether "the Radix primitives underneath are React 19-clean". As
of July 2026, Radix is not underneath by default.

From the [changelog](https://ui.shadcn.com/docs/changelog):

- July 2026, *React Aria*: **"Base UI remains the default, and Radix remains
  fully supported."** React Aria became **"a first-class component base in
  shadcn/ui"**, selectable with `--base aria`.
- July 2026 also carries a *"Base UI as the Default"* entry.
- February 2026 carries a *"Unified Radix UI Package"* entry.

Confirmed in the CLI's own flag documentation:

> `"-b, --base <base>          the component library to use. (base, radix, aria)"`

And confirmed in the **live** `components.json` schema at
<https://ui.shadcn.com/schema.json>, whose `style` enum now holds 26 values:
`default`, `new-york`, and `{base,radix,aria}-{vega,nova,maia,lyra,mira,luma,sera,rhea}`.

Note the [`components.json` docs page](https://ui.shadcn.com/docs/components-json)
is **stale relative to that schema** — it documents `style` as `new-york`, lists
`baseColor` values, and documents no base selection at all. Where the docs and
`schema.json` disagree, `schema.json` is the machine-read artifact.

So the ticket's Radix question is now a question about **an opt-in base**. It is
still worth answering, and the answer is interesting (§3.1).

### 2.4 Is shadcn verified working on Next.js 16 / React 19 / Tailwind v4?

Split, because the three parts have different answers.

**Tailwind v4 and React 19: yes, and long since.** The
[Tailwind v4 page](https://ui.shadcn.com/docs/tailwind-v4) states *"It's here!
Tailwind v4 and React 19. Ready for you to try out."*, that *"We've removed the
forwardRefs and adjusted the types"*, that every primitive carries a `data-slot`
attribute, and that HSL colors are now OKLCH. That page is from the v4 release
era and is therefore old news rather than fresh evidence, but the registry
artifacts confirm it (§2.5 — the shipped `card.tsx` uses `--spacing()`,
`has-data-[...]`, `*:[img:first-child]` and other v4-only syntax).

**Next.js 16: NOT VERIFIED, and the negative evidence is mildly bad.**

- No shadcn documentation page states a Next.js version requirement. The
  [Next.js installation page](https://ui.shadcn.com/docs/installation/next)
  states no minimum for Next.js, React or Tailwind.
- **No changelog entry mentions Next.js 16 at all**, across the whole 2026 list.
- Its issue tracker has open Next.js 16 bugs that have sat for months:
  [#8683](https://github.com/shadcn-ui/ui/issues/8683) "CSS class syntax error in
  Field component (Next.js 16 + Tailwind 4.1)", open since **2025-11-02**;
  [#9189](https://github.com/shadcn-ui/ui/issues/9189) "SidebarProvider
  persistence causes Blocking Route in Next.js 16", open since **2025-12-23**.
- Weak positive: `init -t next` scaffolds through `create-next-app@latest`, which
  today resolves to `next@16.3.1`.

The honest statement is: **shadcn/ui on Next.js 16 is unverified by its
maintainers' own documentation, has known open Next.js 16 defects, and would work
in practice for a project that only uses the pure-markup components.** Which is
a strange thing to adopt a dependency for.

Compare Base UI's handling of the same class of bug: its Next.js 16 issues are
**closed** — [#4509](https://github.com/mui/base-ui/issues/4509) (Drawer
hydration mismatch in Next.js 16 App Router) and
[#3144](https://github.com/mui/base-ui/issues/3144) (crash under React 19 +
Next 16). That is a real quality signal in Base UI's favour, and it argues that
if a primitive is ever needed, Base UI is a defensible pick.

### 2.5 What `add card` and `add button` actually give you

The registry is public JSON, so this is checkable without installing anything.
Fetched `https://ui.shadcn.com/r/styles/base-nova/{card,button}.json` and
`.../radix-nova/button.json`:

| Resource | `dependencies` | First import | `"use client"`? |
|---|---|---|---|
| `base-nova/card` | *none* | `import * as React from "react"` | **no** |
| `base-nova/button` | *none* | `import { Button as ButtonPrimitive } from "@base-ui/react/button"` | inherited from Base UI — **yes** |
| `radix-nova/button` | *none* | `import { Slot } from "radix-ui"` | **no** (§3.1) |

`base-nova/card.tsx` is 2,652 characters and is **seven functions that each
return a `<div>`** with a `data-slot` attribute and a Tailwind class string.
No library import. No client boundary. Fully server-renderable.

That is the fairest possible case for shadcn, and it is also the case against
it. Two observations:

1. **It is not self-contained.** Its classes reference shadcn's theme layer —
   `bg-card`, `text-card-foreground`, `--card-spacing`, and `cn-font-heading`,
   which comes from `shadcn/tailwind.css` — plus a `cn` helper from
   `@/registry/.../lib/utils` (i.e. `clsx` + `tailwind-merge`). Copying the file
   without running `init` means porting the tokens too.
2. **Card is the wrong abstraction for a Brief Entry.** It ships
   `CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`
   with `has-data-[slot=card-footer]:pb-0` and `*:[img:first-child]:rounded-t-xl`
   image handling — image rules for a product with no images (#17), a footer
   Zis has no content for, and an action slot it has no action for. Worse, `Card`
   is a *uniform container*, and #10's hard requirement is that `interest` and
   `convergence` entries read as **different kinds of thing**. A shared Card is
   the abstraction that quietly makes them the same thing with a different badge.
   `CONTEXT.md` also lists **Card** under _Avoid_ for **Brief Entry**.

`base-nova/button` is the clearest single data point in this whole document:
**to get a styled button, shadcn's default base makes you import
`@base-ui/react/button`, whose module begins `'use client';`** (verified —
`base-ui-react-1.7.0/button/Button.mjs`, first line). A client boundary, for a
button, on a page that is otherwise static text. That is precisely the outcome
#15 named as the thing that would make this decision wrong.

---

## 3. The alternatives, scored against §1

Verified from tarballs. "client-tagged" = files containing `use client` /
total JS files in the published package.

| Candidate | Version (2026-08-17) | Styling | React peer | Client-tagged | Verdict against §1 |
|---|---|---|---|---|---|
| **Radix raw** | `radix-ui@1.6.7` (2026-07-24) | none (unstyled) | via leaves: `^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | per-leaf (§3.1) | **Best escape hatch.** Not a Phase-0 dependency |
| **Base UI** | `@base-ui/react@1.7.0` (2026-08-04) | none (unstyled) | `^17 \|\| ^18 \|\| ^19` | **803 / ~935** | Right primitive *if one is needed*. Costs a boundary per part |
| **Ark UI** | `@ark-ui/react@5.38.1` (2026-08-07) | agnostic (works w/ Tailwind) | `>=18` | **805 / 935** | Over-scoped by an order of magnitude |
| **Park UI** | `@park-ui/panda-preset@0.43.1`, `@park-ui/cli@1.0.1` | **Panda CSS** | — | — | **Disqualified**: wrong styling engine |
| **HeroUI** | `@heroui/react@3.2.4` (2026-08-07) | Tailwind (`tailwindcss >=4`) | `>=19.0.0` | 87 / 200 | Brings a visual identity Zis hasn't chosen, + react-aria tree |
| **Mantine** | `@mantine/core@9.5.1` (2026-08-02) | own CSS | `^19.2.0` | 636 / 653 | **Worst RSC fit.** Root client provider |
| **Chakra** | `@chakra-ui/react@3.36.1` (2026-07-19) | **Emotion** (runtime CSS-in-JS) | `>=18` | 144 / 492 | **Disqualified**: second styling system + provider |
| **None (Tailwind only)** | `tailwindcss@4.3.3` (2026-07-16) | Tailwind | — | 0 | **Recommended** |

### 3.1 Radix — and a genuinely counterintuitive result

Radix is **alive**: `radix-ui/primitives` was pushed 2026-08-08, with commits
through 2026-07-31 adding a `ScrollArea.Content` part and prop-spreading tests.
The "Radix upgrade treadmill" the ticket feared is real in the sense that the
leaves version independently (the unified `radix-ui@1.6.7` pins 40-odd
`@radix-ui/react-*` at distinct versions), but the project is not abandoned.

React 19 is *mostly* clean, with a visible tail of open React-19-specific
defects — [#3701](https://github.com/radix-ui/primitives/issues/3701) (Select
inside Dialog causes aria-hidden focus freeze, open since 2025-10-19),
[#3778](https://github.com/radix-ui/primitives/issues/3778) (Collapsible replays
animation after React 19.2 `Activity`),
[#4036](https://github.com/radix-ui/primitives/issues/4036) (DropdownMenu
grace-intent stale under React 19), plus
[#4093](https://github.com/radix-ui/primitives/issues/4093) and
[#4115](https://github.com/radix-ui/primitives/issues/4115) from August 2026. All
are in Dialog / Select / DropdownMenu / Toast — the components Zis does not use.

The counterintuitive finding, from the tarballs:

- `radix-ui@1.6.7/dist/*` contains **zero** occurrences of `use client`. Its
  files are one-line re-exports (`export * from "@radix-ui/react-dialog"`), and
  the directive lives in the leaf: `@radix-ui/react-dialog@1.1.23/dist/index.mjs`
  begins `"use client";`. So the boundary still lands correctly — it lands at the
  leaf. No problem, but worth knowing before someone greps the wrapper and draws
  the wrong conclusion.
- **`@radix-ui/react-slot@1.3.3` carries no `use client` at all.** It is
  server-safe. Which is why shadcn's `radix-nova/button` — whose only library
  import is `Slot` — is fully server-renderable, while its **default** `base-nova`
  button is not.

**So on the ticket's own criterion (question 4), the opt-in Radix base beats the
default Base UI base.** If a library were adopted, `--base radix` would be the
RSC-correct choice, and the popular/default answer would be the wrong one. This
is the sharpest single reason not to take the default.

### 3.2 Base UI — plus a package rename that will bite someone

Base UI is healthy and is the best-run project in this survey: `mui/base-ui` had
commits **on 2026-08-17**, `v1.0.0` shipped **2025-12-11**, and it is now
`v1.7.0` (2026-08-04) on a roughly monthly minor cadence.

**A trap worth recording.** The package was **renamed**. The old name,
`@base-ui-components/react`, is frozen at `1.0.0-rc.0` published **2025-12-04** —
one week before 1.0 — and has had no release in over eight months. The live
package is **`@base-ui/react`**. Any 2025-era doc, tutorial or LLM memory
installs the dead one and gets a release candidate that is 7 minor versions
behind. Verified against both registry entries.

Technically it is well suited to RSC *if you need it*: 803 client-tagged files
means the tagging is **per component module**, and the package exports fine
subpaths (`./button`, `./dialog`, `./accordion`, …), so importing one part marks
one part. Its runtime deps are modest (`@floating-ui/react-dom`,
`use-sync-external-store`, `@babel/runtime`, `@base-ui/utils`).

But per §2.5, even `Button` is `'use client'`. For Zis that is a cost with no
return: Zis's buttons submit forms.

### 3.3 Ark UI

`@ark-ui/react@5.38.1` is a large, actively released, styling-agnostic library
built on `@zag-js/*` state machines — its `dependencies` list runs to dozens of
zag packages including `angle-slider`, `carousel`, `cascade-select`,
`color-picker`, `date-picker`, `async-list`. 805 of 935 published JS files are
client-tagged, including `components/accordion/accordion-root.js`.

It is a fine library. It is built for the dashboards-and-forms case the ticket
correctly identified as the wrong benchmark. Zis's most complex form control is a
`<textarea>`.

### 3.4 Park UI — disqualified on the styling engine

`chakra-ui/park-ui`, described by its own repo as *"Beautifully designed
components built with Ark UI and Panda CSS"*. `@park-ui/panda-preset@0.43.1`
peer-depends on `@pandacss/dev`.

**Panda CSS is not Tailwind.** Adopting Park UI means adopting a second,
different build-time styling engine alongside the settled Tailwind, or replacing
Tailwind. Either is a stack change, not a component-library choice, and #1's
settled stack does not license it.

Secondary signal: the repo was last pushed **2026-04-10** — four months stale,
against Base UI's same-day commits and Ark UI's release ten days ago.

### 3.5 HeroUI

`@heroui/react@3.2.4` is the best-aligned of the styled libraries on paper: it
peer-depends on `tailwindcss >=4.0.0` and `react >=19.0.0`, exports per-component
subpaths, and only 87 of 200 files are client-tagged.

Two problems. It peer-depends on `react-aria ^3.51.0`,
`react-aria-components ^1.20.0`, `@react-aria/i18n`, `@react-aria/ssr` and
`@react-aria/utils` — a substantial runtime tree, for a product whose
accessibility needs are "use real `<button>` and `<label>` elements". And it
ships a strong opinionated visual identity, which is a decision #10 has not made
yet and should make on its own terms for a reading surface.

### 3.6 Mantine — and its docs contradict its own tarball

`@mantine/core@9.5.1` peer-depends on `react ^19.2.0`. Its
[Next.js guide](https://mantine.dev/guides/next/) is unusually candid about the
RSC cost, and it is disqualifying for Zis:

> "All Mantine components require context to support default props and Styles
> API." … they "cannot be used as server components"

> "Compound components cannot be used in server components."

A root `MantineProvider` plus a required `ColorSchemeScript` (*"it's required even
if you use only one color scheme"*) puts a client boundary at the top of a page
that is a list of paragraphs. That is the exact failure mode #15 names.

**Minor contradiction, recorded because it is a lesson about sources.** The same
page claims:

> "Entry points of all `@mantine/*` packages (`index.js` files) have the
> `'use client';` directive at the top of the file"

Verified false for 9.5.1. The published barrels
`@mantine/core/esm/index.mjs` and `cjs/index.cjs` contain **zero** occurrences of
`use client`; the directive is on the per-component modules
(`esm/components/Button/Button.mjs` and
`esm/core/MantineProvider/MantineProvider.mjs` both start `"use client";`). The
practical advice the docs give — you don't need to add the directive yourself —
is still correct, since the barrel re-exports from tagged modules. The stated
mechanism is not. Low stakes; a good reason to grep tarballs rather than trust
docs pages, which is how §2.3 and §3.1 were found too.

### 3.7 Chakra — disqualified

`@chakra-ui/react@3.36.1` peer-depends on `@emotion/react >=11` and depends on
four `@emotion/*` packages. That is **runtime CSS-in-JS**: a second styling
system running in the browser next to Tailwind's build-time CSS, plus a provider
at the root. It also depends on `@ark-ui/react`, inheriting §3.3. Its `exports`
map has no per-component subpaths — only `.` and a few utility entries — so
tree-shaking is the bundler's problem rather than the package's.

Nothing about this fits a static text page on a Tailwind stack.

---

## 4. `antfu/design` — the answer for #10

**Short answer: it exists, it is installable, and you cannot use it. It is a
Vue 3 + UnoCSS library. There is no React in it.**

`antfu/design` is real:

- Repo: <https://github.com/antfu/design>, created **2026-06-25**, pushed
  **2026-08-12**, 63 stars, 4 forks, MIT, TypeScript. Description: *"Anthony's
  personal design system"*.
- Published: **`@antfu/design@0.3.4`** on npm.

The `packages/design/package.json` settles the fit question outright. Its own
description:

> "A customizable, composable design system for devtools-style Vue apps — a
> UnoCSS preset, Vue primitives, a design skill, and an a11y contrast check"

Its `peerDependencies` include **`vue: ^3.5.0`**, **`unocss: >=66.0.0`**,
**`reka-ui: ^2.0.0`**, `floating-vue`, `splitpanes`, `@tanstack/vue-virtual`. Its
`dependencies` are `@vueuse/core`. Its typecheck script is `vue-tsc`. Components
live at `packages/design/components/{Action,Display,Feedback,Form,Layout,Overlay,Utility}`
as Vue components.

So: **two independent disqualifiers** for a Next.js app — the wrong UI framework
(Vue, not React) and the wrong styling engine (UnoCSS, not Tailwind). Neither is
bridgeable. This is a negative answer, and per #15 that is a valid result.

### 4.1 What *is* transferable, and it is not nothing

The repo's `README.md` is explicit that the intended consumption path is not
`npm install` at all:

> "The way to use it so intall `@antfu/design` with
> [`skills-npm`](https://github.com/antfu/skills-npm) and ask agents to use it
> and follow the design system and components in it." *(typo in original)*

> "This is something in between a design system and a component library." … "for
> agents to consume, reference, and learn from, so they can more consistently
> produce UI that is aligned with my design preferences."

It ships `skills/antfu-design/SKILL.md` plus eight reference documents
(`core-tokens.md`, `core-components.md`, `core-setup.md`, `best-practices.md`,
`recipes.md`, `advanced-patterns.md`, `features-data-presentation.md`,
`storybook.md`). **That layer is framework-independent prose, and it is readable
primary source.** Its stated rules, quoted:

1. **"Own the tokens, not the colors."** *"Never hard-code a hex or a raw
   Tailwind color in app UI."* Semantic layer first: `bg-base`, `color-base`,
   `color-muted`, `border-base`.
2. **"Light/dark parity is not optional."** *"If you write a one-off color, you
   have just created a dark-mode bug."*
3. **"No slop."** *"Technical values are `font-mono tabular-nums`."* A **dash
   ban** — no em-dash-laden prose in UI copy. *"Prefer one obvious affordance
   over three competing ones."*
4. **"Reuse before you build."**

And one directly useful architectural note, which happens to agree with §6:

> "Dark mode is the app's to own — the package ships no `isDark`/`toggleDark`
> (nor a dark-toggle component)"

### 4.2 Honest fit assessment for #10

Rules 1–3 transfer cleanly to Zis and are worth adopting as *house style*
independent of any library. Semantic tokens over raw colors is the correct
Tailwind v4 pattern anyway (`@theme`), light/dark parity is a real concern for a
reading surface, and the restraint rule ("one obvious affordance") is close to
Zis's own product thesis that the discipline is the product.

The **component vocabulary does not transfer**, and #10 should not try to force
it. The system is explicitly *devtools-shaped*: its "when to reach for what"
guidance is `DisplayNumber`, `DisplayBytes`, `DisplayDuration`, `DisplayFilePath`,
`DisplayBadge`, `color-scale-*` severity ramps. Zis renders **no bytes, no
durations, no file paths, no severities, and no numbers a reader sees at all** —
#14 and `CONTEXT.md` ban counts, and ADR-0006 bans scores. A dense, mono,
data-dashboard idiom is close to the opposite of a prose reading surface with a
comfortable measure and generous leading.

Rule 3's `font-mono tabular-nums` has exactly one plausible home in Zis: the
Brief **date**, and possibly the archive's list of dates. That is a small,
genuine win and worth taking.

**Recommendation for #10:** treat `@antfu/design` as a **design language and an
agent skill**, not a dependency. If the user wants it in the loop, the honest
shape is to install it via `skills-npm` so an agent can read
`skills/antfu-design/` while writing Zis's own Tailwind components — which is,
per its README, the author's stated intent. Adopt the token discipline, the
light/dark parity rule, the dash ban, and mono/tabular dates. Do not attempt to
port the component catalog. Its `@antfu/design/a11y` contrast check is Playwright
+ axe-core based and therefore lands inside #1's **out-of-scope E2E test
infrastructure** — mention it and move on.

---

## 5. Bundle and RSC cost

Answering question 4 directly, with the artifact-level evidence gathered above.

**Server-renderable with no `"use client"` anywhere:**

- Plain Tailwind markup. Zero packages.
- `@radix-ui/react-slot@1.3.3` — verified no directive.
- shadcn registry files that import no primitive — e.g. `base-nova/card.tsx`.
- The unified `radix-ui@1.6.7` wrapper files themselves (though the leaves they
  re-export are tagged, so this is a technicality, not a feature).

**Force a client boundary at the point of use** (fine-grained; the boundary lands
where you import, and does not leak upward):

- `@base-ui/react` — every component module, incl. `Button`.
- `@ark-ui/react` — 805 / 935 files.
- `@radix-ui/react-*` leaves — the interactive ones.
- `@heroui/react` — 87 / 200.

**Force a client boundary at the root of the app:**

- **Mantine** — `MantineProvider` + `ColorSchemeScript` in `app/layout.tsx`, and
  its docs state components *"cannot be used as server components"*.
- **Chakra** — provider + Emotion runtime.
- **`next-themes`** — §6.

The relevant asymmetry: on Zis's Brief page, a client boundary buys nothing
because **nothing on that page is interactive except anchors and form submits.**
Server Actions are the mutation path, and a `<form action={serverAction}>` needs
no client component. The bundle Zis ships for the reading surface can be
approximately the Next.js App Router runtime and nothing else, and every library
in §3 moves that number in one direction.

Also relevant, from the [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16):
Next.js 16 **removed the `size` and `First Load JS` metrics from `next build`
output**, calling them *"inaccurate in server-driven architectures using React
Server Components"*. So there is no longer a cheap in-build number to catch
bundle regressions with. One more reason to start from zero rather than to trim
back later.

---

## 6. Dark mode and typography

### 6.1 Dark mode: server-rendered, no library, no flash

**`next-themes` is a trap for this project, on three verified counts.**

1. **It is a root client boundary.** `next-themes@0.4.6` publishes a single
   bundled entry, and `dist/index.mjs` begins — at byte 0 —
   `"use client";import*as t from"react";…`. There is no server-safe subpath.
   Importing anything from it turns `app/layout.tsx` into a client boundary at
   the root of a product whose every page is static text.
2. **The escape hatch is merged but unreleased.** `<ThemeScript>` — the export
   that would let you emit the no-flash script without the provider — landed in
   [PR #355](https://github.com/pacocoursey/next-themes/pull/355) on
   **2025-05-31**. The latest published version, `0.4.6`, was published
   **2025-03-11**, three months *earlier*. Verified in the tarball: the bundle's
   export list is exactly `export{J as ThemeProvider,z as useTheme}` — no
   `ThemeScript`. It has been unreleased for ~15 months.
3. **The project is stalled.** `pacocoursey/next-themes` last *commit* is
   **2025-05-31**; the repo was last pushed 2026-02-25; 66 open issues.

**What Zis should do instead, and why Zis specifically can.** Two settled
constraints combine into an advantage most apps do not have: Zis is **single
user**, and **every route is auth-gated with no public landing page at all**
(#1, #10). So there is no anonymous first paint to guess a theme for. The reader
is a row in the database and the request already carries a session cookie the
`verifySession()` DAL reads.

Therefore: **read the theme preference on the server and render the class
directly.** Per [Tailwind's dark-mode docs](https://tailwindcss.com/docs/dark-mode),
Tailwind v4 does this with a custom variant in CSS:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

> "The `&:where(...)` wrapper keeps specificity at zero, so it won't inflate the
> specificity of your generated utilities."

Then in the RSC root layout, `<html className={theme === "dark" ? "dark" : ""}>`.
The toggle is a `<form>` + Server Action that writes the preference and lets the
page re-render. Result: **zero flash by construction** (the class is in the
initial HTML, not applied by a script), zero client JavaScript, zero
dependencies, no `suppressHydrationWarning`, and no inline `<script>` — which
also sidesteps the React 19 *"Encountered a script tag"* warning that shadcn's
own dark-mode guide has an open docs bug about
([#10104](https://github.com/shadcn-ui/ui/issues/10104), open since 2026-03-19).

Tailwind's docs explicitly sanction this route:

> "Again you can manage this however you like, even storing the preference
> server-side in a database and rendering the class on the server — it's totally
> up to you."

The `prefers-color-scheme` default costs nothing and can be the initial value:
Tailwind's `dark` variant uses the media query out of the box before you override
it, so "follow system until the reader chooses" is the natural three-state
model. Storing the choice is a column on `User` or a cookie — a decision for
#10 / the schema, not for this ticket. **ASSUMPTION**, flagged: this presumes the
theme preference is acceptable as user state rather than device state. For a
single-user product on phone and desktop, a per-device cookie is probably the
better default, and either is one line different.

### 6.2 CORRECTION: Zis has no typography-plugin surface at all

Question 5 asks to "cover `@tailwindcss/typography` on Tailwind v4". Both parts
of the answer matter, and the second one dissolves the question.

**Availability: verified, both options.**

- `@tailwindcss/typography@0.5.20`, published **2026-06-08**;
  `tailwindlabs/tailwindcss-typography` pushed the same day, 9 open issues.
  Actively maintained. Its README gives the Tailwind v4 install as one line in
  CSS — `@plugin "@tailwindcss/typography";` — with the `tailwind.config.js`
  route marked *"If you are still using Tailwind CSS v3"*. So it is fully v4
  native.
- **`shadcn/typeset`** (July 2026) is a newer alternative and, notably, **needs
  no package at all**: *"One CSS file you own"*, imported after Tailwind, exposing
  three variables — `--typeset-size`, `--typeset-leading`, `--typeset-flow`. Its
  docs make a real argument against `prose`: container-relative sizing rather
  than a fixed rem scale, plain utilities rather than `prose-*` modifiers, and
  *"Your tokens flip, nothing to add"* instead of `prose-invert`'s second palette.
  It sets no `max-width` — *"your layout owns measure"* — and provides
  `not-typeset` as the `not-prose` equivalent.

**But: what would either style?** Both tools exist to style **HTML you don't
control** — the typography plugin's README says exactly that: *"any vanilla HTML
you don't control, like HTML rendered from Markdown, or pulled from a CMS"*.

Zis has none. Per **ADR-0005** and `docs/security-model.md`: *no publisher HTML
is ever stored or rendered* — extraction produces text. Per #7: *AI output is
untrusted too — rendered as plain text, never HTML, never auto-linkified.* And
per #17, a Brief Entry is title + summary + Publisher name + why-text + link.

There is **no markdown renderer, no CMS, no rich-text field, and no HTML string
anywhere in the product.** Every element on the page is one a Zis component
authored deliberately. `prose` and `typeset` both solve a problem Zis has
structurally deleted.

**So the typography answer is: neither, and the real work is elsewhere.** What a
reading surface actually needs, and what #10 should specify, is a small number of
deliberate decisions expressed as Tailwind v4 `@theme` tokens:

- A **type scale** — realistically four sizes: date, entry title, summary body,
  why-text/Publisher meta.
- A **measure**. The single highest-leverage typographic decision for a Brief,
  and one `prose` would have made *for* you at `65ch`. Zis must choose it
  explicitly (Tailwind's `max-w-[68ch]` or a `--measure` token).
- **Leading** — generous for the summary, tighter for meta.
- Vertical rhythm between Brief Entries, which is where the two Admission kinds
  can be differentiated (#10's question 2) without a badge doing all the work.

**Escape hatch, recorded so this is cheap to reverse:** if a markdown surface
ever appears — a changelog, an about page, docs, or if the AI summary is ever
allowed structure — then `@plugin "@tailwindcss/typography";` is one line, or
`shadcn/typeset`'s CSS file is one copy with no dependency. Neither decision is
expensive to make later, which is the definition of a decision worth deferring.

---

## 7. If the null option is adopted: the concrete shape

### 7.1 What gets installed

Nothing beyond the settled stack. No `components.json`. No `--base` choice, and
therefore none of §2.3's 26-value style enum to get wrong.

Two optional micro-utilities, both justified only when a second variant appears
and neither a component library:

- `clsx` (~230 B) for conditional classes.
- `tailwind-merge` if class-conflict resolution is ever actually needed —
  which, with no component library accepting a `className` override, it probably
  is not. Note `tailwind-merge` is already a dependency of both `shadcn` and
  `@heroui/react`, i.e. it is the piece those libraries genuinely need and Zis
  mostly does not.

Start with neither. Template literals are fine for four components.

### 7.2 The interactive bits, and what covers each

| Bit | Cover | Note |
|---|---|---|
| Login passphrase field | `<form>` + `<input type="password">` + Server Action | #4 |
| Interest add/edit/remove | `<form>` + `<textarea>` + Server Actions | ADR-0003 |
| Brief size setting | native `<select>` or radio group | #14 bans a free number input |
| Merge / kill | `<button>` + Server Action | #14's correction loop |
| Bookmark / Read State | `<button>` + Server Action | #5 |
| Confirm before kill (*if wanted*) | native `<dialog>` + `showModal()` | Baseline since March 2022 — already inside Next 16's browser floor |
| Mobile nav | `<details>`/`<summary>`, or a checkbox + CSS | no JS |
| Theme toggle | server-rendered class + Server Action | §6.1 |

On native `<dialog>`, MDN's accessibility guidance is worth following verbatim
if it is used: set `autofocus` explicitly on the element the reader should reach
first (or on the close button); **never** put `tabindex` on the `<dialog>`
itself — *"The `tabindex` attribute must not be used on the `<dialog>`
element."*; always provide an explicit close button, not just Esc; and note that
`showModal()` gets browser-provided inertness and `aria-modal="true"` for free,
which is the bulk of what a headless Dialog primitive exists to hand you.

Avoid the **Popover API** for now, or gate it on a check: MDN puts it at
**Baseline "newly available" since January 2025**, which sits *above* Next.js
16's stated floor of Chrome 111 / Safari 16.4. `<dialog>`'s March 2022 baseline
is comfortably below it. If a popover is ever needed, feature-detect with
`HTMLElement.prototype.hasOwnProperty("popover")` rather than sniffing versions.

### 7.3 The escape hatch, ranked

The null option is only defensible if reversing it is cheap. It is. If the
inventory grows, take the **first** rung that covers the need:

1. **A native element.** `<dialog>`, `<details>`, `<select>`, `<progress>`.
   Cost: zero.
2. **`@radix-ui/react-slot`.** Verified server-safe, no client boundary, if
   composition/`asChild` is what's wanted. Cost: one tiny package.
3. **One `@radix-ui/react-<part>` leaf.** Install the leaf, **not** the unified
   `radix-ui`, so the dependency surface is one component rather than forty.
   Cost: one client boundary at that component.
4. **One `@base-ui/react/<part>` subpath.** Prefer this over Radix if the need
   is a Dialog/Select/Popover with animation — Base UI closes its Next.js 16
   bugs (§2.4) and Radix has open React 19 defects concentrated in exactly those
   components (§3.1). Remember the package name is `@base-ui/react`, not
   `@base-ui-components/react`.
5. **Read a shadcn registry file** — `curl https://ui.shadcn.com/r/styles/radix-nova/<name>.json`
   — and hand-port the parts you want, translating its tokens to Zis's. Prefer
   the `radix-*` styles over `base-*` for RSC (§3.1). **Do not run `init`**
   unless the whole apparatus is wanted, because `init` adds the `shadcn`
   dependency and the `eject` that removes it is documented irreversible (§2.2).

The threshold at which this recommendation should be revisited wholesale: **Zis
grows a genuine combobox, date picker, or data table.** None is on any open
ticket, and #1's Out of scope rules out the surfaces that would produce them
(admin dashboard, billing, teams).

### 7.4 If the library option is chosen anyway — the concrete shape

Recorded so the decision is actionable either way, and so this doc doesn't have
to be re-researched to overrule it.

```bash
pnpm dlx shadcn@latest init --base radix --template next
```

`--base radix`, not the default `base`, for the reason in §3.1: the Radix-base
button imports only the server-safe `@radix-ui/react-slot`, while the Base-UI-base
button imports a `'use client'` module. Style: any `radix-*` value from
`schema.json`. `rsc: true` so the CLI inserts `use client` only where needed.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  }
}
```

`tailwind.config` is `""` — the docs say for Tailwind v4 *"leave this blank"* —
but note the **live `schema.json` still marks `config` as required**, so the key
must be present and empty rather than absent. Then immediately:

```bash
pnpm dlx shadcn@latest eject
```

to inline `shadcn/tailwind.css` and drop the 33-dependency `shadcn` package
(§2.2). Verified versions to expect: `shadcn@4.18.0`, `radix-ui@1.6.7`,
`tailwindcss@4.3.3`, `next@16.3.1`, `react@19.2.8`.

---

## 8. Findings that contradict the ticket or the map

Listed in descending order of how much they should change the resolution.

1. **shadcn/ui's default base is Base UI, not Radix** — since July 2026, with
   React Aria as a third first-class base and `--base base|radix|aria`.
   Confirmed in the live `schema.json`'s 26-value `style` enum. The ticket's
   question 1 ("whether the Radix primitives underneath are React 19-clean")
   asks about a base you now have to opt into. §2.3
2. **"shadcn is a copy-in generator, not a dependency" is no longer true.**
   `init` writes `@import "shadcn/tailwind.css"` and installs the `shadcn`
   package; `shadcn eject` exists to undo it and is documented **irreversible**.
   That package declares **33 dependencies including `undici`, `execa`, `socks`
   and `@modelcontextprotocol/sdk`** — adjacent to #7's lint rule banning `fetch`
   and `undici` outside `safeFetch`, though a source-scanning lint rule would not
   actually break CI. §2.2
3. **The default shadcn base makes a *button* a Client Component, and the
   non-default one does not.** `base-nova/button` imports `@base-ui/react/button`
   (`'use client'` at line 1); `radix-nova/button` imports only
   `@radix-ui/react-slot@1.3.3`, which carries **no** client directive.
   **On the ticket's own RSC criterion, the popular default is the wrong
   answer.** §2.5, §3.1
4. **The ticket's typography question dissolves.** Both
   `@tailwindcss/typography@0.5.20` and the new `shadcn/typeset` are verified
   working on Tailwind v4 — and **Zis has no HTML-you-don't-control surface for
   either to style**, because ADR-0005 stores no publisher HTML and #7 renders AI
   output as plain text, never HTML, never auto-linkified. The real typographic
   work is a type scale and an explicit **measure**, which `prose` would
   otherwise have silently chosen at `65ch`. §6.2
5. **`next-themes` is a root client boundary and effectively unmaintained.**
   `"use client"` at byte 0 of its only entry; the `<ThemeScript>` escape hatch
   is merged (2025-05-31) but **unpublished** — `0.4.6` predates it (2025-03-11)
   and there has been no release since; last commit 2025-05-31. Zis's own
   constraints (single user, every route auth-gated, no public landing page) make
   a server-rendered `class="dark"` strictly better: zero flash *by
   construction*, zero JS, zero deps. §6.1
6. **Base UI's npm package was renamed.** `@base-ui-components/react` is frozen
   at `1.0.0-rc.0` (2025-12-04); the live package is `@base-ui/react@1.7.0`.
   Anything written in 2025 — including model memory — installs the dead one,
   seven minors behind. §3.2
7. **Mantine's Next.js docs contradict Mantine's own tarball** about where
   `'use client'` lives. Practically harmless, but it is the second case in this
   document where the tarball corrected the docs (the first being
   `components.json`'s docs page vs `schema.json`), which is a method note worth
   keeping: **grep the artifact.** §3.6
8. **Next.js 16 runs a React canary, not React 19.2 stable.** Its own upgrade
   guide: *"The App Router in Next.js 16 uses the latest React Canary release."*
   So every library's "React 19 supported" claim is being tested in this stack
   against a moving target, and any such claim is weaker than it reads.
9. **shadcn/ui on Next.js 16 is not verified by its own documentation.** No docs
   page states a Next.js requirement, no changelog entry mentions Next.js 16, and
   two Next.js 16 bugs have been open since November/December 2025. Base UI, by
   contrast, has **closed** its Next.js 16 issues. §2.4
10. **Next.js 16 removed the `size` / `First Load JS` build metrics** as
    *"inaccurate in server-driven architectures using React Server Components"* —
    so there is no longer a free in-build signal for bundle regressions, which
    argues for starting at zero rather than trimming later. §5
11. **`antfu/design` is Vue 3 + UnoCSS.** Installable (`@antfu/design@0.3.4`) and
    entirely unusable in this stack: `peerDependencies` include `vue ^3.5.0`,
    `unocss >=66`, `reka-ui ^2`. Its transferable layer is a skill + eight
    reference docs, and its component vocabulary is devtools-shaped (`DisplayBytes`,
    `DisplayDuration`, `DisplayFilePath`) for a product that renders none of
    those things. §4

---

## 9. Cross-cutting routes

**→ #10 (IA and UI)** — the blocker is cleared: build the prototype in plain
Tailwind, no library, no `components.json`.

- `antfu/design` **cannot be installed** (Vue + UnoCSS). Adopt it as a *language*
  and optionally as an agent skill via `skills-npm`: semantic tokens over raw
  colors, light/dark parity as a hard rule, the dash ban, `font-mono
  tabular-nums` for the Brief date, "one obvious affordance". Do not port the
  component catalog. §4
- Do not reach for a shared `Card`. #10's requirement that `interest` and
  `convergence` entries read as **different kinds of thing** is in direct tension
  with a uniform container, and `CONTEXT.md` lists **Card** under _Avoid_ for
  **Brief Entry**. §2.5
- #10's design questions 3 and 4 are **already dead** — #17 removed Source icons
  and images entirely. The letter-mark fallback and the thumbnail layout have no
  subject.
- The typographic decisions that matter are the **measure**, the type scale, and
  the vertical rhythm between entries — not a widget inventory. §6.2
- Design the **short Brief and "all caught up"** states first: given #9's
  median-of-five target they are among the most-rendered states in the product,
  not edge cases. §1.3
- Dark mode is a server-rendered class from the reader's stored preference plus a
  Server Action toggle. This needs a decision on *where* the preference lives —
  `User` column vs cookie — which touches the schema. §6.1

**→ #12 (repo and CI setup)**

- **`next lint` is removed in Next.js 16.** `next build` no longer runs linting,
  the `eslint` key in `next.config` is gone, and `@next/eslint-plugin-next` now
  defaults to **ESLint flat config**. Codemod:
  `npx @next/codemod@canary next-lint-to-eslint-cli .`. This is load-bearing for
  #7, whose `safeFetch` egress rule is **enforced by lint, not review** — that
  lint must now be its own explicit CI step.
- Turbopack is the default for both `next dev` and `next build`; a stray
  `webpack` config (possibly added by a plugin) **fails the build**.
- Floors: Node **20.9+**, TypeScript **5.1+**, browsers Chrome/Edge/Firefox 111+
  and Safari 16.4+.
- No component library means no `components.json`, no registry version to track,
  and nothing for CI to keep in sync. If one is ever added, note the
  `shadcn`-brings-`undici` interaction with #7's lint rule. §2.2

**→ #18 (passphrase recovery)** — whatever recovery shape lands, its UI is a
plain `<form>` + Server Action and needs nothing from this ticket. Two carry-over
constraints from #4 that any recovery flow must respect: Server Functions POST
to the route they are used on, so a proxy matcher that excludes a path also
un-gates its Server Actions; and `verifySession()` is the real boundary. If
recovery involves a one-time link, note there is **no email provider in Phase 0**
(#14) and no public landing page (#10) — so an out-of-band step has nowhere
in-product to live.

**→ #8 (ingestion)** — nothing from this ticket constrains ingestion. One
adjacency only: if shadcn is ever adopted, `undici` enters the dependency tree
via the `shadcn` package, on the same egress surface #7 defined and #8
implements. §2.2

**→ #21 (calibrate the relevance bar)** — mutual: if the bar comes in
miscalibrated and Briefs run short, the short/empty state is the product's most
common face. #21's measurement should be reported to #10 as a *layout*
requirement, not only as a number.

---

## 10. Sources

Primary sources, grouped. Registry and tarball facts were read on 2026-08-17.

**Package registry** (`registry.npmjs.org`) — `shadcn@4.18.0`,
`radix-ui@1.6.7`, `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-slot@1.3.3`,
`@base-ui/react@1.7.0`, `@base-ui-components/react@1.0.0-rc.0`,
`@ark-ui/react@5.38.1`, `@park-ui/panda-preset@0.43.1`, `@park-ui/cli@1.0.1`,
`@heroui/react@3.2.4`, `@mantine/core@9.5.1`, `@chakra-ui/react@3.36.1`,
`next@16.3.1`, `react@19.2.8`, `tailwindcss@4.3.3`,
`@tailwindcss/typography@0.5.20`, `next-themes@0.4.6`, `@antfu/design@0.3.4`,
`@shadcn/react@0.3.0`, `@shadcn/helpers@0.2.0`.

**Shipped tarballs, unpacked and grepped** — `shadcn@4.18.0` (dependency list;
`dist/tailwind.css`, 16,041 B), `radix-ui@1.6.7` (0 × `use client`),
`@radix-ui/react-dialog@1.1.23` (directive at line 1),
`@radix-ui/react-slot@1.3.3` (no directive), `@base-ui/react@1.7.0`
(803 tagged files; `button/Button.mjs` line 1), `@ark-ui/react@5.38.1`
(805/935), `@heroui/react@3.2.4` (87/200), `@mantine/core@9.5.1` (636/653;
barrels untagged), `@chakra-ui/react@3.36.1` (144/492),
`next-themes@0.4.6` (`"use client"` at byte 0; exports `ThemeProvider`,
`useTheme` only).

**shadcn/ui** — [docs](https://ui.shadcn.com/docs) ·
[CLI](https://ui.shadcn.com/docs/cli) ·
[components.json](https://ui.shadcn.com/docs/components-json) ·
[schema.json](https://ui.shadcn.com/schema.json) ·
[changelog](https://ui.shadcn.com/docs/changelog) ·
[Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) ·
[typeset](https://ui.shadcn.com/docs/typeset) ·
[Next.js install](https://ui.shadcn.com/docs/installation/next) ·
registry JSON at `https://ui.shadcn.com/r/styles/{base-nova,radix-nova}/{card,button}.json` ·
issues [#8683](https://github.com/shadcn-ui/ui/issues/8683),
[#9189](https://github.com/shadcn-ui/ui/issues/9189),
[#10104](https://github.com/shadcn-ui/ui/issues/10104)

**Radix** — [radix-ui/primitives](https://github.com/radix-ui/primitives) ·
issues [#3701](https://github.com/radix-ui/primitives/issues/3701),
[#3778](https://github.com/radix-ui/primitives/issues/3778),
[#4036](https://github.com/radix-ui/primitives/issues/4036),
[#4093](https://github.com/radix-ui/primitives/issues/4093),
[#4115](https://github.com/radix-ui/primitives/issues/4115)

**Base UI** — [mui/base-ui](https://github.com/mui/base-ui) ·
[releases](https://github.com/mui/base-ui/releases) (v1.0.0 2025-12-11,
v1.7.0 2026-08-04) · issues
[#3144](https://github.com/mui/base-ui/issues/3144),
[#4509](https://github.com/mui/base-ui/issues/4509)

**Others** — [chakra-ui/park-ui](https://github.com/chakra-ui/park-ui) ·
[Mantine Next.js guide](https://mantine.dev/guides/next/) ·
[tailwindlabs/tailwindcss-typography](https://github.com/tailwindlabs/tailwindcss-typography) ·
[pacocoursey/next-themes](https://github.com/pacocoursey/next-themes) ·
[PR #355](https://github.com/pacocoursey/next-themes/pull/355)

**antfu/design** — [repo](https://github.com/antfu/design) · its `README.md`,
root `package.json`, `packages/design/package.json`, and
`skills/antfu-design/SKILL.md`, all read via the GitHub contents API ·
[skills-npm](https://github.com/antfu/skills-npm)

**Framework and platform** —
[Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) ·
[Tailwind dark mode](https://tailwindcss.com/docs/dark-mode) ·
[MDN `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) ·
[MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)

**Project** — `CONTEXT.md`, `docs/security-model.md`, `docs/ranking-model.md`,
ADR-0003 / ADR-0005 / ADR-0006 / ADR-0007, and issues #1, #4, #5, #7, #9, #10,
#12, #14, #17, #18, #21.
