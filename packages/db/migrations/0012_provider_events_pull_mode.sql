ALTER TABLE "provider_connections" DROP CONSTRAINT "provider_connections_events_confirmed_check";--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_mode" text;--> statement-breakpoint
UPDATE "provider_connections" SET "events_mode" = 'push' WHERE "events_url" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_poll_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_last_polled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_last_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_last_error" text;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_backlog" integer;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_dead_letters" integer;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "events_stats_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "provider_connections_events_poll_after_idx" ON "provider_connections" USING btree ("events_poll_after") WHERE "provider_connections"."events_poll_after" is not null;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_events_mode_check" CHECK ("provider_connections"."events_mode" is null or "provider_connections"."events_mode" in ('push', 'pull'));--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_events_url_check" CHECK (("provider_connections"."events_mode" is not distinct from 'push') = ("provider_connections"."events_url" is not null));--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_events_failures_check" CHECK ("provider_connections"."events_failures" >= 0);--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_events_confirmed_check" CHECK ("provider_connections"."events_confirmed_at" is null or "provider_connections"."events_mode" is not null);