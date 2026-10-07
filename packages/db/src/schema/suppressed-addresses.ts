import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { suppressionReasons, type SuppressionReason } from "../types.ts";
import { createdAt, id, isOneOf } from "./_columns.ts";
import { emails } from "./emails.ts";
import { organizationId } from "./organizations.ts";

export const suppressedAddresses = pgTable(
  "suppressed_addresses",
  {
    id: id(),
    organizationId: organizationId(),
    address: text("address").notNull(),
    reason: text("reason").$type<SuppressionReason>().notNull(),
    sourceEmailId: uuid("source_email_id").references(() => emails.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("suppressed_addresses_organization_id_address_unique").on(
      t.organizationId,
      t.address,
    ),
    index("suppressed_addresses_source_email_id_idx").on(t.sourceEmailId),
    check("suppressed_addresses_address_check", sql`${t.address} = lower(${t.address})`),
    check("suppressed_addresses_reason_check", isOneOf(t.reason, suppressionReasons)),
  ],
);

export type SuppressedAddress = typeof suppressedAddresses.$inferSelect;
export type NewSuppressedAddress = typeof suppressedAddresses.$inferInsert;
