CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_link_id" uuid NOT NULL,
	"merged_into_id" uuid,
	"strength" integer DEFAULT 0 NOT NULL,
	"origin_publisher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_target_link_id_unique" UNIQUE("target_link_id")
);
--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_target_link_id_link_id_fk" FOREIGN KEY ("target_link_id") REFERENCES "public"."link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_merged_into_id_signal_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."signal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_origin_publisher_id_publisher_id_fk" FOREIGN KEY ("origin_publisher_id") REFERENCES "public"."publisher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Links created before eager Signals shipped receive their ordinary 1:1 row.
INSERT INTO "signal" ("id", "target_link_id", "created_at")
SELECT "id", "id", "created_at" FROM "link";--> statement-breakpoint
CREATE INDEX "signal_merged_into_id_idx" ON "signal" USING btree ("merged_into_id");
