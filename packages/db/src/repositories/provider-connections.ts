import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import type { ProviderSettings } from "@atlair-mail/providers/types";
import { providerConnections, type NewProviderConnection } from "../schema/index.ts";

const disabledEvents = {
  eventsMode: null,
  eventsUrl: null,
  eventsConfirmedAt: null,
  eventsPollAfter: null,
  eventsLastPolledAt: null,
  eventsLastReceivedAt: null,
  eventsLastError: null,
  eventsFailures: 0,
  eventsBacklog: null,
  eventsDeadLetters: null,
  eventsStatsAt: null,
};

export async function upsertProviderConnection(db: Executor, values: NewProviderConnection) {
  const [connection] = await db
    .insert(providerConnections)
    .values(values)
    .onConflictDoUpdate({
      target: providerConnections.organizationId,
      set: {
        provider: values.provider,
        settings: values.settings,
        credentialsEncrypted: values.credentialsEncrypted,
        encryptionKeyVersion: values.encryptionKeyVersion,
        ...disabledEvents,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return connection!;
}

export async function findProviderConnectionByOrganization(db: Executor, organizationId: string) {
  const [connection] = await db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.organizationId, organizationId))
    .limit(1);
  return connection ?? null;
}

export async function deleteProviderConnection(db: Executor, organizationId: string) {
  const [connection] = await db
    .delete(providerConnections)
    .where(eq(providerConnections.organizationId, organizationId))
    .returning({ id: providerConnections.id });
  return connection ?? null;
}

export async function findProviderConnectionById(db: Executor, id: string) {
  const [connection] = await db.select().from(providerConnections).where(eq(providerConnections.id, id)).limit(1);
  return connection ?? null;
}

export type ProviderEventsSetup =
  | { mode: "push"; settings: ProviderSettings; eventsUrl: string; active: boolean }
  | { mode: "pull"; settings: ProviderSettings; active: boolean };

export async function saveProviderEvents(db: Executor, id: string, setup: ProviderEventsSetup) {
  const eventsUrl = setup.mode === "push" ? setup.eventsUrl : null;
  const unchanged = and(
    sql`${providerConnections.eventsMode} is not distinct from ${setup.mode}`,
    sql`${providerConnections.eventsUrl} is not distinct from ${eventsUrl}`,
  );
  const [connection] = await db
    .update(providerConnections)
    .set({
      settings: setup.settings,
      eventsMode: setup.mode,
      eventsUrl,
      eventsConfirmedAt: setup.active
        ? sql`coalesce(case when ${unchanged} then ${providerConnections.eventsConfirmedAt} end, now())`
        : sql`case when ${unchanged} then ${providerConnections.eventsConfirmedAt} end`,
      ...(setup.mode === "pull" && {
        eventsPollAfter: sql`coalesce(${providerConnections.eventsPollAfter}, now())`,
        eventsFailures: 0,
        eventsLastError: null,
      }),
      updatedAt: sql`now()`,
    })
    .where(eq(providerConnections.id, id))
    .returning();
  return connection ?? null;
}

export async function markProviderEventsConfirmed(db: Executor, id: string) {
  const [connection] = await db
    .update(providerConnections)
    .set({ eventsConfirmedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(providerConnections.id, id), isNotNull(providerConnections.eventsMode)))
    .returning({ id: providerConnections.id, eventsMode: providerConnections.eventsMode });
  return connection ?? null;
}

export async function claimDueEventPolls(db: Executor, options: { limit: number; leaseUntil: Date }) {
  const due = db
    .select({ id: providerConnections.id })
    .from(providerConnections)
    .where(lte(providerConnections.eventsPollAfter, sql`now()`))
    .orderBy(asc(providerConnections.eventsPollAfter))
    .limit(options.limit)
    .for("update", { skipLocked: true });

  return db
    .update(providerConnections)
    .set({ eventsPollAfter: options.leaseUntil })
    .where(inArray(providerConnections.id, due))
    .returning();
}

export interface EventPollResult {
  id: string;
  leaseUntil: Date;
  received: number;
  error: string | null;
  nextPollAt: Date | null;
  stats?: { backlog: number; deadLetters: number };
}

export async function finishEventPoll(db: Executor, result: EventPollResult) {
  const [connection] = await db
    .update(providerConnections)
    .set({
      eventsPollAfter: result.nextPollAt,
      eventsLastPolledAt: sql`now()`,
      eventsLastError: result.error,
      eventsFailures: result.error === null ? 0 : sql`${providerConnections.eventsFailures} + 1`,
      ...(result.received > 0 && { eventsLastReceivedAt: sql`now()` }),
      ...(result.stats && {
        eventsBacklog: result.stats.backlog,
        eventsDeadLetters: result.stats.deadLetters,
        eventsStatsAt: sql`now()`,
      }),
    })
    .where(and(eq(providerConnections.id, result.id), eq(providerConnections.eventsPollAfter, result.leaseUntil)))
    .returning({ id: providerConnections.id, eventsFailures: providerConnections.eventsFailures });
  return connection ?? null;
}

export async function stopEventPolling(db: Executor, id: string) {
  const [connection] = await db
    .update(providerConnections)
    .set({ eventsPollAfter: null, updatedAt: sql`now()` })
    .where(eq(providerConnections.id, id))
    .returning({ id: providerConnections.id });
  return connection ?? null;
}
