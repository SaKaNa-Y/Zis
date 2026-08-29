ALTER TABLE "user" ADD COLUMN "passphrase_hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
DO $seed$
DECLARE
	reader_count integer;
	seed_hash text := '$argon2id$v=19$m=65536,t=3,p=1$Px1TlfEaSA1kIkgdQj9m1Q$cn1Eec2sn0tKmWuqbWe5naSHbQJvVgKRxjAPXqHgNAw';
BEGIN
	SELECT count(*) INTO reader_count FROM "user";

	IF reader_count > 1 THEN
		RAISE EXCEPTION 'Zis auth requires exactly one reader; found %', reader_count;
	ELSIF reader_count = 0 THEN
		INSERT INTO "user" ("id", "passphrase_hash")
		VALUES ('fa3753c0-0571-4293-b39f-00ec610782d8', seed_hash);
	ELSE
		UPDATE "user" SET "passphrase_hash" = seed_hash;
	END IF;
END
$seed$;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "passphrase_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_passphrase_hash_argon2id_check" CHECK ("user"."passphrase_hash" LIKE '$argon2id$v=19$m=65536,t=3,p=1$%');--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_session_version_nonnegative_check" CHECK ("user"."session_version" >= 0);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_failed_attempts_nonnegative_check" CHECK ("user"."failed_attempts" >= 0);
