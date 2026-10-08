import { eq, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { sesConnections, type NewSesConnection } from "../schema/index.ts";

export async function upsertSesConnection(db: Executor, values: NewSesConnection) {
  const [connection] = await db
    .insert(sesConnections)
    .values(values)
    .onConflictDoUpdate({
      target: sesConnections.organizationId,
      set: {
        region: values.region,
        accessKeyId: values.accessKeyId,
        secretAccessKeyEncrypted: values.secretAccessKeyEncrypted,
        encryptionKeyVersion: values.encryptionKeyVersion,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return connection!;
}

export async function findSesConnectionByOrganization(db: Executor, organizationId: string) {
  const [connection] = await db
    .select()
    .from(sesConnections)
    .where(eq(sesConnections.organizationId, organizationId))
    .limit(1);
  return connection ?? null;
}

export async function deleteSesConnection(db: Executor, organizationId: string) {
  const [connection] = await db
    .delete(sesConnections)
    .where(eq(sesConnections.organizationId, organizationId))
    .returning({ id: sesConnections.id });
  return connection ?? null;
}
