CREATE TABLE "archived_bookmark" (
	"user_id" uuid NOT NULL,
	"legacy_signal_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"summary" text,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "archived_bookmark_user_id_legacy_signal_id_pk" PRIMARY KEY("user_id","legacy_signal_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'reader' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "archived_bookmark" ADD CONSTRAINT "archived_bookmark_link_id_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_unique" UNIQUE("role");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('author', 'reader'));
--> statement-breakpoint
-- The unique role constraint above also rejects an ambiguous multi-user legacy DB.
UPDATE "user" SET role = 'author';
--> statement-breakpoint
LOCK TABLE bookmark, signal, link, citation, item, source IN SHARE MODE;
--> statement-breakpoint
CREATE VIEW legacy_bookmark_snapshot AS
WITH RECURSIVE ancestry(saved_signal, member) AS (
  SELECT signal_id, signal_id FROM bookmark
  UNION
  SELECT a.saved_signal, s.merged_into_id FROM ancestry a
  JOIN signal s ON s.id = a.member WHERE s.merged_into_id IS NOT NULL
), roots AS (
  SELECT a.saved_signal, s.id AS root_id, s.target_link_id, s.embedding_text
  FROM ancestry a JOIN signal s ON s.id = a.member WHERE s.merged_into_id IS NULL
), members(root_id, member) AS (
  SELECT DISTINCT root_id, root_id FROM roots
  UNION
  SELECT m.root_id, s.id FROM members m JOIN signal s ON s.merged_into_id = m.member
), evidence AS (
  SELECT m.root_id, c.kind, c.id AS citation_id, i.id AS item_id, i.title,
    CASE WHEN btrim(i.text) <> '' AND i.text IS DISTINCT FROM i.summary THEN i.text END AS body,
    i.summary, c.anchor_text, source.is_aggregator
  FROM members m JOIN signal s ON s.id = m.member
  JOIN citation c ON c.link_id = s.target_link_id JOIN item i ON i.id = c.item_id
  LEFT JOIN source ON source.id = i.source_id
), snapshot AS (
  SELECT root_id,
    (array_agg(title ORDER BY length(coalesce(summary,'')) DESC, item_id) FILTER (WHERE kind = 'self'))[1] AS own_title,
    (array_agg(body ORDER BY length(body) DESC, item_id) FILTER (WHERE kind = 'self' AND body IS NOT NULL))[1] AS body,
    (array_agg(summary ORDER BY length(summary) DESC, item_id) FILTER (WHERE kind = 'self' AND btrim(summary) <> ''))[1] AS summary,
    (array_agg(anchor_text ORDER BY length(anchor_text) DESC, citation_id) FILTER (WHERE kind = 'outbound' AND anchor_text IS NOT NULL))[1] AS anchor,
    (array_agg(title ORDER BY length(title) DESC, item_id) FILTER (WHERE kind = 'outbound' AND NOT is_aggregator))[1] AS citing_title
  FROM evidence GROUP BY root_id
)
SELECT b.user_id, b.signal_id AS legacy_signal_id, l.id AS link_id,
  coalesce(snap.own_title, snap.anchor, snap.citing_title, r.embedding_text, l.url) AS title,
  snap.body, snap.summary, b.saved_at
FROM bookmark b LEFT JOIN roots r ON r.saved_signal = b.signal_id
LEFT JOIN link l ON l.id = r.target_link_id LEFT JOIN snapshot snap ON snap.root_id = r.root_id;
--> statement-breakpoint
INSERT INTO archived_bookmark (user_id, legacy_signal_id, link_id, title, body, summary, saved_at)
SELECT user_id, legacy_signal_id, link_id, title, body, summary, saved_at FROM legacy_bookmark_snapshot;
--> statement-breakpoint
DO $reconcile$
BEGIN
  IF EXISTS (
    SELECT user_id, signal_id, saved_at FROM bookmark
    EXCEPT SELECT user_id, legacy_signal_id, saved_at FROM archived_bookmark
  ) THEN
    RAISE EXCEPTION 'A legacy bookmark could not be preserved; migration aborted';
  END IF;
END
$reconcile$;
