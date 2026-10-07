import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { apiKeys } from "../schema/index.ts";

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
