CREATE TYPE "public"."source_fetch_outcome" AS ENUM('ok', 'not_modified', 'http_error', 'timeout', 'robots_denied', 'parse_error', 'too_large');--> statement-breakpoint
CREATE TYPE "public"."source_transport" AS ENUM('rss', 'atom', 'hn_firebase', 'hn_algolia', 'github_graphql', 'bluesky_feed');--> statement-breakpoint
CREATE TABLE "http_cache" (
	"url" text PRIMARY KEY NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_status" integer,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"summary" text,
	"raw_feed_date" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_source_external_id_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "publisher_host" (
	"host" text PRIMARY KEY NOT NULL,
	"publisher_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publisher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publisher_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "robots_cache" (
	"host" text PRIMARY KEY NOT NULL,
	"verdict" text NOT NULL,
	"directives" jsonb NOT NULL,
	"status" integer NOT NULL,
	"content_type" text,
	"waf_action" text,
	"authoritative" boolean NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_fetch_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"outcome" "source_fetch_outcome" NOT NULL,
	"http_status" integer,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"transport" "source_transport" NOT NULL,
	"endpoint_url" text NOT NULL,
	"is_aggregator" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"retry_after_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"newest_item_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_endpoint_url_unique" UNIQUE("endpoint_url")
);
--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_host" ADD CONSTRAINT "publisher_host_publisher_id_publisher_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publisher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_fetch_log" ADD CONSTRAINT "source_fetch_log_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_publisher_id_publisher_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publisher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_published_at_idx" ON "item" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "robots_cache_expires_at_idx" ON "robots_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "source_fetch_log_source_started_idx" ON "source_fetch_log" USING btree ("source_id","started_at" DESC NULLS LAST);--> statement-breakpoint
-- The first production slice: one real RSS Source from docs/source-register.json.
-- This migration is applied manually only after taking Neon's one manual snapshot.
INSERT INTO "publisher" ("id", "slug", "name")
VALUES ('00000000-0000-4000-8000-000000000069', 'simonwillison', 'Simon Willison');--> statement-breakpoint
INSERT INTO "publisher_host" ("host", "publisher_id")
VALUES ('simonwillison.net', '00000000-0000-4000-8000-000000000069');--> statement-breakpoint
INSERT INTO "source" ("id", "publisher_id", "transport", "endpoint_url")
VALUES (
	'00000000-0000-4000-8000-000000006901',
	'00000000-0000-4000-8000-000000000069',
	'rss',
	'https://simonwillison.net/atom/everything/'
);
