# Settings research

Date: 2026-10-08

Status: design confirmed for implementation on 2026-10-08. See ADR-0022.

## Confirmed need

The owner wants Settings to cover reading and personal settings. Interests keep
their separate destination; Source management and ingestion operations are outside
this page's scope. Dark mode and language are explicit priorities. Language means
both a Chinese interface and Chinese reading content, including titles, summaries,
and explanations of Admission. This establishes the need, not the implementation.

The owner confirmed separate interface and content language choices, with Chinese
and English as the initial options. Content defaults to Chinese, with access to
the original text. The initial translation scope covers titles, summaries, and
Admission explanations within Zis, not external full articles.

The owner also confirmed font size and font family controls for reading content:
titles, summaries, and Admission explanations, including their original text.
Navigation, buttons, and Settings retain their interface typography. Size choices
are Small, Standard, Large, and Extra large. Font choices are Default, Sans serif,
and Serif, with Chinese and English previews. Changes apply immediately and offer
a reset to defaults. Exact font families remain undecided.

Theme, font size, and font family belong to the current browser. Interface and
content language follow the reader across devices. These decisions reopen the
existing policy that leaves text adjustment to the browser. Export and
notifications are not included in the current iteration.

## Baseline before the redesign (2026-10-08)

[The Settings route](../../src/app/settings/page.tsx) contained Appearance,
read-only daily Brief timing, and Account. [Appearance](../../src/lib/settings/appearance.ts)
supports light, dark, and system. [Account controls](../../src/app/settings/controls.tsx)
offer passphrase changes and signing out everywhere.

