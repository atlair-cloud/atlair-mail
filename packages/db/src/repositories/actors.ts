import { inArray } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { apiKeys, users } from "../schema/index.ts";
import type { Actor } from "../types.ts";

export const creatorColumns = (actor: Actor | null) => ({
  createdBy: actor?.userId ?? null,
  createdByApiKeyId: actor?.apiKeyId ?? null,
});

export const editorColumns = (actor: Actor | null) => ({
  updatedBy: actor?.userId ?? null,
  updatedByApiKeyId: actor?.apiKeyId ?? null,
});

const distinct = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => id !== null))];

export async function findActorNames(db: Executor, actors: Actor[]) {
  const userIds = distinct(actors.map((actor) => actor.userId));
  const apiKeyIds = distinct(actors.map((actor) => actor.apiKeyId));
  const [userRows, apiKeyRows] = await Promise.all([
    userIds.length === 0
      ? []
      : db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)),
    apiKeyIds.length === 0
      ? []
      : db.select({ id: apiKeys.id, name: apiKeys.name }).from(apiKeys).where(inArray(apiKeys.id, apiKeyIds)),
  ]);
  return {
    users: new Map(userRows.map((row) => [row.id, row])),
    apiKeys: new Map(apiKeyRows.map((row) => [row.id, row])),
  };
}

export type ActorNames = Awaited<ReturnType<typeof findActorNames>>;
