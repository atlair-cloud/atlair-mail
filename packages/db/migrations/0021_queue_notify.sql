CREATE FUNCTION "atlair_notify_work"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('atlair_work', TG_ARGV[0]);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "emails_notify_work"
AFTER INSERT OR UPDATE OF "status", "send_at" ON "emails"
FOR EACH ROW WHEN (NEW."status" = 'queued')
EXECUTE FUNCTION "atlair_notify_work"('email');
--> statement-breakpoint
CREATE TRIGGER "webhook_deliveries_notify_work"
AFTER INSERT ON "webhook_deliveries"
FOR EACH ROW EXECUTE FUNCTION "atlair_notify_work"('webhook');
--> statement-breakpoint
CREATE TRIGGER "provider_connections_notify_work"
AFTER UPDATE OF "events_poll_after" ON "provider_connections"
FOR EACH ROW WHEN (OLD."events_poll_after" IS NULL AND NEW."events_poll_after" IS NOT NULL)
EXECUTE FUNCTION "atlair_notify_work"('events');
