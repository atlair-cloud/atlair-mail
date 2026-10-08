import { and, eq } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { emails, type NewEmail } from "../schema/index.ts";

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
