CREATE TABLE "ses_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"region" text NOT NULL,
	"access_key_id" text NOT NULL,
	"secret_access_key_encrypted" text NOT NULL,
	"encryption_key_version" integer NOT NULL,
	"configuration_set" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dkim_tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_name_check" CHECK ("domains"."name" = lower("domains"."name")),
	CONSTRAINT "domains_status_check" CHECK ("domains"."status" in ('pending', 'verified', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid,
	"domain_id" uuid NOT NULL,
	"from_address" text NOT NULL,
	"to_addresses" text[] DEFAULT '{}'::text[] NOT NULL,
	"cc_addresses" text[] DEFAULT '{}'::text[] NOT NULL,
	"bcc_addresses" text[] DEFAULT '{}'::text[] NOT NULL,
	"reply_to_addresses" text[] DEFAULT '{}'::text[] NOT NULL,
	"subject" text NOT NULL,
	"html_body" text,
	"text_body" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"send_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider_message_id" text,
	"idempotency_key" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emails_status_check" CHECK ("emails"."status" in ('queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'canceled')),
	CONSTRAINT "emails_to_addresses_check" CHECK (cardinality("emails"."to_addresses") > 0),
	CONSTRAINT "emails_body_check" CHECK ("emails"."html_body" is not null or "emails"."text_body" is not null)
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_type_check" CHECK ("email_events"."type" in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'rejected', 'opened', 'clicked'))
);
--> statement-breakpoint
CREATE TABLE "suppressed_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressed_addresses_address_check" CHECK ("suppressed_addresses"."address" = lower("suppressed_addresses"."address")),
	CONSTRAINT "suppressed_addresses_reason_check" CHECK ("suppressed_addresses"."reason" in ('hard_bounce', 'complaint', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"url" text NOT NULL,
	"event_types" text[] NOT NULL,
	"signing_secret_encrypted" text NOT NULL,
	"encryption_key_version" integer NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_event_types_check" CHECK (cardinality("webhook_endpoints"."event_types") > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"webhook_endpoint_id" uuid NOT NULL,
	"email_event_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_response_status" integer,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_status_check" CHECK ("webhook_deliveries"."status" in ('pending', 'delivered', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ses_connections" ADD CONSTRAINT "ses_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_email_event_id_email_events_id_fk" FOREIGN KEY ("email_event_id") REFERENCES "public"."email_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ses_connections_organization_id_unique" ON "ses_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_organization_id_name_unique" ON "domains" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "domains_last_checked_at_pending_idx" ON "domains" USING btree ("last_checked_at") WHERE "domains"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "emails_send_at_queued_idx" ON "emails" USING btree ("send_at") WHERE "emails"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "emails_locked_until_sending_idx" ON "emails" USING btree ("locked_until") WHERE "emails"."status" = 'sending';--> statement-breakpoint
CREATE INDEX "emails_organization_id_created_at_idx" ON "emails" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_api_key_id_created_at_idx" ON "emails" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_domain_id_idx" ON "emails" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_provider_message_id_unique" ON "emails" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_organization_id_idempotency_key_unique" ON "emails" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_provider_event_id_unique" ON "email_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "email_events_email_id_occurred_at_idx" ON "email_events" USING btree ("email_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressed_addresses_organization_id_address_unique" ON "suppressed_addresses" USING btree ("organization_id","address");--> statement-breakpoint
CREATE INDEX "suppressed_addresses_source_email_id_idx" ON "suppressed_addresses" USING btree ("source_email_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_organization_id_idx" ON "webhook_endpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_webhook_endpoint_id_email_event_id_unique" ON "webhook_deliveries" USING btree ("webhook_endpoint_id","email_event_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_email_event_id_idx" ON "webhook_deliveries" USING btree ("email_event_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_next_attempt_at_pending_idx" ON "webhook_deliveries" USING btree ("next_attempt_at") WHERE "webhook_deliveries"."status" = 'pending';