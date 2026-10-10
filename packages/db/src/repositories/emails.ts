import { and, desc, eq, lt } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { emails, type NewEmail } from "../schema/index.ts";
import type { EmailStatus } from "../types.ts";

export async function insertEmail(db: Executor, values: NewEmail) {
  const [email] = await db
    .insert(emails)
    .values(values)
    .onConflictDoNothing({ target: [emails.organizationId, emails.idempotencyKey] })
    .returning();
  return email ?? null;
}

export async function findEmailByIdempotencyKey(db: Executor, organizationId: string, idempotencyKey: string) {
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.organizationId, organizationId), eq(emails.idempotencyKey, idempotencyKey)))
    .limit(1);
  return email ?? null;
}

export async function findEmailInOrganization(db: Executor, key: { id: string; organizationId: string }) {
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, key.id), eq(emails.organizationId, key.organizationId)))
    .limit(1);
  return email ?? null;
}

export interface EmailPage {
  organizationId: string;
  status?: EmailStatus;
  before?: string;
  limit: number;
}

export async function listEmails(db: Executor, page: EmailPage) {
  return db
    .select({
      id: emails.id,
      status: emails.status,
      fromAddress: emails.fromAddress,
      toAddresses: emails.toAddresses,
      subject: emails.subject,
      sendAt: emails.sendAt,
      sentAt: emails.sentAt,
      createdAt: emails.createdAt,
    })
    .from(emails)
    .where(
      and(
        eq(emails.organizationId, page.organizationId),
        page.status === undefined ? undefined : eq(emails.status, page.status),
        page.before === undefined ? undefined : lt(emails.id, page.before),
      ),
    )
    .orderBy(desc(emails.id))
    .limit(page.limit);
}
