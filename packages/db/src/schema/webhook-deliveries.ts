import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  webhookDeliveryStatuses,
  type WebhookDeliveryStatus,
  type WebhookPayload,
} from "../types.ts";
import { attemptCount, id, isOneOf, timestamps, timestamptz } from "./_columns.ts";
import { emailEvents } from "./email-events.ts";
import { webhookEndpoints } from "./webhook-endpoints.ts";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    webhookEndpointId: uuid("webhook_endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    emailEventId: uuid("email_event_id")
      .notNull()
      .references(() => emailEvents.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<WebhookPayload>().notNull(),
    status: text("status").$type<WebhookDeliveryStatus>().notNull().default("pending"),
    attemptCount: attemptCount(),
    nextAttemptAt: timestamptz("next_attempt_at").notNull().defaultNow(),
    lastResponseStatus: integer("last_response_status"),
    lastError: text("last_error"),
    deliveredAt: timestamptz("delivered_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("webhook_deliveries_webhook_endpoint_id_email_event_id_unique").on(
      t.webhookEndpointId,
      t.emailEventId,
    ),
    index("webhook_deliveries_email_event_id_idx").on(t.emailEventId),
    index("webhook_deliveries_next_attempt_at_pending_idx")
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
    check("webhook_deliveries_status_check", isOneOf(t.status, webhookDeliveryStatuses)),
  ],
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
