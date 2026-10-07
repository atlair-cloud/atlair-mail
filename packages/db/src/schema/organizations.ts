import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_columns.ts";

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  ...timestamps,
});

export const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" });

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
