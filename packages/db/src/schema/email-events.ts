import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emailEventTypes, type EmailEventType, type ProviderEventPayload } from "../types.ts";
import { createdAt, id, isOneOf, timestamptz } from "./_columns.ts";
import { emails } from "./emails.ts";

export const emailEvents = pgTable(
  "email_events",
  {
    id: id(),
    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    type: text("type").$type<EmailEventType>().notNull(),
    providerEventId: text("provider_event_id").notNull(),
    occurredAt: timestamptz("occurred_at").notNull(),
    payload: jsonb("payload").$type<ProviderEventPayload>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("email_events_provider_event_id_unique").on(t.providerEventId),
    index("email_events_email_id_occurred_at_idx").on(t.emailId, t.occurredAt),
    check("email_events_type_check", isOneOf(t.type, emailEventTypes)),
  ],
);

export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
