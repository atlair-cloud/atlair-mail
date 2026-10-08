import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { domains, type NewDomain } from "../schema/index.ts";
import type { DomainStatus } from "../types.ts";

type DomainKey = { id: string; organizationId: string };

const inOrganization = (key: DomainKey) =>
  and(eq(domains.id, key.id), eq(domains.organizationId, key.organizationId));

export async function insertDomain(db: Executor, values: NewDomain) {
  const [domain] = await db.insert(domains).values(values).onConflictDoNothing().returning();
  return domain ?? null;
}

export async function listDomainsByOrganization(db: Executor, organizationId: string) {
  return db
    .select()
    .from(domains)
    .where(eq(domains.organizationId, organizationId))
    .orderBy(desc(domains.createdAt));
}

export async function findDomainInOrganization(db: Executor, key: DomainKey) {
  const [domain] = await db.select().from(domains).where(inOrganization(key)).limit(1);
  return domain ?? null;
}

export async function updateDomainVerification(
  db: Executor,
  key: DomainKey,
  values: { status: DomainStatus; dkimTokens?: string[]; dkimSigningHostedZone?: string },
) {
  const [domain] = await db
    .update(domains)
    .set({
      ...values,
      lastCheckedAt: sql`now()`,
      verifiedAt:
        values.status === "verified" ? sql`coalesce(${domains.verifiedAt}, now())` : null,
    })
    .where(inOrganization(key))
    .returning();
  return domain ?? null;
}

export async function deleteDomain(db: Executor, key: DomainKey) {
  const [domain] = await db.delete(domains).where(inOrganization(key)).returning({ id: domains.id });
  return domain ?? null;
}
