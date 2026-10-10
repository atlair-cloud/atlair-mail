import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { emailEventTypes, type EmailEventType } from "../types.ts";
import { encryptionKeyVersion, id, isSubsetOf, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: id(),
    organizationId: organizationId(),
    url: text("url").notNull(),
    eventTypes: text("event_types").array().$type<EmailEventType[]>().notNull(),
    signingSecretEncrypted: text("signing_secret_encrypted").notNull(),
    encryptionKeyVersion: encryptionKeyVersion(),
    previousSigningSecretEncrypted: text("previous_signing_secret_encrypted"),
    previousEncryptionKeyVersion: integer("previous_encryption_key_version"),
    previousSecretExpiresAt: timestamptz("previous_secret_expires_at"),
    disabledAt: timestamptz("disabled_at"),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    index("webhook_endpoints_organization_id_idx").on(t.organizationId),
    check("webhook_endpoints_event_types_check", sql`cardinality(${t.eventTypes}) > 0`),
    check("webhook_endpoints_event_types_known_check", isSubsetOf(t.eventTypes, emailEventTypes)),
    check(
      "webhook_endpoints_previous_secret_check",
      sql`(${t.previousSigningSecretEncrypted} is null) = (${t.previousEncryptionKeyVersion} is null) and (${t.previousSigningSecretEncrypted} is null) = (${t.previousSecretExpiresAt} is null)`,
    ),
  ],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
