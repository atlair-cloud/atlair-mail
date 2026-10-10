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
ALTER TABLE "templates" RENAME COLUMN "version" TO "revision";--> statement-breakpoint
ALTER TABLE "templates" RENAME CONSTRAINT "templates_version_check" TO "templates_revision_check";--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT "emails_template_version_check";--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "latest_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "published_version" integer;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "published_revision" integer;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_published_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("published_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_id_number_unique" ON "template_versions" USING btree ("template_id","number");--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_latest_version_check" CHECK ("templates"."latest_version" >= 0);--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_published_version_check" CHECK ("templates"."published_version" is null or "templates"."published_version" between 1 and "templates"."latest_version");--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_published_revision_check" CHECK (("templates"."published_version" is null) = ("templates"."published_revision" is null) and ("templates"."published_revision" is null or "templates"."published_revision" between 1 and "templates"."revision"));--> statement-breakpoint
INSERT INTO "template_versions" ("id", "template_id", "organization_id", "number", "subject", "content", "theme", "variables", "published_by", "published_by_api_key_id", "published_at") SELECT gen_random_uuid(), "id", "organization_id", 1, "subject", "content", "theme", "variables", "updated_by", "updated_by_api_key_id", "updated_at" FROM "templates";--> statement-breakpoint
UPDATE "templates" SET "latest_version" = 1, "published_version" = 1, "published_revision" = "revision";--> statement-breakpoint
UPDATE "emails" SET "template_version" = 1 WHERE "template_id" IS NOT NULL;--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['template:publish'] WHERE "name" IN ('owner', 'admin') AND NOT ('template:publish' = ANY("permissions"));
