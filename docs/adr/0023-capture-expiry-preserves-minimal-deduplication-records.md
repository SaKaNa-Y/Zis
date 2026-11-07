# Capture expiry preserves minimal deduplication records

Status: accepted for the information capture redesign; not yet implemented.

Captured text and images expire seven days after first capture; updates do not
extend that deadline. Deleting every trace would allow a later collection run to
recreate expired content, so retain only the original post identifier and expiry
time for long-term deduplication, without text, screenshots, or summaries. The
user explicitly accepted this exception to seven-day content retention.

This decision applies to new information captures. Existing Brief history is
retained separately and is not migrated into the new information stream.
