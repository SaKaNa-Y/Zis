CREATE TABLE "reader_match_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	CONSTRAINT "reader_match_profile_fingerprint_check" CHECK ("reader_match_profile"."fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "reader_match_profile" ADD CONSTRAINT "reader_match_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;