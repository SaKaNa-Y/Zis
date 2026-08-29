CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."signal_text_basis" AS ENUM('own', 'citing', 'slug');--> statement-breakpoint
CREATE TABLE "interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"embedding" halfvec(384),
	"embedding_input_hash" text,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"embedding_version" text,
	"embedded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "interest_statement_nonempty_check" CHECK (length(btrim("interest"."statement")) > 0),
	CONSTRAINT "interest_embedding_complete_check" CHECK (("interest"."embedding" IS NULL
      AND "interest"."embedding_input_hash" IS NULL
      AND "interest"."embedding_model" IS NULL
      AND "interest"."embedding_dimensions" IS NULL
      AND "interest"."embedding_version" IS NULL
      AND "interest"."embedded_at" IS NULL)
      OR ("interest"."embedding" IS NOT NULL
        AND "interest"."embedding_input_hash" IS NOT NULL
        AND "interest"."embedding_model" IS NOT NULL
        AND "interest"."embedding_dimensions" = 384
        AND "interest"."embedding_version" IS NOT NULL
        AND "interest"."embedded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "reader_signal_match" (
	"user_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"matched_interest_id" uuid,
	"relevance" double precision,
	"gap" double precision,
	"matched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reader_signal_match_user_id_signal_id_pk" PRIMARY KEY("user_id","signal_id"),
	CONSTRAINT "reader_signal_match_winner_check" CHECK (("reader_signal_match"."matched_interest_id" IS NULL AND "reader_signal_match"."relevance" IS NULL AND "reader_signal_match"."gap" IS NULL)
      OR ("reader_signal_match"."matched_interest_id" IS NOT NULL AND "reader_signal_match"."relevance" IS NOT NULL)),
	CONSTRAINT "reader_signal_match_relevance_range_check" CHECK ("reader_signal_match"."relevance" IS NULL OR "reader_signal_match"."relevance" BETWEEN -1 AND 1),
	CONSTRAINT "reader_signal_match_gap_range_check" CHECK ("reader_signal_match"."gap" IS NULL OR "reader_signal_match"."gap" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "anchor_text" text;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "text_basis" "signal_text_basis";--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedding_text" text;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedding" halfvec(384);--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedding_dimensions" integer;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedding_version" text;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interest" ADD CONSTRAINT "interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_signal_match" ADD CONSTRAINT "reader_signal_match_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_signal_match" ADD CONSTRAINT "reader_signal_match_signal_id_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_signal_match" ADD CONSTRAINT "reader_signal_match_interest_owner_fk" FOREIGN KEY ("matched_interest_id","user_id") REFERENCES "public"."interest"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interest_user_id_idx" ON "interest" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reader_signal_match_signal_id_idx" ON "reader_signal_match" USING btree ("signal_id");--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_summary_length_check" CHECK ("item"."summary" IS NULL OR length("item"."summary") <= 1200) NOT VALID;--> statement-breakpoint
UPDATE "item" SET "summary" = left("summary", 1200) WHERE length("summary") > 1200;--> statement-breakpoint
ALTER TABLE "item" VALIDATE CONSTRAINT "item_summary_length_check";--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_embedding_complete_check" CHECK (("signal"."embedding" IS NULL
      AND "signal"."text_basis" IS NULL
      AND "signal"."embedding_text" IS NULL
      AND "signal"."embedding_model" IS NULL
      AND "signal"."embedding_dimensions" IS NULL
      AND "signal"."embedding_version" IS NULL
      AND "signal"."embedded_at" IS NULL)
      OR ("signal"."embedding" IS NOT NULL
        AND "signal"."text_basis" IS NOT NULL
        AND "signal"."embedding_text" IS NOT NULL
        AND "signal"."embedding_model" IS NOT NULL
        AND "signal"."embedding_dimensions" = 384
        AND "signal"."embedding_version" IS NOT NULL
        AND "signal"."embedded_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_embedding_text_length_check" CHECK ("signal"."embedding_text" IS NULL OR length("signal"."embedding_text") BETWEEN 1 AND 1200);
