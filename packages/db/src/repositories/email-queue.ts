import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { emails } from "../schema/index.ts";
import { msUntilEarliest } from "./_wait.ts";

const sending = eq(emails.status, "sending");

export async function claimDueEmails(db: Executor, options: { limit: number; leaseSeconds: number }) {
  const due = db
    .select({ id: emails.id })
    .from(emails)
    .where(and(eq(emails.status, "queued"), lte(emails.sendAt, sql`now()`)))
    .orderBy(asc(emails.sendAt))
    .limit(options.limit)
    .for("update", { skipLocked: true });

  return db
    .update(emails)
    .set({
      status: "sending",
      lockedUntil: sql`now() + make_interval(secs => ${options.leaseSeconds})`,
      attemptCount: sql`${emails.attemptCount} + 1`,
    })
    .where(inArray(emails.id, due))
    .returning();
}

export async function markEmailSent(db: Executor, id: string, providerMessageId: string) {
  const [email] = await db
    .update(emails)
    .set({ status: "sent", providerMessageId, sentAt: sql`now()`, lockedUntil: null, lastError: null })
    .where(and(eq(emails.id, id), sending))
    .returning({ id: emails.id });
  return email ?? null;
}

export async function requeueEmail(db: Executor, id: string, values: { sendAt: Date; lastError: string }) {
  const [email] = await db
    .update(emails)
    .set({ status: "queued", sendAt: values.sendAt, lastError: values.lastError, lockedUntil: null })
    .where(and(eq(emails.id, id), sending))
    .returning({ id: emails.id });
  return email ?? null;
}

const leaseExpired = lt(emails.lockedUntil, sql`now()`);

export async function markEmailFailed(
  db: Executor,
  id: string,
  lastError: string,
  options: { leaseExpired?: boolean } = {},
) {
  const [email] = await db
    .update(emails)
    .set({ status: "failed", lastError, lockedUntil: null })
    .where(and(eq(emails.id, id), sending, options.leaseExpired ? leaseExpired : undefined))
    .returning({
      id: emails.id,
      organizationId: emails.organizationId,
      fromAddress: emails.fromAddress,
      toAddresses: emails.toAddresses,
      subject: emails.subject,
    });
  return email ?? null;
}

export async function listExpiredLeases(db: Executor, limit: number) {
  const rows = await db
    .select({ id: emails.id })
    .from(emails)
    .where(and(sending, leaseExpired))
    .orderBy(asc(emails.lockedUntil))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function msUntilNextEmail(db: Executor) {
  const [row] = await db.select({ ms: msUntilEarliest(emails.sendAt) }).from(emails).where(eq(emails.status, "queued"));
  return row?.ms ?? null;
}

export async function msUntilNextLeaseExpiry(db: Executor) {
  const [row] = await db.select({ ms: msUntilEarliest(emails.lockedUntil) }).from(emails).where(sending);
  return row?.ms ?? null;
}
