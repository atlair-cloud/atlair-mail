import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, timestamptz } from "./_columns.ts";
import { userId } from "./auth.ts";

export const organizationSlugPattern = "^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$";

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug")
      .notNull()
      .$defaultFn(() => `org-${randomBytes(6).toString("hex")}`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdBy: userId("created_by"),
    updatedBy: userId("updated_by"),
    deactivatedAt: timestamptz("deactivated_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("organizations_slug_unique").on(t.slug),
    check("organizations_slug_check", sql`${t.slug} ~ ${sql.raw(`'${organizationSlugPattern}'`)}`),
  ],
);

export const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" });

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
