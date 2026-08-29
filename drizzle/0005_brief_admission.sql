CREATE TYPE "public"."brief_admission" AS ENUM('interest', 'convergence');--> statement-breakpoint
CREATE TABLE "brief_entry" (
	"brief_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"admitted_by" "brief_admission" NOT NULL,
	"why_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brief_entry_brief_id_signal_id_pk" PRIMARY KEY("brief_id","signal_id"),
	CONSTRAINT "brief_entry_user_id_signal_id_unique" UNIQUE("user_id","signal_id"),
	CONSTRAINT "brief_entry_brief_id_position_unique" UNIQUE("brief_id","position"),
	CONSTRAINT "brief_entry_position_positive_check" CHECK ("brief_entry"."position" >= 1),
	CONSTRAINT "brief_entry_why_text_nonempty_check" CHECK (length(btrim("brief_entry"."why_text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "brief" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"cut_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brief_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "brief_user_id_local_date_unique" UNIQUE("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "read_state" (
	"user_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "read_state_user_id_signal_id_pk" PRIMARY KEY("user_id","signal_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'Asia/Shanghai' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cut_hour" smallint DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "brief_entry" ADD CONSTRAINT "brief_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_entry" ADD CONSTRAINT "brief_entry_signal_id_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_entry" ADD CONSTRAINT "brief_entry_brief_owner_fk" FOREIGN KEY ("brief_id","user_id") REFERENCES "public"."brief"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_state" ADD CONSTRAINT "read_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_state" ADD CONSTRAINT "read_state_signal_id_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "read_state_signal_id_idx" ON "read_state" USING btree ("signal_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_timezone_nonempty_check" CHECK (length(btrim("user"."timezone")) > 0);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_cut_hour_range_check" CHECK ("user"."cut_hour" BETWEEN 0 AND 23);