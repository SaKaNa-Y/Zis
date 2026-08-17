# No publisher HTML is ever stored or rendered

Status: accepted

Zis fetches arbitrary remote pages and shows the results in a browser, which is
normally an argument about sanitizers: clean at ingestion and store safe HTML, or
store raw and clean at render. Both answers reduce to "which sanitizer do we
trust, and for how long."

**We store neither. Extraction produces plain text, and no publisher-supplied
HTML is ever persisted or rendered.** A Brief Entry shows a title, an
LLM-written summary, and a link — none of which is publisher markup. The
sanitizer question does not get a better answer; it stops existing.

This is possible only because Zis is text-first by prior decision: article images
are stripped at ingestion, an Item carries at most one thumbnail URL, and the
matched Interest — not generated prose — is the why-text. Every consumer of Item
content (embedding for Interest matching, summarization) wants text anyway.

## Considered options

- **Sanitize at ingestion.** Storage is clean, but the stored data is only ever
  as good as the sanitizer on the day it ran. When the sanitizer improves, the
  corpus does not, and re-sanitizing is impossible because the input is gone.
- **Sanitize at render.** Safer against sanitizer drift, but pays on every view
  and keeps a hostile-HTML blast radius alive forever.
- **Store text only.** No sanitizer, no drift, no blast radius.

## Consequences

- **This is expensive to reverse.** Reversing it does not mean "start storing
  HTML from now on" — it means the existing corpus has no HTML and cannot get
  any, because feeds roll off and the pages are gone. #6 already hit exactly this
  retention wall on a one-day corpus. A future decision to render rich content
  starts from an empty history.
- Rich formatting in the brief — publisher block quotes, code blocks, tables — is
  given up. Nothing in the product currently renders these.
- **AI output is untrusted output.** A summary is rendered as text, never as
  HTML and never auto-linkified, so a model that invents a URL under prompt
  injection cannot produce a clickable one.
- The thumbnail URL survives as a URL, not as markup. Whether it is proxied or
  hotlinked is #17's decision; if proxied, the fetch goes through `safeFetch`
  like every other egress.
- Binds #8: the ingestion pipeline's extraction step returns text. A parser
  choice that returns a DOM for internal use is fine; persisting it is not.
