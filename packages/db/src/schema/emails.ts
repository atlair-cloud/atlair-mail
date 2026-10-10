import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emailStatuses, type EmailHeaders, type EmailStatus, type EmailTag } from "../types.ts";
import { apiKeys } from "./api-keys.ts";
import { attemptCount, id, isOneOf, timestamps, timestamptz } from "./_columns.ts";
import { domains } from "./domains.ts";
import { organizationId } from "./organizations.ts";

const addressList = (name: string) =>
  text(name).array().notNull().default(sql`'{}'::text[]`);

export const emails = pgTable(
  "emails",
  {
    id: id(),
    organizationId: organizationId(),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "restrict" }),
    fromAddress: text("from_address").notNull(),
    toAddresses: addressList("to_addresses"),
    ccAddresses: addressList("cc_addresses"),
    bccAddresses: addressList("bcc_addresses"),
    replyToAddresses: addressList("reply_to_addresses"),
    subject: text("subject").notNull(),
    htmlBody: text("html_body"),
    textBody: text("text_body"),
    headers: jsonb("headers").$type<EmailHeaders>().notNull().default({}),
    tags: jsonb("tags").$type<EmailTag[]>().notNull().default([]),
    status: text("status").$type<EmailStatus>().notNull().default("queued"),
    sendAt: timestamptz("send_at").notNull().defaultNow(),
    lockedUntil: timestamptz("locked_until"),
    attemptCount: attemptCount(),
    lastError: text("last_error"),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: text("request_fingerprint"),
    sentAt: timestamptz("sent_at"),
    ...timestamps,
  },
  (t) => [
    index("emails_send_at_queued_idx")
      .on(t.sendAt)
      .where(sql`${t.status} = 'queued'`),
    index("emails_locked_until_sending_idx")
      .on(t.lockedUntil)
      .where(sql`${t.status} = 'sending'`),
    index("emails_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("emails_organization_id_id_idx").on(t.organizationId, t.id),
    index("emails_api_key_id_created_at_idx").on(t.apiKeyId, t.createdAt),
    index("emails_domain_id_idx").on(t.domainId),
    uniqueIndex("emails_provider_message_id_unique").on(t.providerMessageId),
    uniqueIndex("emails_organization_id_idempotency_key_unique").on(
      t.organizationId,
      t.idempotencyKey,
    ),
    check("emails_status_check", isOneOf(t.status, emailStatuses)),
    check("emails_to_addresses_check", sql`cardinality(${t.toAddresses}) > 0`),
    check(
      "emails_idempotency_check",
      sql`(${t.idempotencyKey} is null) = (${t.requestFingerprint} is null)`,
    ),
    check("emails_body_check", sql`${t.htmlBody} is not null or ${t.textBody} is not null`),
  ],
);

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
