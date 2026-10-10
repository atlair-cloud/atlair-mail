CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"alias" text,
	"subject" text NOT NULL,
	"content" jsonb NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_by_api_key_id" uuid,
	"updated_by" uuid,
	"updated_by_api_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_name_check" CHECK (char_length("templates"."name") between 1 and 100),
	CONSTRAINT "templates_alias_check" CHECK ("templates"."alias" ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
	CONSTRAINT "templates_version_check" CHECK ("templates"."version" >= 1),
	CONSTRAINT "templates_content_check" CHECK (jsonb_typeof("templates"."content") = 'object'),
	CONSTRAINT "templates_theme_check" CHECK (jsonb_typeof("templates"."theme") = 'object'),
	CONSTRAINT "templates_variables_check" CHECK (jsonb_typeof("templates"."variables") = 'array')
);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "template_version" integer;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_organization_id_name_unique" ON "templates" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_organization_id_alias_unique" ON "templates" USING btree ("organization_id","alias");--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emails_template_id_idx" ON "emails" USING btree ("template_id") WHERE "emails"."template_id" is not null;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_template_version_check" CHECK ("emails"."template_id" is null or "emails"."template_version" is not null);--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['template:view'] WHERE NOT ('template:view' = ANY("permissions"));--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['template:create', 'template:update', 'template:delete'] WHERE "name" IN ('owner', 'admin') AND NOT ('template:create' = ANY("permissions"));
