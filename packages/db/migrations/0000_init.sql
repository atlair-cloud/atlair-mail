CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TABLE "identity"."account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."rate_limit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"metadata" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_check" CHECK ("organizations"."slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$')
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"actor_api_key_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"permissions" text[] NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_permissions_check" CHECK (cardinality("roles"."permissions") > 0)
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"permission" text DEFAULT 'full_access' NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_name_check" CHECK (char_length("api_keys"."name") between 1 and 50),
	CONSTRAINT "api_keys_permission_check" CHECK ("api_keys"."permission" in ('full_access', 'sending_access'))
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"settings" jsonb NOT NULL,
	"account_id" text,
	"credentials_encrypted" text NOT NULL,
	"encryption_key_version" integer NOT NULL,
	"events_mode" text,
	"events_url" text,
	"events_confirmed_at" timestamp with time zone,
	"events_poll_after" timestamp with time zone,
	"events_last_polled_at" timestamp with time zone,
	"events_last_received_at" timestamp with time zone,
	"events_last_error" text,
	"events_failures" integer DEFAULT 0 NOT NULL,
	"events_backlog" integer,
	"events_dead_letters" integer,
	"events_stats_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_provider_check" CHECK ("provider_connections"."provider" in ('ses')),
	CONSTRAINT "provider_connections_settings_check" CHECK (jsonb_typeof("provider_connections"."settings") = 'object'),
	CONSTRAINT "provider_connections_events_confirmed_check" CHECK ("provider_connections"."events_confirmed_at" is null or "provider_connections"."events_mode" is not null),
	CONSTRAINT "provider_connections_events_mode_check" CHECK ("provider_connections"."events_mode" is null or "provider_connections"."events_mode" in ('push', 'pull')),
	CONSTRAINT "provider_connections_events_url_check" CHECK (("provider_connections"."events_mode" is not distinct from 'push') = ("provider_connections"."events_url" is not null)),
	CONSTRAINT "provider_connections_events_failures_check" CHECK ("provider_connections"."events_failures" >= 0)
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_name_check" CHECK ("domains"."name" = lower("domains"."name")),
	CONSTRAINT "domains_status_check" CHECK ("domains"."status" in ('pending', 'verified', 'failed')),
	CONSTRAINT "domains_dns_records_check" CHECK (jsonb_typeof("domains"."dns_records") = 'array')
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"template_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"subject" text NOT NULL,
	"content" jsonb NOT NULL,
	"theme" jsonb NOT NULL,
	"variables" jsonb NOT NULL,
	"note" text,
	"published_by" uuid,
	"published_by_api_key_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_versions_number_check" CHECK ("template_versions"."number" >= 1),
	CONSTRAINT "template_versions_note_check" CHECK (char_length("template_versions"."note") between 1 and 500),
	CONSTRAINT "template_versions_content_check" CHECK (jsonb_typeof("template_versions"."content") = 'object'),
	CONSTRAINT "template_versions_theme_check" CHECK (jsonb_typeof("template_versions"."theme") = 'object'),
	CONSTRAINT "template_versions_variables_check" CHECK (jsonb_typeof("template_versions"."variables") = 'array')
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"alias" text,
	"subject" text NOT NULL,
	"content" jsonb NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"latest_version" integer DEFAULT 0 NOT NULL,
	"published_version" integer,
	"published_revision" integer,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_name_check" CHECK (char_length("templates"."name") between 1 and 100),
	CONSTRAINT "templates_alias_check" CHECK ("templates"."alias" ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
	CONSTRAINT "templates_revision_check" CHECK ("templates"."revision" >= 1),
	CONSTRAINT "templates_latest_version_check" CHECK ("templates"."latest_version" >= 0),
	CONSTRAINT "templates_published_version_check" CHECK ("templates"."published_version" is null or "templates"."published_version" between 1 and "templates"."latest_version"),
	CONSTRAINT "templates_published_revision_check" CHECK (("templates"."published_version" is null) = ("templates"."published_revision" is null) and ("templates"."published_revision" is null or "templates"."published_revision" between 1 and "templates"."revision")),
	CONSTRAINT "templates_content_check" CHECK (jsonb_typeof("templates"."content") = 'object'),
	CONSTRAINT "templates_theme_check" CHECK (jsonb_typeof("templates"."theme") = 'object'),
	CONSTRAINT "templates_variables_check" CHECK (jsonb_typeof("templates"."variables") = 'array')
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid,
	"created_by" uuid,
	"template_id" uuid,
	"template_version" integer,
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
	"request_fingerprint" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emails_status_check" CHECK ("emails"."status" in ('queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'canceled')),
	CONSTRAINT "emails_to_addresses_check" CHECK (cardinality("emails"."to_addresses") > 0),
	CONSTRAINT "emails_idempotency_check" CHECK (("emails"."idempotency_key" is null) = ("emails"."request_fingerprint" is null)),
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
	CONSTRAINT "email_events_type_check" CHECK ("email_events"."type" in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'rejected', 'opened', 'clicked', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "suppressed_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"source_email_id" uuid,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
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
	"previous_signing_secret_encrypted" text,
	"previous_encryption_key_version" integer,
	"previous_secret_expires_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_event_types_check" CHECK (cardinality("webhook_endpoints"."event_types") > 0),
	CONSTRAINT "webhook_endpoints_event_types_known_check" CHECK ("webhook_endpoints"."event_types" <@ array['sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'rejected', 'opened', 'clicked', 'failed']::text[]),
	CONSTRAINT "webhook_endpoints_previous_secret_check" CHECK (("webhook_endpoints"."previous_signing_secret_encrypted" is null) = ("webhook_endpoints"."previous_encryption_key_version" is null) and ("webhook_endpoints"."previous_signing_secret_encrypted" is null) = ("webhook_endpoints"."previous_secret_expires_at" is null))
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
ALTER TABLE "identity"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_api_key_id_api_keys_id_fk" FOREIGN KEY ("actor_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_published_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("published_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_email_event_id_email_events_id_fk" FOREIGN KEY ("email_event_id") REFERENCES "public"."email_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_id_account_id_unique" ON "identity"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "identity"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_key_unique" ON "identity"."rate_limit" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "identity"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "identity"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "identity"."user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "identity"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_id_idx" ON "audit_logs" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_organization_id_user_id_unique" ON "members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "members_role_id_idx" ON "members" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_organization_id_name_unique" ON "roles" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_token_hash_unique" ON "api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_keys_organization_id_created_at_idx" ON "api_keys" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_organization_id_unique" ON "provider_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_provider_account_id_unique" ON "provider_connections" USING btree ("provider","account_id");--> statement-breakpoint
CREATE INDEX "provider_connections_events_poll_after_idx" ON "provider_connections" USING btree ("events_poll_after") WHERE "provider_connections"."events_poll_after" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "domains_organization_id_name_unique" ON "domains" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "domains_last_checked_at_pending_idx" ON "domains" USING btree ("last_checked_at") WHERE "domains"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_id_number_unique" ON "template_versions" USING btree ("template_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_organization_id_name_unique" ON "templates" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_organization_id_alias_unique" ON "templates" USING btree ("organization_id","alias");--> statement-breakpoint
CREATE INDEX "emails_send_at_queued_idx" ON "emails" USING btree ("send_at") WHERE "emails"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "emails_locked_until_sending_idx" ON "emails" USING btree ("locked_until") WHERE "emails"."status" = 'sending';--> statement-breakpoint
CREATE INDEX "emails_organization_id_created_at_idx" ON "emails" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_organization_id_id_idx" ON "emails" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "emails_api_key_id_created_at_idx" ON "emails" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_template_id_idx" ON "emails" USING btree ("template_id") WHERE "emails"."template_id" is not null;--> statement-breakpoint
CREATE INDEX "emails_domain_id_idx" ON "emails" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_provider_message_id_unique" ON "emails" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_organization_id_idempotency_key_unique" ON "emails" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_email_id_provider_event_id_unique" ON "email_events" USING btree ("email_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "email_events_email_id_occurred_at_idx" ON "email_events" USING btree ("email_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressed_addresses_organization_id_address_unique" ON "suppressed_addresses" USING btree ("organization_id","address");--> statement-breakpoint
CREATE INDEX "suppressed_addresses_source_email_id_idx" ON "suppressed_addresses" USING btree ("source_email_id");--> statement-breakpoint
CREATE INDEX "suppressed_addresses_organization_id_id_idx" ON "suppressed_addresses" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_organization_id_idx" ON "webhook_endpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_webhook_endpoint_id_email_event_id_unique" ON "webhook_deliveries" USING btree ("webhook_endpoint_id","email_event_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_email_event_id_idx" ON "webhook_deliveries" USING btree ("email_event_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_endpoint_id_id_idx" ON "webhook_deliveries" USING btree ("webhook_endpoint_id","id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_next_attempt_at_pending_idx" ON "webhook_deliveries" USING btree ("next_attempt_at") WHERE "webhook_deliveries"."status" = 'pending';--> statement-breakpoint
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
