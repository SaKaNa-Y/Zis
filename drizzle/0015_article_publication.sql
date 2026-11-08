CREATE TABLE "article_reference" (
	"article_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	CONSTRAINT "article_reference_article_id_link_id_pk" PRIMARY KEY("article_id","link_id")
);
--> statement-breakpoint
CREATE TABLE "article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_key" text NOT NULL,
	"initial_digest" text NOT NULL,
	"content" jsonb NOT NULL,
	"draft" jsonb,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_publication_key_unique" UNIQUE("publication_key")
);
--> statement-breakpoint
CREATE TABLE "publication_result" (
	"run_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "publication_result_run_id_article_id_pk" PRIMARY KEY("run_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "publication_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_key" text NOT NULL,
	"retry_of" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"output_digest" text,
	CONSTRAINT "publication_run_attempt_key_unique" UNIQUE("attempt_key"),
	CONSTRAINT "publication_run_status_check" CHECK ("publication_run"."status" IN ('running','published','empty','failed'))
);
--> statement-breakpoint
ALTER TABLE "article_reference" ADD CONSTRAINT "article_reference_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_reference" ADD CONSTRAINT "article_reference_link_id_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_result" ADD CONSTRAINT "publication_result_run_id_publication_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."publication_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_result" ADD CONSTRAINT "publication_result_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_run" ADD CONSTRAINT "publication_run_retry_of_publication_run_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."publication_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_published_at_idx" ON "article" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "publication_run_started_at_idx" ON "publication_run" USING btree ("started_at");
--> statement-breakpoint
-- The published document keeps occurrence-specific titles and excerpts. A
-- foreign key also preserves the canonical Link after collection expiry.
CREATE FUNCTION sync_article_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  original text;
  canonical_id uuid;
BEGIN
  DELETE FROM article_reference WHERE article_id = NEW.id;
  FOR original IN SELECT DISTINCT c->>'url'
    FROM jsonb_array_elements(NEW.content->'sections') s,
         jsonb_array_elements(s->'paragraphs') p,
         jsonb_array_elements(p->'citations') c
    ORDER BY 1
  LOOP
    INSERT INTO link (url, first_seen_at) VALUES (original, now())
      ON CONFLICT (url) DO NOTHING;
    SELECT id INTO STRICT canonical_id FROM link WHERE url = original;
    INSERT INTO article_reference VALUES (NEW.id, canonical_id);
  END LOOP;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER article_sync_references AFTER INSERT OR UPDATE OF content ON article
  FOR EACH ROW EXECUTE FUNCTION sync_article_references();
--> statement-breakpoint
-- Atomically persist the complete batch and its outcome. An ambiguous commit
-- can be replayed with the same attempt or a new linked retry. Durable keys
-- protect Articles even after the associated runs have expired.
CREATE FUNCTION complete_publication(run uuid, outputs jsonb, empty_reason text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  previous text;
  output jsonb;
  completed_digest text;
  batch_digest text := encode(sha256(convert_to(outputs::text, 'UTF8')), 'hex');
  content_digest text;
  article_id uuid;
BEGIN
  SELECT status, output_digest INTO STRICT previous, completed_digest FROM publication_run WHERE id = run FOR UPDATE;
  IF previous IN ('published', 'empty') THEN
    IF completed_digest IS DISTINCT FROM batch_digest THEN
      RAISE EXCEPTION 'This attempt was already completed with different outputs';
    END IF;
    RETURN;
  END IF;
  IF previous <> 'running' THEN RAISE EXCEPTION 'Publication attempt is closed'; END IF;
  FOR output IN SELECT entry FROM jsonb_array_elements(outputs) entry ORDER BY entry->>'key'
  LOOP
    content_digest := encode(sha256(convert_to((output->'content')::text, 'UTF8')), 'hex');
    INSERT INTO article (publication_key, content, initial_digest)
      VALUES (output->>'key', output->'content', content_digest)
      ON CONFLICT (publication_key) DO NOTHING;
    SELECT id INTO article_id FROM article WHERE publication_key = output->>'key' AND initial_digest = content_digest;
    IF article_id IS NULL THEN RAISE EXCEPTION 'This Article key identifies different content'; END IF;
    INSERT INTO publication_result VALUES (run, article_id, output->'content'->>'title');
  END LOOP;
  UPDATE publication_run SET finished_at = now(), output_digest = batch_digest,
    status = CASE WHEN jsonb_array_length(outputs) = 0 THEN 'empty' ELSE 'published' END,
    reason = CASE WHEN jsonb_array_length(outputs) = 0 THEN empty_reason END
    WHERE id = run;
END
$$;
