CREATE TABLE "capture_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"original_url" text NOT NULL,
	"thread_key" text NOT NULL,
	"thread_url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"incomplete_reason" text,
	"continuation_of" text
);
--> statement-breakpoint
CREATE TABLE "capture_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" text NOT NULL,
	"alt" text NOT NULL,
	"digest" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "capture_image_card_id_digest_key" UNIQUE("card_id","digest"),
	CONSTRAINT "capture_image_data_check" CHECK (octet_length("capture_image"."data") <= 524288),
	CONSTRAINT "capture_image_mime_type_check" CHECK ("capture_image"."mime_type" IN ('image/jpeg','image/png','image/webp'))
);
--> statement-breakpoint
CREATE TABLE "capture_post" (
	"original_key" text PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capture_receipt" (
	"original_key" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capture_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"added_count" integer DEFAULT 0 NOT NULL,
	"message" text,
	CONSTRAINT "capture_run_status_check" CHECK ("capture_run"."status" IN ('running','success','partial','failed')),
	CONSTRAINT "capture_run_added_count_check" CHECK ("capture_run"."added_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capture_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"tracking_since" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_source_url_unique" UNIQUE("url"),
	CONSTRAINT "capture_source_kind_check" CHECK ("capture_source"."kind" IN ('x','blog'))
);
--> statement-breakpoint
ALTER TABLE "capture_card" ADD CONSTRAINT "capture_card_source_id_capture_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."capture_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_image" ADD CONSTRAINT "capture_image_card_id_capture_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."capture_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_post" ADD CONSTRAINT "capture_post_card_id_capture_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."capture_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_run" ADD CONSTRAINT "capture_run_source_id_capture_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."capture_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_card_expiry_idx" ON "capture_card" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "capture_card_publication_idx" ON "capture_card" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "capture_card_thread_idx" ON "capture_card" USING btree ("thread_key");
--> statement-breakpoint
INSERT INTO capture_source(name,url,kind) VALUES
 ('@OpenAI','https://x.com/openai','x'), ('@thsottiaux','https://x.com/thsottiaux','x'),
 ('@NFT_Chen','https://x.com/nft_chen','x'), ('@Google','https://x.com/google','x'),
 ('@AnthropicAI','https://x.com/anthropicai','x'), ('@poteto','https://x.com/poteto','x'),
 ('OpenAI News','https://openai.com/news/','blog'),
 ('Claude Code','https://claude.com/resources/articles?products=claude-code','blog');
