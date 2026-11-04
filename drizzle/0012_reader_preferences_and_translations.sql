CREATE TABLE "reading_translation" (
	"user_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"language" text NOT NULL,
	"original" jsonb NOT NULL,
	"translated" jsonb,
	"state" text DEFAULT 'queued' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reading_translation_user_id_source_key_language_pk" PRIMARY KEY("user_id","source_key","language"),
	CONSTRAINT "reading_translation_language_check" CHECK ("reading_translation"."language" IN ('en', 'zh')),
	CONSTRAINT "reading_translation_state_check" CHECK ("reading_translation"."state" IN ('queued', 'processing', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "interface_language" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "content_language" text DEFAULT 'zh' NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_translation" ADD CONSTRAINT "reading_translation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_translation_queue_idx" ON "reading_translation" USING btree ("state","requested_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_interface_language_check" CHECK ("user"."interface_language" IN ('system', 'en', 'zh'));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_content_language_check" CHECK ("user"."content_language" IN ('en', 'zh'));