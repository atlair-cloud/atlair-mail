import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Permission } from "../types.ts";
import { apiKeys } from "./api-keys.ts";
import { createdAt, id, timestamps } from "./_columns.ts";
import { userId, users } from "./auth.ts";
import { organizationId, organizations } from "./organizations.ts";

export const roles = pgTable(
  "roles",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    permissions: text("permissions").array().$type<Permission[]>().notNull(),
    createdBy: userId("created_by"),
    updatedBy: userId("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("roles_organization_id_name_unique").on(t.organizationId, t.name),
    check("roles_permissions_check", sql`cardinality(${t.permissions}) > 0`),
  ],
);

export const members = pgTable(
  "members",
  {
    id: id(),
    organizationId: organizationId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdBy: userId("created_by"),
    updatedBy: userId("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("members_organization_id_user_id_unique").on(t.organizationId, t.userId),
    index("members_user_id_idx").on(t.userId),
    index("members_role_id_idx").on(t.roleId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    actorUserId: userId("actor_user_id"),
    actorApiKeyId: uuid("actor_api_key_id").references((): AnyPgColumn => apiKeys.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_organization_id_id_idx").on(t.organizationId, t.id),
    index("audit_logs_entity_type_entity_id_idx").on(t.entityType, t.entityId),
  ],
);

export type Role = typeof roles.$inferSelect;
export type Member = typeof members.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
