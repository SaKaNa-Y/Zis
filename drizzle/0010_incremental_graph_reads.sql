CREATE TABLE "ingestion_checkpoint" (
	"id" smallint PRIMARY KEY NOT NULL,
	"processed_through" timestamp with time zone NOT NULL,
	"configuration_hash" text NOT NULL,
	CONSTRAINT "ingestion_checkpoint_singleton_check" CHECK ("ingestion_checkpoint"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "ingestion_input_hash" text;--> statement-breakpoint
CREATE INDEX "item_updated_at_idx" ON "item" USING btree ("updated_at");