# PROTOTYPE — IA + UI (#10)

Throwaway. **Open `index.html` in a browser** — no build step, no server. Tailwind
v4 loads from a CDN, so it needs network.

- `?variant=D|E|A|B|C` — arrow keys, or the bottom bar, cycle them
- `?state=full|short|empty|archive|signal|interests|saved|settings`
- `?phone=1` — constrains the frame to 390px

The decision this settled lives on `main` in [`docs/ui-and-ia.md`](../../../../docs/ui-and-ia.md).
Everything here is the primary source behind it, kept including the losers.

| variant | shape | verdict |
|---|---|---|
| **D — Marginalia + rails** | section break for the two Admission routes; left rail (destinations, Tags, Settings), reading column capped at 38rem, marginalia gutter at `xl`, right aside at `2xl` | **won**, after two rounds of review |
| E — Two-up, full bleed | no centred column; entries two- and three-up across the full width | rejected: makes `BriefEntry.position` ambiguous, and is a `Card` grid without the border |
| A — Two registers | the first round's section break, centred column, no rails | won round one on structure; its heading survives verbatim in D |
| B — Inverted heads | one stream, convergence entries lead with the why-line | rejected: two shapes in one list read as one shape done inconsistently |
| C — The wire | convergence in a right rail / phone `<details>` | rejected as structure (empty six days a week); its "because you said" voice was tried in D and then cut |

Data is fabricated, shaped from the real figures in `docs/ranking-model.md` §6
(origin-excluded Strength, three Publishers plus `+N`, argmax Interest only).

What was cut between round one and two, and why, if it comes up again:

- **"because you said …"** as an entry lead-in — reviewed live and dropped as too
  conversational. The matched Interest still shows, as `matched "…"`; it is the
  why-text and #9 requires it.
- **Light/dark as a rail item** — moved into Settings so the rail holds no loose
  chrome.
