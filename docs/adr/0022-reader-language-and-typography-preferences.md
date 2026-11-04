# Reader preferences can change presentation while preserving original Briefs

Status: accepted, 2026-10-08.

This decision revises ADR-0009 and the English-only decision in `ui-and-ia.md`.
The owner confirmed the complete Settings design before implementation.

The reader needs a Chinese interface and Chinese reading content, independent
language choices, and adjustable type for different screens. Browser zoom alone
also scales navigation and controls. It does not meet the request to adjust only
reading content.

Settings provides Light, Dark, and System appearance. Reading content supports
four sizes and Default, Sans serif, and Serif families. These preferences belong
to the current browser. Interface language and content language belong to the
reader and follow the account across devices. The interface supports English,
Simplified Chinese, and browser language detection. Content defaults to Chinese.

Translation is a separate view of titles, summaries, and Admission explanations.
Only public titles and summaries reach DeepSeek. Admission framing is localized
locally; the reader's Interest statement remains verbatim. Unrecognized historical
explanation formats remain in their original form. Model output cannot replace
the sealed explanation. This preserves the existing Interest privacy rule.
It never replaces stored originals, changes Brief membership or order, or changes
Interest matching. The reader can inspect the original beside translated content.
Earlier Briefs and Bookmarks use the same mechanism. External articles are outside
this scope. While translation is queued or fails, the original remains readable.

The owner chose background translation over web-server AI calls. DeepSeek keys
remain exclusive to Actions. After ingestion completes, a separate task queues the
current Brief and processes at most 50 translation requests within the remaining
normal-run database wake budget. Viewing older content
queues it for a later run. The same task supports manual dispatch. Prewarming and translation share a
120-second budget, with 25 seconds reserved before starting another request.
This bounds normal work admission, not arbitrary database stalls. A retry returns
a failed request to the queue; it does not promise an immediate translation.

Cached translations belong to a reader, target language, and hash of the full
original text. This keeps private Admission text isolated and prevents reuse after
a displayed source changes. A worker lease can expire after ten minutes. Completion
must match its attempt number so a stale worker cannot overwrite a newer result.

The cost is a second presentation of text and a queue that can outlive a daily
run. Machine translation can lose nuance, so originals remain accessible and
translations are labeled. Actual provider output still needs production review.
The original ban on changing membership, ordering, and hiding Admission text stands.

Settings uses one page: Appearance, Language, Reading style, Account security,
and secondary timing information. Reading style includes a bilingual preview and
reset. Account forms expand on request. No separate category navigation is needed.

The database migration must precede deployment. Configure `DEEPSEEK_API_KEY` only
in GitHub Actions. No migration or production deployment is part of this change.
