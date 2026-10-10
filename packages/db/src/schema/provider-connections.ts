import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import {
  eventDeliveryModes,
  providerTypes,
  type EventDeliveryMode,
  type ProviderSettings,
  type ProviderType,
} from "@atlair-mail/providers/types";
import { encryptionKeyVersion, id, isOneOf, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";

export const providerConnections = pgTable(
  "provider_connections",
  {
    id: id(),
    organizationId: organizationId(),
    provider: text("provider").$type<ProviderType>().notNull(),
    settings: jsonb("settings").$type<ProviderSettings>().notNull(),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    encryptionKeyVersion: encryptionKeyVersion(),
    eventsMode: text("events_mode").$type<EventDeliveryMode>(),
    eventsUrl: text("events_url"),
    eventsConfirmedAt: timestamptz("events_confirmed_at"),
    eventsPollAfter: timestamptz("events_poll_after"),
    eventsLastPolledAt: timestamptz("events_last_polled_at"),
    eventsLastReceivedAt: timestamptz("events_last_received_at"),
    eventsLastError: text("events_last_error"),
    eventsFailures: integer("events_failures").notNull().default(0),
    eventsBacklog: integer("events_backlog"),
    eventsDeadLetters: integer("events_dead_letters"),
    eventsStatsAt: timestamptz("events_stats_at"),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("provider_connections_organization_id_unique").on(t.organizationId),
    check("provider_connections_provider_check", isOneOf(t.provider, providerTypes)),
    check("provider_connections_settings_check", sql`jsonb_typeof(${t.settings}) = 'object'`),
    check(
      "provider_connections_events_confirmed_check",
      sql`${t.eventsConfirmedAt} is null or ${t.eventsMode} is not null`,
    ),
    check(
      "provider_connections_events_mode_check",
      sql`${t.eventsMode} is null or ${isOneOf(t.eventsMode, eventDeliveryModes)}`,
    ),
    check(
      "provider_connections_events_url_check",
      sql`(${t.eventsMode} is not distinct from 'push') = (${t.eventsUrl} is not null)`,
    ),
    check("provider_connections_events_failures_check", sql`${t.eventsFailures} >= 0`),
    index("provider_connections_events_poll_after_idx")
      .on(t.eventsPollAfter)
      .where(sql`${t.eventsPollAfter} is not null`),
  ],
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;
