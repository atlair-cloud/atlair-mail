import {
  creatorColumns,
  editorColumns,
  findApiKeyInOrganization,
  insertApiKey,
  listApiKeysByOrganization,
  revokeApiKey,
  type Actor,
  type ApiKeyPermission,
  type Database,
  type Executor,
} from "@atlair-mail/db";
import type { ApiKey } from "@atlair-mail/db/schema";
import { generateApiKeyToken } from "../lib/api-key-tokens.ts";
import { loadAuthors, withAuthors } from "../lib/authors.ts";

export interface NewApiKeyInput {
  name: string;
  permission?: ApiKeyPermission;
}

const toPublicApiKey = (key: ApiKey) => ({
  id: key.id,
  name: key.name,
  permission: key.permission,
  tokenPrefix: key.tokenPrefix,
  lastUsedAt: key.lastUsedAt,
  revokedAt: key.revokedAt,
  createdAt: key.createdAt,
  updatedAt: key.updatedAt,
});

export async function createApiKey(db: Executor, organizationId: string, input: NewApiKeyInput, actor: Actor | null) {
  const { token, tokenHash, tokenPrefix } = generateApiKeyToken();
  const key = await insertApiKey(db, {
    organizationId,
    name: input.name,
    permission: input.permission,
    tokenHash,
    tokenPrefix,
    ...creatorColumns(actor),
    ...editorColumns(actor),
  });
  return { ...toPublicApiKey(key), ...(await withAuthors(db, key)), token };
}

export function createApiKeyService(db: Database) {
  return {
    create: (organizationId: string, input: NewApiKeyInput, actor: Actor) =>
      createApiKey(db, organizationId, input, actor),

    async list(organizationId: string) {
      const keys = await listApiKeysByOrganization(db, organizationId);
      const authors = await loadAuthors(db, keys);
      return keys.map((key) => ({ ...toPublicApiKey(key), ...authors(key) }));
    },

    async revoke(organizationId: string, id: string, actor: Actor) {
      const key = { id, organizationId };
      const row = (await revokeApiKey(db, key, actor)) ?? (await findApiKeyInOrganization(db, key));
      return row && { ...toPublicApiKey(row), ...(await withAuthors(db, row)) };
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
