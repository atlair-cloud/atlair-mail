import { and, count, desc, eq, gte, isNull, max, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import {
  apiKeys,
  domains,
  emails,
  members,
  providerConnections,
  suppressedAddresses,
  webhookDeliveries,
  webhookEndpoints,
} from "../schema/index.ts";
import type { EmailStatus } from "../types.ts";

export interface EmailStatusCount {
  status: EmailStatus;
  count: number;
}

export async function countEmailsByStatus(db: Executor, organizationId: string, since: Date): Promise<EmailStatusCount[]> {
  const rows = await db
    .select({ status: emails.status, count: count() })
    .from(emails)
    .where(and(eq(emails.organizationId, organizationId), gte(emails.createdAt, since)))
    .groupBy(emails.status);
  return rows;
}

export async function countFailuresByError(db: Executor, organizationId: string, since: Date) {
  return db
    .select({ error: emails.lastError, count: count(), latestEmailId: sql<string>`max(${emails.id}::text)` })
    .from(emails)
    .where(and(eq(emails.organizationId, organizationId), eq(emails.status, "failed"), gte(emails.createdAt, since)))
    .groupBy(emails.lastError)
    .orderBy(desc(count()));
}

export interface DailyEmailCount extends EmailStatusCount {
  day: string;
}

export async function countEmailsByDay(db: Executor, organizationId: string, since: Date): Promise<DailyEmailCount[]> {
  const day = sql<string>`to_char(date_trunc('day', ${emails.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  return db
    .select({ day, status: emails.status, count: count() })
    .from(emails)
    .where(and(eq(emails.organizationId, organizationId), gte(emails.createdAt, since)))
    .groupBy(day, emails.status)
    .orderBy(day);
}

export async function findLatestEmailAt(db: Executor, organizationId: string) {
  const [row] = await db
    .select({ createdAt: emails.createdAt })
    .from(emails)
    .where(eq(emails.organizationId, organizationId))
    .orderBy(desc(emails.id))
    .limit(1);
  return row?.createdAt ?? null;
}

export async function listDomainStatuses(db: Executor, organizationId: string) {
  return db
    .select({ id: domains.id, name: domains.name, status: domains.status, lastCheckedAt: domains.lastCheckedAt })
    .from(domains)
    .where(eq(domains.organizationId, organizationId))
    .orderBy(domains.name);
}

export async function findProviderSummary(db: Executor, organizationId: string) {
  const [row] = await db
    .select({
      provider: providerConnections.provider,
      settings: providerConnections.settings,
      eventsMode: providerConnections.eventsMode,
      eventsConfirmedAt: providerConnections.eventsConfirmedAt,
      eventsLastError: providerConnections.eventsLastError,
    })
    .from(providerConnections)
    .where(eq(providerConnections.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

export interface OrganizationCounts {
  apiKeys: number;
  webhooks: number;
  suppressions: number;
  members: number;
}

export async function countOrganizationResources(db: Executor, organizationId: string): Promise<OrganizationCounts> {
  const [keys, hooks, suppressed, people] = await Promise.all([
    db.select({ n: count() }).from(apiKeys).where(and(eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt))),
    db
      .select({ n: count() })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.organizationId, organizationId), isNull(webhookEndpoints.disabledAt))),
    db.select({ n: count() }).from(suppressedAddresses).where(eq(suppressedAddresses.organizationId, organizationId)),
    db.select({ n: count() }).from(members).where(eq(members.organizationId, organizationId)),
  ]);
  return {
    apiKeys: keys[0]?.n ?? 0,
    webhooks: hooks[0]?.n ?? 0,
    suppressions: suppressed[0]?.n ?? 0,
    members: people[0]?.n ?? 0,
  };
}

export async function listFailingWebhookEndpoints(db: Executor, organizationId: string, since: Date) {
  return db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      failures: count(),
      lastFailedAt: max(webhookDeliveries.updatedAt),
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.webhookEndpointId))
    .where(
      and(
        eq(webhookEndpoints.organizationId, organizationId),
        isNull(webhookEndpoints.disabledAt),
        gte(webhookDeliveries.createdAt, since),
        sql`(${webhookDeliveries.status} = 'failed' or (${webhookDeliveries.status} = 'pending' and ${webhookDeliveries.attemptCount} > 0))`,
      ),
    )
    .groupBy(webhookEndpoints.id, webhookEndpoints.url)
    .orderBy(desc(count()));
}
