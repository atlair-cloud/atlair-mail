CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"settings" jsonb NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"encryption_key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_provider_check" CHECK ("provider_connections"."provider" in ('ses')),
	CONSTRAINT "provider_connections_settings_check" CHECK (jsonb_typeof("provider_connections"."settings") = 'object')
);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_organization_id_unique" ON "provider_connections" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_dns_records_check" CHECK (jsonb_typeof("domains"."dns_records") = 'array');