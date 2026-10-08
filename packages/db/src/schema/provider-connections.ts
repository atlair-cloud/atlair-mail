import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { providerTypes, type ProviderSettings, type ProviderType } from "@atlair-mail/providers/types";
import { encryptionKeyVersion, id, isOneOf, timestamps } from "./_columns.ts";
import { organizationId } from "./organizations.ts";

export const providerConnections = pgTable(
  "provider_connections",
  {
    id: id(),
    organizationId: organizationId(),
    provider: text("provider").$type<ProviderType>().notNull(),
    settings: jsonb("settings").$type<ProviderSettings>().notNull(),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    encryptionKeyVersion: encryptionKeyVersion(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("provider_connections_organization_id_unique").on(t.organizationId),
    check("provider_connections_provider_check", isOneOf(t.provider, providerTypes)),
    check("provider_connections_settings_check", sql`jsonb_typeof(${t.settings}) = 'object'`),
  ],
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;
