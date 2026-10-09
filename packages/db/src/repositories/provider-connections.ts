import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import type { ProviderSettings } from "@atlair-mail/providers/types";
import { providerConnections, type NewProviderConnection } from "../schema/index.ts";

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
        eventsUrl: null,
        eventsConfirmedAt: null,
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

export async function saveProviderEvents(
  db: Executor,
  id: string,
  values: { settings: ProviderSettings; eventsUrl: string },
) {
  const [connection] = await db
    .update(providerConnections)
    .set({
      settings: values.settings,
      eventsUrl: values.eventsUrl,
      eventsConfirmedAt: sql`case when ${providerConnections.eventsUrl} is not distinct from ${values.eventsUrl} then ${providerConnections.eventsConfirmedAt} end`,
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
    .where(and(eq(providerConnections.id, id), isNotNull(providerConnections.eventsUrl)))
    .returning({ id: providerConnections.id });
  return connection ?? null;
}

export async function updateProviderSettings(db: Executor, id: string, settings: ProviderSettings) {
  const [connection] = await db
    .update(providerConnections)
    .set({ settings, updatedAt: sql`now()` })
    .where(eq(providerConnections.id, id))
    .returning();
  return connection ?? null;
}
