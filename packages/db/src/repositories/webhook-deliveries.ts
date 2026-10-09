import { and, arrayContains, asc, desc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { webhookDeliveries, webhookEndpoints } from "../schema/index.ts";
import type { EmailEventType, WebhookDeliveryStatus, WebhookPayload } from "../types.ts";

export interface WebhookDeliveryRequest {
  organizationId: string;
  emailEventId: string;
  eventType: EmailEventType;
  payload: WebhookPayload;
}

export async function enqueueWebhookDeliveries(db: Executor, request: WebhookDeliveryRequest) {
  const subscribed = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.organizationId, request.organizationId),
        isNull(webhookEndpoints.disabledAt),
        arrayContains(webhookEndpoints.eventTypes, [request.eventType]),
      ),
    )
    .orderBy(asc(webhookEndpoints.id));
  if (subscribed.length === 0) return [];
  return db
    .insert(webhookDeliveries)
    .values(
      subscribed.map((endpoint) => ({
        webhookEndpointId: endpoint.id,
        emailEventId: request.emailEventId,
        payload: request.payload,
      })),
    )
    .onConflictDoNothing({ target: [webhookDeliveries.webhookEndpointId, webhookDeliveries.emailEventId] })
    .returning({ id: webhookDeliveries.id });
}

export async function claimDueWebhookDeliveries(db: Executor, options: { limit: number; leaseSeconds: number }) {
  const due = db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, sql`now()`)))
    .orderBy(asc(webhookDeliveries.nextAttemptAt))
    .limit(options.limit)
    .for("update", { skipLocked: true });

  const claimed = await db
    .update(webhookDeliveries)
    .set({
      nextAttemptAt: sql`now() + make_interval(secs => ${options.leaseSeconds})`,
      attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
    })
    .where(inArray(webhookDeliveries.id, due))
    .returning({
      id: webhookDeliveries.id,
      webhookEndpointId: webhookDeliveries.webhookEndpointId,
      payload: webhookDeliveries.payload,
      attempt: webhookDeliveries.attemptCount,
    });
  if (claimed.length === 0) return [];

  const endpoints = await db
    .select({
      id: webhookEndpoints.id,
      organizationId: webhookEndpoints.organizationId,
      url: webhookEndpoints.url,
      signingSecretEncrypted: webhookEndpoints.signingSecretEncrypted,
      encryptionKeyVersion: webhookEndpoints.encryptionKeyVersion,
      disabledAt: webhookEndpoints.disabledAt,
    })
    .from(webhookEndpoints)
    .where(inArray(webhookEndpoints.id, [...new Set(claimed.map((delivery) => delivery.webhookEndpointId))]));
  const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
  return claimed.flatMap(({ webhookEndpointId, ...delivery }) => {
    const endpoint = byId.get(webhookEndpointId);
    return endpoint ? [{ ...delivery, endpoint }] : [];
  });
}

export type ClaimedWebhookDelivery = Awaited<ReturnType<typeof claimDueWebhookDeliveries>>[number];

export interface WebhookAttempt {
  id: string;
  attempt: number;
  status: WebhookDeliveryStatus;
  nextAttemptAt?: Date;
  responseStatus: number | null;
  error: string | null;
}

export async function recordWebhookAttempt(db: Executor, attempt: WebhookAttempt) {
  const [delivery] = await db
    .update(webhookDeliveries)
    .set({
      status: attempt.status,
      lastResponseStatus: attempt.responseStatus,
      lastError: attempt.error,
      ...(attempt.nextAttemptAt && { nextAttemptAt: attempt.nextAttemptAt }),
      ...(attempt.status === "delivered" && { deliveredAt: sql`now()` }),
    })
    .where(
      and(
        eq(webhookDeliveries.id, attempt.id),
        eq(webhookDeliveries.status, "pending"),
        eq(webhookDeliveries.attemptCount, attempt.attempt),
      ),
    )
    .returning({ id: webhookDeliveries.id, status: webhookDeliveries.status });
  return delivery ?? null;
}

export interface WebhookDeliveryPage {
  organizationId: string;
  webhookEndpointId: string;
  before?: string;
  limit: number;
}

export async function listWebhookDeliveries(db: Executor, page: WebhookDeliveryPage) {
  return db
    .select({
      id: webhookDeliveries.id,
      payload: webhookDeliveries.payload,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      nextAttemptAt: webhookDeliveries.nextAttemptAt,
      lastResponseStatus: webhookDeliveries.lastResponseStatus,
      lastError: webhookDeliveries.lastError,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.webhookEndpointId))
    .where(
      and(
        eq(webhookEndpoints.organizationId, page.organizationId),
        eq(webhookDeliveries.webhookEndpointId, page.webhookEndpointId),
        page.before === undefined ? undefined : lt(webhookDeliveries.id, page.before),
      ),
    )
    .orderBy(desc(webhookDeliveries.id))
    .limit(page.limit);
}
