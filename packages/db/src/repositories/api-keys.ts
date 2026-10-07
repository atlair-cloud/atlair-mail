import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { apiKeys, type NewApiKey } from "../schema/index.ts";

export async function insertApiKey(db: Executor, values: NewApiKey) {
  const [key] = await db.insert(apiKeys).values(values).returning();
  return key!;
}

export async function findActiveApiKeyByTokenHash(db: Executor, tokenHash: string) {
  const [key] = await db
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      permission: apiKeys.permission,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.tokenHash, tokenHash), isNull(apiKeys.revokedAt)))
    .limit(1);
  return key ?? null;
}

export type ActiveApiKey = NonNullable<Awaited<ReturnType<typeof findActiveApiKeyByTokenHash>>>;

export async function listApiKeysByOrganization(db: Executor, organizationId: string) {
  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, organizationId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function findApiKeyInOrganization(
  db: Executor,
  key: { id: string; organizationId: string },
) {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, key.id), eq(apiKeys.organizationId, key.organizationId)))
    .limit(1);
  return row ?? null;
}

export async function revokeApiKey(db: Executor, key: { id: string; organizationId: string }) {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(apiKeys.id, key.id),
        eq(apiKeys.organizationId, key.organizationId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function touchApiKeyLastUsed(db: Executor, id: string) {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: sql`now()`, updatedAt: sql`${apiKeys.updatedAt}` })
    .where(
      and(
        eq(apiKeys.id, id),
        or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, sql`now() - interval '1 minute'`)),
      ),
    );
}