[UI and IA, section 8](../ui-and-ia.md#8-settings--reader-preferences-and-account-security)
specifies a browser-local theme cookie, immediate saving, and system as the default.
It separates the ingestion cut condition from the actual generation schedule.

The same document explicitly chooses English-only chrome, summaries, and Interests
and prohibits a language control. This is a prior decision to reopen, not an
unimplemented feature. [ADR-0009](../adr/0009-a-presentation-control-changes-neither-information-nor-order.md)
requires presentation controls to preserve rendered information and order.
The [Brief definition](../../CONTEXT.md) also requires a sealed selection and frozen
explanations. Translation therefore needs an explicit relationship to original text.

## Primary-source observations

These are documented product behaviors, not hands-on verification of their apps.
Older release posts are identified as historical examples.

| Product | Documented behavior | Relevance to Zis |
| --- | --- | --- |
| Readwise Reader | Light, dark, and automatic OS appearance; reading appearance also includes font size, spacing, and width. [Appearance documentation](https://docs.readwise.io/reader/docs/faqs/appearance). | Three theme modes are a useful baseline already supported by Zis. Its full-text reading controls are not automatically appropriate for a bounded Brief. |
| Readwise Reader | Account profile provides CSV library export, OPML feed export, and full-file export. [Export documentation](https://docs.readwise.io/reader/docs/faqs/exporting). | Personal-data export belongs naturally near account settings; Zis needs its own export contract, not another product's formats or full-content promise. |
| Readwise Reader | Account settings can disable its Daily Digest and emails. OS settings separately control badge notifications. [Daily Digest documentation](https://docs.readwise.io/reader/docs/faqs/daily-digest). | Delivery, permission, and generation are different concerns. This does not establish a need for notifications in Zis. |
| Inoreader | Translation offers can be always, never, or only outside languages the reader understands. Readers can select a preferred translation language. [Translation help](https://www.inoreader.com/help/pro/article-translations/can-i-control-when-article-translations-are-offered). | Separate output language from languages the reader understands; neither implies filtering out content. |
| Inoreader | Its January 2026 guide describes translating an article and switching back to the original. [Reading guide](https://www.inoreader.com/blog/2026/01/consume-content-your-way.html). | A reversible translated view is a useful precedent for keeping source text inspectable. |
| Instapaper | Current documentation navigation separates Account (including export, email settings, password reset, and deletion) from Read/Text Settings. [Documentation](https://www.instapaper.com/docs/getting-started/create-account). | Account operations and reading preferences have different purposes. This navigation is evidence of categories, not a verified Settings layout. |
| Instapaper | The 2019 iOS release followed system dark mode; the 2024 iOS/macOS release documented system-browser and True Black settings. [2019 release](https://blog.instapaper.com/post/187964652031), [2024 release](https://blog.instapaper.com/post/748647273401139200/summaries-custom-article-actions-obsidian). | Historical examples show that a preference should solve a concrete reading or device need. They do not prove current cross-platform parity. |

## Initial recommendations (historical)

1. **Appearance:** keep Light / Dark / Follow system, with immediate feedback and
   a clear browser-local scope. Extra palettes need an actual reader need.
2. **Language:** distinguish interface language from reading-content language in
   the model, even if one simple UI initially sets both. A translated view that
   preserves inspectable originals is a candidate; it is not yet the decision.
3. **Account:** retain passphrase and session actions. Keep long forms collapsed
   until invoked. A single-user installation does not automatically need profile,
   billing, subscription, or account-deletion sections.
4. **Personal data:** discuss exporting Bookmarks and Interests first. Specify
   whether the goal is a readable archive, migration, or full backup before choosing
   a format. Avoid advertising controls before they work.
5. **Daily Brief:** retain useful schedule information as concise secondary copy.
   Do not offer a delivery-time preference unless scheduling actually honors it.
6. **Notifications and reading controls:** add only after a concrete use case.
   A completed-Brief reminder is distinct from ingestion alerts. Font and density
   controls would reopen existing decisions; browser accessibility support still
   needs to work independently of a settings panel.

A compact single page with labeled rows is the initial layout hypothesis:
Appearance, Language, then Account; Data and notifications appear only if selected
for implementation. A second navigation system is unnecessary until the setting
inventory becomes large. This is a recommendation, not a research finding.

## Implementation choices

Reading size uses scale factors 0.9, 1, 1.15, and 1.3. Font stacks use local
system fonts with Chinese and English sans-serif or serif fallbacks. Public
titles and summaries use DeepSeek in the background. Admission framing is
localized locally and Interest text remains verbatim. Cached results are owned
by the reader and keyed by the original text and target language.
The owner approved implementation and selected background translation with cached results.

## Confirmed translation behavior and layout

Translation covers earlier Briefs and Bookmarks as well as the current Brief.
Chinese is a translated view over the original text. It does not regenerate a
Brief, change its entries or order, or overwrite its frozen text. Technical names,
code, and product names retain original wording where needed.

The original remains readable while translation is pending or unavailable.
Show an explicit pending state or a failure message with a retry action. Place
the original-text action beside the reading content. Settings controls the default
language. Content-language filtering is outside the agreed scope.

The owner confirmed a single Settings page with these groups, in order:

1. Appearance: Light, Dark, and Follow system.
2. Language: interface language and content language.
3. Reading style: size, font family, preview, and reset to reading-style defaults.
4. Account security: passphrase changes and signing out everywhere.
5. Footer information: a short Brief schedule explanation with expandable details.

On desktop, each row places its label and short explanation on the left and its
control on the right. Mobile stacks these elements. A Chinese and English sample
follows the typography controls, with a title, summary, and Admission explanation.
Account forms expand when invoked. Settings has no additional category sidebar.

The owner confirmed the complete design and authorized implementation. ADR-0022
records the changes to the previous language and typography decisions.

No application behavior or existing policy documents were changed for this note.

## Implementation checkpoint: paused by the owner

Paused on 2026-10-08. Changes remain uncommitted in the working tree. No production
database migration, provider call, workflow dispatch, or deployment was performed.

Implemented code includes the Settings layout, browser typography preferences,
reader language preferences, interface translations, and a background translation
queue with a separate Actions workflow. Migration 0012 adds the required storage.

Verification completed: 58 test files and 555 tests passed on Node 22.23.2. The
production webpack build passed before the final small UI and test adjustments.
Type checking, lint, no-px, and environment checks passed before the final feedback
label adjustment. Desktop and 390px mobile browser checks used actual Settings
components with mocked persistence. Dark mode, Extra large Serif, reset, and an
independent interface language switch worked. No mobile horizontal overflow was
observed. This does not verify production translation quality or account sync in
a deployed browser.

Resume with a final diff review and reconciliation of older documentation claims.
Check remaining interface and archive-title translation coverage, confirm queued
translation and error recovery behavior in the browser, and rerun the final build
and static checks after any changes. Production activation still needs the
database migration and the Actions-only DeepSeek secret. The temporary preview
server and browser tab were stopped, and preview files were removed.

## Final local review: 2026-10-25

The owner resumed review and verification. Both Standards findings (private
Interest text in provider input and unbounded sequential translation work) and
both Spec findings (Earlier title coverage and localized accessibility labels)
were fixed and independently rechecked. All 562 tests passed, along with the
production build, type checking, lint, and repository static checks.

Browser fixtures verified translation progress, failure, retry and original-text
states, plus mobile layout and failed-save rollback. These checks use mocked
server persistence; live provider quality, migration 0012, and deployed sessions
remain activation checks. Product changes remain uncommitted and undeployed.

The current implementation status and replay evidence live in the
[primary working record](../../../working-records/zis/001-reader-settings.md).
