import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { validate as isUuid } from "uuid";
import type { Executor } from "../client.ts";
import { emailEvents, emails, type NewEmailEvent } from "../schema/index.ts";
import type { EmailEventType, EmailStatus } from "../types.ts";

const outcomeEventTypes: EmailEventType[] = ["sent", "delivered", "bounced", "complained", "rejected"];

export interface EmailEventTarget {
  organizationId: string;
  providerMessageId: string;
  emailId?: string;
}

async function lockEventEmail(db: Executor, where: SQL | undefined) {
  const [email] = await db
    .select({ id: emails.id, status: emails.status })
    .from(emails)
    .where(where)
    .limit(1)
    .for("update");
  return email ?? null;
}

export async function lockEmailForEvent(db: Executor, target: EmailEventTarget) {
  const inOrganization = eq(emails.organizationId, target.organizationId);
  const sent = await lockEventEmail(
    db,
    and(inOrganization, eq(emails.providerMessageId, target.providerMessageId)),
  );
  if (sent || !target.emailId || !isUuid(target.emailId)) return sent;
  return lockEventEmail(db, and(inOrganization, eq(emails.id, target.emailId), isNull(emails.providerMessageId)));
}

export async function insertEmailEvent(db: Executor, values: NewEmailEvent) {
  const [event] = await db
    .insert(emailEvents)
    .values(values)
    .onConflictDoNothing({ target: [emailEvents.emailId, emailEvents.providerEventId] })
    .returning();
  return event ?? null;
}

export interface EmailStatusChange {
  id: string;
  status: EmailStatus;
  from: readonly EmailStatus[];
  providerMessageId: string;
  occurredAt: Date;
  lastError: string | null;
}

export async function advanceEmailStatus(db: Executor, change: EmailStatusChange) {
  if (change.from.length === 0) return null;
  const sentAt = sql`coalesce(${emails.sentAt}, ${change.occurredAt.toISOString()}::timestamptz)`;
  const [email] = await db
    .update(emails)
    .set({
      status: change.status,
      providerMessageId: sql`coalesce(${emails.providerMessageId}, ${change.providerMessageId})`,
      ...(change.status !== "failed" && { sentAt }),
      lockedUntil: null,
      lastError: change.lastError,
    })
    .where(and(eq(emails.id, change.id), inArray(emails.status, [...change.from])))
    .returning({ id: emails.id, status: emails.status });
  return email ?? null;
}

export async function listOutcomeEvents(db: Executor, emailId: string) {
  return db
    .select({ type: emailEvents.type, details: emailEvents.payload })
    .from(emailEvents)
    .where(and(eq(emailEvents.emailId, emailId), inArray(emailEvents.type, outcomeEventTypes)));
}

export async function listEmailEvents(db: Executor, key: { emailId: string; organizationId: string }) {
  return db
    .select({
      id: emailEvents.id,
      type: emailEvents.type,
      occurredAt: emailEvents.occurredAt,
      details: emailEvents.payload,
      createdAt: emailEvents.createdAt,
    })
    .from(emailEvents)
    .innerJoin(emails, eq(emails.id, emailEvents.emailId))
    .where(and(eq(emailEvents.emailId, key.emailId), eq(emails.organizationId, key.organizationId)))
    .orderBy(asc(emailEvents.occurredAt), asc(emailEvents.id))
    .limit(500);
}
