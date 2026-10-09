import { and, asc, count, eq, lte, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { webhookEndpoints, type NewWebhookEndpoint } from "../schema/index.ts";
import type { EmailEventType } from "../types.ts";

export async function createWebhookEndpoint(db: Executor, values: NewWebhookEndpoint) {
  const [endpoint] = await db.insert(webhookEndpoints).values(values).returning();
  return endpoint!;
}

export async function countWebhookEndpoints(db: Executor, organizationId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, organizationId));
  return row?.total ?? 0;
}

export async function listWebhookEndpoints(db: Executor, organizationId: string) {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, organizationId))
    .orderBy(asc(webhookEndpoints.id));
}

const inOrganization = (organizationId: string, id: string) =>
  and(eq(webhookEndpoints.organizationId, organizationId), eq(webhookEndpoints.id, id));

export async function findWebhookEndpoint(db: Executor, organizationId: string, id: string) {
  const [endpoint] = await db.select().from(webhookEndpoints).where(inOrganization(organizationId, id)).limit(1);
  return endpoint ?? null;
}

export interface WebhookEndpointChanges {
  url?: string;
  eventTypes?: EmailEventType[];
  disabledAt?: Date | null;
}

export async function updateWebhookEndpoint(
  db: Executor,
  organizationId: string,
  id: string,
  changes: WebhookEndpointChanges,
) {
  const [endpoint] = await db
    .update(webhookEndpoints)
    .set(changes)
    .where(inOrganization(organizationId, id))
    .returning();
  return endpoint ?? null;
}

export async function deleteWebhookEndpoint(db: Executor, organizationId: string, id: string) {
  const [endpoint] = await db
    .delete(webhookEndpoints)
    .where(inOrganization(organizationId, id))
    .returning({ id: webhookEndpoints.id });
  return endpoint ?? null;
}

export interface SigningSecretRotation {
  ciphertext: string;
  keyVersion: number;
  overlapSeconds: number;
}

export async function rotateWebhookSigningSecret(
  db: Executor,
  organizationId: string,
  id: string,
  rotation: SigningSecretRotation,
) {
  const keepPrevious = rotation.overlapSeconds > 0;
  const [endpoint] = await db
    .update(webhookEndpoints)
    .set({
      signingSecretEncrypted: rotation.ciphertext,
      encryptionKeyVersion: rotation.keyVersion,
      previousSigningSecretEncrypted: keepPrevious ? sql`${webhookEndpoints.signingSecretEncrypted}` : null,
      previousEncryptionKeyVersion: keepPrevious ? sql`${webhookEndpoints.encryptionKeyVersion}` : null,
      previousSecretExpiresAt: keepPrevious ? sql`now() + make_interval(secs => ${rotation.overlapSeconds})` : null,
    })
    .where(inOrganization(organizationId, id))
    .returning();
  return endpoint ?? null;
}

export async function clearExpiredPreviousSecrets(db: Executor) {
  const cleared = await db
    .update(webhookEndpoints)
    .set({ previousSigningSecretEncrypted: null, previousEncryptionKeyVersion: null, previousSecretExpiresAt: null })
    .where(lte(webhookEndpoints.previousSecretExpiresAt, sql`now()`))
    .returning({ id: webhookEndpoints.id });
  return cleared.length;
}
