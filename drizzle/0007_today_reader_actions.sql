CREATE TABLE "bookmark" (
	"user_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_user_id_signal_id_pk" PRIMARY KEY("user_id","signal_id")
);
--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_signal_id_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_signal_id_idx" ON "bookmark" USING btree ("signal_id");