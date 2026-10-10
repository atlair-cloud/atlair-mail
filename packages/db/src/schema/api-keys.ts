import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { apiKeyPermissions, type ApiKeyPermission } from "../types.ts";
import { id, isOneOf, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    permission: text("permission").$type<ApiKeyPermission>().notNull().default("full_access"),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    lastUsedAt: timestamptz("last_used_at"),
    revokedAt: timestamptz("revoked_at"),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("api_keys_token_hash_unique").on(t.tokenHash),
    index("api_keys_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    check("api_keys_name_check", sql`char_length(${t.name}) between 1 and 50`),
    check("api_keys_permission_check", isOneOf(t.permission, apiKeyPermissions)),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
