import { sql } from "drizzle-orm";
import { check, index, pgTable, text } from "drizzle-orm/pg-core";
import type { EmailEventType } from "../types.ts";
import { encryptionKeyVersion, id, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: id(),
    organizationId: organizationId(),
    url: text("url").notNull(),
    eventTypes: text("event_types").array().$type<EmailEventType[]>().notNull(),
    signingSecretEncrypted: text("signing_secret_encrypted").notNull(),
    encryptionKeyVersion: encryptionKeyVersion(),
    disabledAt: timestamptz("disabled_at"),
    ...timestamps,
  },
  (t) => [
    index("webhook_endpoints_organization_id_idx").on(t.organizationId),
    check("webhook_endpoints_event_types_check", sql`cardinality(${t.eventTypes}) > 0`),
  ],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
