import { findActorNames, type Actor, type ActorNames, type Executor } from "@atlair-mail/db";

export type PublicActor = { type: "user"; id: string; name: string } | { type: "api_key"; id: string; name: string };

export interface CreatedByColumns {
  createdBy: string | null;
  createdByApiKeyId: string | null;
}

export interface UpdatedByColumns {
  updatedBy: string | null;
  updatedByApiKeyId: string | null;
}

const toPublicActor = (names: ActorNames, userId: string | null, apiKeyId: string | null): PublicActor | null => {
  const user = userId === null ? undefined : names.users.get(userId);
  if (user) return { type: "user", id: user.id, name: user.name };
  const apiKey = apiKeyId === null ? undefined : names.apiKeys.get(apiKeyId);
  if (apiKey) return { type: "api_key", id: apiKey.id, name: apiKey.name };
  return null;
};

const actorsOf = (row: CreatedByColumns & Partial<UpdatedByColumns>): Actor[] => [
  { userId: row.createdBy, apiKeyId: row.createdByApiKeyId },
  { userId: row.updatedBy ?? null, apiKeyId: row.updatedByApiKeyId ?? null },
];

export async function loadCreators(db: Executor, rows: CreatedByColumns[]) {
  const names = await findActorNames(db, rows.flatMap(actorsOf));
  return (row: CreatedByColumns) => ({ createdBy: toPublicActor(names, row.createdBy, row.createdByApiKeyId) });
}

export async function loadAuthors(db: Executor, rows: (CreatedByColumns & UpdatedByColumns)[]) {
  const names = await findActorNames(db, rows.flatMap(actorsOf));
  return (row: CreatedByColumns & UpdatedByColumns) => ({
    createdBy: toPublicActor(names, row.createdBy, row.createdByApiKeyId),
    updatedBy: toPublicActor(names, row.updatedBy, row.updatedByApiKeyId),
  });
}

export async function withAuthors<T extends CreatedByColumns & UpdatedByColumns>(db: Executor, row: T) {
  return (await loadAuthors(db, [row]))(row);
}
