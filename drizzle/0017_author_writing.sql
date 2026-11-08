CREATE TABLE "writing_draft" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"content" jsonb,
	"article_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "writing_draft" ADD CONSTRAINT "writing_draft_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION publish_writing_draft(draft_id uuid, expected_revision int, validated_content jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  saved writing_draft%ROWTYPE;
  new_run uuid;
  published_id uuid;
  stable_key text := 'author-draft:' || draft_id::text;
BEGIN
  SELECT * INTO STRICT saved FROM writing_draft WHERE id = draft_id FOR UPDATE;
  IF saved.revision <> expected_revision THEN RAISE EXCEPTION 'Draft changed'; END IF;
  IF saved.article_id IS NOT NULL THEN RETURN saved.article_id; END IF;
  INSERT INTO publication_run (attempt_key) VALUES (stable_key) RETURNING id INTO new_run;
  PERFORM complete_publication(new_run, jsonb_build_array(jsonb_build_object('key',stable_key,'content',validated_content)), NULL);
  SELECT article_id INTO STRICT published_id FROM publication_result WHERE publication_result.run_id = new_run;
  UPDATE writing_draft SET article_id = published_id, content = NULL WHERE id = draft_id;
  RETURN published_id;
END
$$;
