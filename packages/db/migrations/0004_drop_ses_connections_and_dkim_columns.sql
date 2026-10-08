DROP TABLE "ses_connections" CASCADE;--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "dkim_tokens";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "dkim_signing_hosted_zone";