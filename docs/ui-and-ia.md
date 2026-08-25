# Information architecture and UI

Settled by
[Design the information architecture and UI](https://github.com/SaKaNa-Y/Zis/issues/10),
against the prototype on branch
[`prototype/ia-ui`](https://github.com/SaKaNa-Y/Zis/tree/prototype/ia-ui/.scratch/zis/prototype/PROTOTYPE-ia-ui).
Read [`CONTEXT.md`](../CONTEXT.md) first; this document uses its terms without
redefining them, and it never uses the ones it bans.

Everything here was reacted to in a browser rather than argued on paper. Five
structurally different layouts were built; the one that won is recorded as **D**
in the prototype, and the four that lost are kept there as the record.

---

## 0. Layout customization — settled, and the answer is no

This section used to defer the question. It is now closed by
[#23](https://github.com/SaKaNa-Y/Zis/issues/23) and
[ADR-0009](./adr/0009-a-presentation-control-changes-neither-information-nor-order.md):
**a reader-facing presentation control is admissible only if it changes neither
which information is rendered nor its order.** The theme passes that test (seven
tokens redefined, no markup touched); hiding the why-text, collapsing the
`convergence` register, a density toggle, a reader-settable entry order, and
turning off the wide-screen zones all fail it. The surviving set is empty, so
**there is no Layout section in Settings** — it is removed, not left empty (§8),
on the same precedent as the reading view in §3: the answer is stated here rather
than on the screen.

Two things that ruling does *not* say. **Text size is adjustable** — through
browser zoom and OS root-font-size, which are better than a Zis control because
`rem`/`ch` sizing scales the type and the measure together (§9). And
**`forced-colors` and `prefers-contrast` are honored** (§9). Adjustability is the
platform's job here, not Settings'.

## 1. Destinations — five, and only one has permanent chrome

The charting sketch was Home / Discover / Following / Topics / Saved / AI. Four of
those six are cut, and not for tidiness:

| item | verdict | why |
|---|---|---|
| **Today** (Home) | survives | it is the product |
| Discover | **cut** | a browse surface *is* the "Everything" escape hatch under another name |
| Following | **cut** | there is no subscription and no follow graph in v1 — the corpus is global-first |
| Topics | **cut** | `Topic` / `topic_follow` were deleted by [#5](https://github.com/SaKaNa-Y/Zis/issues/5) and the term is banned; a followable subject is a second relevance mechanism competing with the Interest Profile |
| **Saved** | survives | `Bookmark` is a real entity and needs somewhere to live |
| AI assistant | **cut** | still fog on the map, not Phase 0 |

Three destinations the sketch missed and the product requires:

- **Earlier** — the sealed past Briefs.
- **Interests** — the entire relevance mechanism. The why-text is a feedback loop
  ([#14](https://github.com/SaKaNa-Y/Zis/issues/14)), and a loop with no reachable
  input is not a loop.
- **Settings** — see §8. It exists mainly so that *nothing else* is loose chrome.

**The asymmetry is deliberate: a desktop gets a persistent rail, a phone does
not.** A wide screen has spare width and spends it on navigation; a phone has
none, and a nav bar pinned to the bottom of a page whose thesis is *you can finish
this* is a permanent invitation to leave. On phone the destinations live in the
footer, reached having finished.

## 2. The two Admission routes render as a section break

`admitted_by` is stored precisely so this could stay open
([ranking-model.md §5](./ranking-model.md)). It is now closed: the `interest`
entries come first as the body of the Brief, then a rule, then a headed section
for `convergence`.

**The section heading carries the whole explanation** — *"You did not ask for
this / Enough independent Publishers converged on it that it arrives anyway"* —
which is why no badge is needed anywhere in the product. The two routes read as
different kinds of thing because they are in different places under different
headings, not because one is decorated.

Inside the convergence register the type steps *down* rather than up: the title
takes the body size at semibold instead of the title size. It is a shorter,
denser register — wire copy — rather than a demoted version of an interest entry.
`convergence` is expected to fire weekly, not daily (#9), so **on most days the
register and its heading are simply absent**, not empty.

Three alternatives were built and rejected: one continuous stream with the
information order inverted per route (two shapes in one list read as one shape
done inconsistently), a right-hand rail for convergence (furniture that is empty
six days a week), and a full-bleed two-up grid (it makes `BriefEntry.position`
ambiguous — does reading order run across or down? — and a two-up grid of text
blocks is a `Card` grid with the border taken off).

## 3. A Brief Entry, and what its links do

Exhaustively, per [#17](https://github.com/SaKaNa-Y/Zis/issues/17): title, AI
summary, Publisher names, the frozen why-text, a link out. No image, no icon, no
favicon, no letter-mark. **No shared `Card`** — `CONTEXT.md` lists Card under
*Avoid* for Brief Entry, and there is no container, border, or background behind
an entry anywhere in the design. Entries are separated by vertical rhythm alone.

**The click model:**

| element | destination |
|---|---|
| **title** | the origin, external, new tab, marked `↗` |
| **why-text line** ("3 Publishers converged") | the Signal's provenance page, internal (§4) |
| **Save** / **Mark read** | `<form>` + Server Action, no navigation |

A **reading view** is not merely undesirable, it is unavailable:
[ADR-0005](./adr/0005-no-publisher-html-is-ever-stored.md) stores no publisher
HTML, so Zis has nothing to render. This is worth stating because it is the
obvious feature request and the answer is structural.

The why-text renders exactly what `ranking-model.md` §6 specifies and nothing
more: `matched "<argmax Interest>"` — or `no Interest matched` on the convergence
route — then origin-**excluded** Strength, up to three Publisher names plus `+N`,
then the origin labelled separately. **The multi-Publisher question that the dead
favicon question was really asking is answered by that string**; it was never an
icon problem.

## 4. The Signal page — the provenance record, not an article

Reached from the why-text. It holds the title, the summary, the link out, the
Admission route, and then the thing that justifies the page: **every Citation, as
a table — Publisher, citing Item, first-seen timestamp, with the origin listed
last and labelled.** Strength is stated as a count of distinct Publishers with
the origin excluded, so a reader can count the rows and get the same number the
system used.

"The clustering table and the explainability feature are the same table" was a
prior-art finding on the map; this page is where that stops being an
implementation note and becomes a screen. It also hosts **kill** — the one-click
correction loop #14 chose over LLM adjudication — because the correct place to
say *wrong cluster* is the page showing the evidence.

## 5. Short and empty were designed first

Built before the five-entry state, per [#15](https://github.com/SaKaNa-Y/Zis/issues/15)'s
note: these are among the most-rendered faces of the product, not edge cases.
**That justification is now stronger, and it no longer rests on a target.** This
section originally cited #9's trailing-14-day median of ≥5, which
[ADR-0016](./adr/0016-brief-density-is-an-observation-not-a-target.md) has retired.
What replaces it is the measurement: trailing-14 median eligible supply is **3**, the
median Brief is **1**, and the reader's own stated need is **3** entries — which
binds nothing, but does mean the short state is the ordinary state rather than the
degraded one.

Because there is no `Card`, **there is no container to look empty**. A one-entry
Brief is one entry in the same rhythm; nothing gapes. The empty state is a
sentence in the same type as everything else — *"Nothing cleared the bar today.
Not a quiet corner of the internet — a quiet day. Zis would rather hand you an
empty page than pad one."* — followed by the two things a reader wants next:
yesterday's Brief, and the Interests that decide tomorrow's. It names the boundary
as a choice rather than a failure, which is the whole difference between an honest
short Brief and a broken one.

## 6. Earlier — dates and lead lines, never counts

An archive row is **the date plus the lead entry's title**. Not "5 stories": #14
banned counts in any disguise and a per-day tally is exactly that disguise. The
lead title costs nothing — the Brief is persisted and its `position` 1 row is
stored — and it is what makes a date recognisable. A day where nothing cleared the
bar says *"Nothing cleared the bar"* in the same slot, so the empty state is a
first-class member of the archive rather than a gap in it.

Earlier is **its own route**, not a panel: it is where retrieval happens, and it
is where **Tag** search lives (§7).

## 7. Interests, and Tags

**Interests** is its own route: a numbered list of `<textarea>`s with add /
remove, a live `font-mono tabular-nums` character count against ~200, sized for
the ~10–20 statements ADR-0003 describes. Twenty textareas is a page, not a panel.

**Edits land on tomorrow, and the interface says so.** Today's Brief is sealed
(#14), so an edit *cannot* change it; an interface that implied otherwise would
teach the reader that the seal is soft.

**An Interest in non-Latin script carries a note, and the note is persistent**
([#24](https://github.com/SaKaNa-Y/Zis/issues/24)). `ranking-model.md` §6
establishes that Interests are English because `bge-small-en-v1.5` is English-only
and a Chinese Interest embeds to a meaningless vector — it never matches anything
and nothing else in the product would ever say so. The note reads *may not match*
rather than *will not*, because the trigger is script detection and script
detection is a heuristic, not the model.

It is a **state, not a hint**: computed on every render from the statement's own
text, no stored flag and no schema column, shown next to the character count. A
transient typing-time warning was rejected — the failure is permanent, so an
Interest written months ago must still say it is inert. This is the one element on
this route that is not a `<textarea>`, and it is not a control: it reports a fact
about a statement the reader wrote, which is what §7 is for.

**Tags appear in the rail, and they search Earlier.** This is the one place the
design came close to reintroducing something already cut: a browsable category
list in primary chrome is `topic_follow` wearing a new name, and `CONTEXT.md`
keeps `Tag` alive strictly "to explain and to retrieve". So the rail's Tags are
**retrieval over the archive, never a subscription** — they cannot affect what
enters a Brief, and the rail says so in as many words. A followable category would
reopen #5 and needs its own ticket, not a rail entry.

## 8. Settings — and the theme lives in a per-device cookie

Settings exists so that **appearance, cut time, and account actions stop being
loose chrome** on the reading surface. It holds: appearance (light / dark / match
system), the cut hour with the stored timezone, how much (§9 of the ranking model
is the real gate; this is a named size, never a number field, because #14 requires
the ceiling to stay out of the interface and a free number input is how the bound
dies), and account (change passphrase, sign out everywhere — which bumps
`session_version`).

**There is no Layout section** — #23 removed the empty one this document used to
describe (§0). Appearance is the *only* presentation control in Settings, and
ADR-0009 is why it is the only one.

**The theme preference is a per-device cookie, not a `User` column.** One reader
on a phone at night and a desktop at noon wants two answers, and a row forces one;
the cookie also keeps a presentation preference out of the personal-layer schema.
Cost: clearing cookies loses it, which is a shrug. The mechanism is #15's — a
class rendered on `<html>` by the server from the cookie, toggled by a Server
Action, **zero flash by construction**, no `next-themes`.

## 9. Typography — the real work, and there is no plugin

Both `@tailwindcss/typography` and `shadcn/typeset` are ruled out (#15): they
exist to style HTML you do not control, and under ADR-0005 there is no HTML string
anywhere in the product. So every decision the plugin would have made silently is
made here, as Tailwind v4 `@theme` tokens.

```css
@theme {
  /* four sizes, and there are only four */
  --text-date: 0.8125rem;    --text-date--line-height: 1.2;   /* mono, tabular */
  --text-title: 1.25rem;     --text-title--line-height: 1.3;
  --text-body: 1.0625rem;    --text-body--line-height: 1.6;
  --text-meta: 0.8125rem;    --text-meta--line-height: 1.5;

  /* the desktop rung of the two reading sizes: on a wide screen "bigger" means
     bigger type, never a longer line */
  --text-title-lg: 1.5rem;   --text-title-lg--line-height: 1.25;
  --text-body-lg: 1.1875rem; --text-body-lg--line-height: 1.65;

  /* the measure — the single highest-leverage decision on a reading surface, and
     the one `prose` would have made for us at 65ch */
  --container-measure: 33rem;         /* ≈60ch at 17px */

  /* rhythm: the gap BETWEEN registers is nearly twice the gap within one, which
     is how the grouping in §2 reads as grouping without a box */
  --spacing-entry: 2.25rem;
  --spacing-register: 4rem;
}
```

**The measure is never asked to hold CJK, and that is structural rather than
lucky** ([#24](https://github.com/SaKaNa-Y/Zis/issues/24)). `33rem ≈ 60ch` is
calibrated against Latin copy, and full-width glyphs would make 60 characters a
materially longer line — bilingual copy in one fixed measure is two typographic
systems, the same objection ADR-0009 raises against a density toggle. The reason
it cannot arise: the corpus is English, summaries are written in English
(`ingestion-pipeline.md`, stage 13), and the only other rendered string a reader
authors is an Interest — which reaches a page solely as the **argmax** why-text
(`ranking-model.md` §6), and a Chinese Interest can never *be* the argmax under an
English-only embedding model. So there is no path by which CJK text reaches this
column, and no second type scale is needed.

**Measure: ~60ch, deliberately tighter than `prose`'s 65ch**, because a summary is
two or three sentences and not an essay. The reading column tops out at 38rem at
the desktop type rung — the line length is capped, and **the width a wide screen
has spare is spent on other content, never on a longer line** (§10).

**Every size above is `rem` or `ch`, and that is a hard rule, not a habit**
(ADR-0009). It is what makes browser zoom and OS root-font-size a *complete*
text-size control: they scale the type and the 33rem measure together, so the line
holds at ~60ch instead of growing type inside a fixed column. Zis therefore ships
no font-size control of its own — the platform's is strictly better. The rule:
**no `px` in type size, line-height, spacing, or the measure**; `px` is permitted
for hairline borders, which should not scale with zoom. One `text-[17px]` breaks
this silently, so it is enforced as a **CI invariant** rather than by review,
riding the same explicit CI step #15's finding forces for #7's egress rule
(`next lint` is removed in Next.js 16). Owned by
[#12](https://github.com/SaKaNa-Y/Zis/issues/12).

**Colour is semantic only** — `paper`, `paper-sunk`, `ink`, `ink-dim`,
`ink-faint`, `rule`, `accent`. Dark mode redefines those seven tokens on `.dark`
and touches no markup: there is not one `dark:` utility in the design. That is
what makes light/dark parity structural rather than a review checklist, and it is
the one thing `antfu/design`'s language transfers (#15) — semantic tokens over raw
colours, parity as a hard rule, `font-mono tabular-nums` for the Brief date, one
obvious affordance rather than three competing ones.

**The seven tokens carry two more obligations, both from ADR-0009**: they must
survive **`forced-colors`** — where the OS replaces the palette outright, so
anything the design conveys by colour alone disappears — and they must honor
**`prefers-contrast`**, which is where `ink-dim` and `ink-faint` are at risk, since
a deliberately quiet why-text is the first thing a high-contrast reader loses.
This is the accessibility half of the customization question and it costs no
schema, no cookie, and no preference state. `prefers-reduced-motion` is moot: there
is no motion. **Verification belongs against a built page, not here** — it joins
keyboard navigation in the map's fog on #10's own reasoning.

## 10. Three zones, appearing as the viewport earns them

The wasted-width problem on a 2400px screen is not solved by widening the measure.
It is solved by giving the spare width to content:

| breakpoint | layout |
|---|---|
| phone | one column. Destinations in the footer, entry actions folded into a native `<details>` `⋯` |
| `lg` | **left rail** (sticky: destinations, Tags, Settings) + reading column; type steps to the `-lg` rung; entry actions become a visible row — `Save · Mark read · Why this?` |
| `xl` | **+ marginalia gutter**: the why-text moves out of the flow to the left of the title, right-aligned, so the explanation stops competing with the summary for one column |
| `2xl` | **+ right aside**: *In this brief* — the entries as numbered jump links, closing with "That is the whole brief" — and recent Saved |

The right aside is the one piece that needed an argument. **A table of contents for
a sealed, bounded artefact is not a count in disguise** — it is the boundary made
visible, and boundedness is the product's thesis. It ends by saying so. What it
must never become is a tally of what is unread.

Native elements throughout — `<details>`, `<select>`, `<form>`, `<dialog>` if a
dialog ever appears. **No component library, no headless primitive, no
`components.json`** (#15). The escape hatch recorded in #15's resolution stayed
unused: nothing in this design needed the first rung of it.

## 11. What this design refuses

- **No unread count**, in any disguise — including a per-day tally in Earlier and
  a badge on the aside.
- **No infinite scroll**, and no pagination in the Brief. It ends.
- **No "Everything" escape hatch**, and therefore no Discover, no browse-all, no
  search over the corpus.
- **No public page at all.** Every route is behind auth except `login`
  ([#8](https://github.com/SaKaNa-Y/Zis/issues/8) deleted the cron endpoint, so
  login is the only exception). There is no landing page and no signup route.
- **No image, no icon, no favicon** (#17). There is no image loading state and no
  broken-image state, because there is no image.
- **No badge** doing the work of the section heading in §2.
- **No shared `Card`.**
- **No layout customization, and no Layout section in Settings** (§0, ADR-0009).
  Not a deferral — the admissibility test leaves an empty candidate set. Text size
  and contrast are adjustable through the platform instead.
- **No `px`** in type size, line-height, spacing, or the measure (§9). Hairline
  borders excepted.
- **No i18n layer, no string table, and no language control** ([#24](https://github.com/SaKaNa-Y/Zis/issues/24)).
  Zis ships in **English only** — chrome, summaries, and Interests. Not a
  deferral: a language toggle serves a population, and Zis has one reader with one
  answer. A Chinese interface could not reach the parts a reader actually reads
  anyway — titles, Publisher names, and the verbatim why-text are all outside any
  i18n layer's reach (`ranking-model.md` §6) — so it would translate five nav
  labels and an empty state around English content. And a *summary*-language
  control fails ADR-0009 outright: different text is different information.
