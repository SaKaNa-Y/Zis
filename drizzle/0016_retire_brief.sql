-- Drizzle applies this migration in a transaction. Keep the legacy bookmark set
-- fixed between checking the archive and removing the tables it used to own.
LOCK TABLE bookmark, archived_bookmark, signal, link, citation, item, source IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM legacy_bookmark_snapshot EXCEPT SELECT * FROM archived_bookmark)
    UNION ALL
    (SELECT * FROM archived_bookmark EXCEPT SELECT * FROM legacy_bookmark_snapshot)
  ) THEN
    RAISE EXCEPTION 'Bookmark archive differs from the legacy bookmark set. Stop and reconcile before cutover.';
  END IF;
END $$;
--> statement-breakpoint
DROP VIEW legacy_bookmark_snapshot;
--> statement-breakpoint
-- RESTRICT (the default) makes unexpected downstream dependencies abort cutover.
DROP TABLE bookmark, read_state, brief_entry, brief, reader_signal_match,
  reader_match_profile, interest, reading_translation, citation, signal, item,
  source_fetch_log, ingestion_checkpoint, http_cache, robots_cache, source,
  publisher_host, publisher;
--> statement-breakpoint
DROP TYPE brief_admission, citation_kind, signal_text_basis, source_transport, source_fetch_outcome;
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN content_language, DROP COLUMN cut_hour;
