# Original cards replace ranked Briefs

The reader now follows specific sources and wants their full original content
in publication order. New Information Cards bypass the legacy Signal, Admission,
Brief, and translation pipelines. The old history remains available, but its
source configuration and automatic workers are retired.

ADR-0006 and ADR-0007 still explain the historical Brief data. Their admission
and once-only appearance rules do not apply to the new flow. The former daily
pipeline schedule in ADR-0008 is retired. External browser collection is planned
for 08:00 and 20:00 Asia/Shanghai, separately from database cleanup.

Blog cards render safe Markdown and stored images. X posts render literal text.
This replaces ADR-0005's image-stripping decision for new captures. Publisher
HTML is still not rendered, and remote Markdown image URLs do not load directly.
