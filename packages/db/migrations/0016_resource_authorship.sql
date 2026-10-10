ALTER TABLE "api_keys" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "updated_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "updated_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "updated_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "updated_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_updated_by_api_key_id_api_keys_id_fk" FOREIGN KEY ("updated_by_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;