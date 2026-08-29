CREATE TYPE "public"."citation_kind" AS ENUM('self', 'outbound');--> statement-breakpoint
CREATE TABLE "citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"kind" "citation_kind" NOT NULL,
	"raw_url" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "citation_item_kind_raw_url_unique" UNIQUE("item_id","kind","raw_url")
);
--> statement-breakpoint
CREATE TABLE "link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_link_id_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "citation_link_id_idx" ON "citation" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "citation_source_id_idx" ON "citation" USING btree ("source_id");--> statement-breakpoint
-- Legacy Item rows do not retain their original feed address. Clearing this
-- disposable cache makes every Source's next poll re-observe raw provenance
-- instead of fabricating Citation.raw_url from an already-canonical Item.url.
DELETE FROM "http_cache";
