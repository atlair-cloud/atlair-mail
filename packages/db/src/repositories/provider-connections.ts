import { eq, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
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
