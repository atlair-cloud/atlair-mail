import {
  creatorColumns,
  editorColumns,
  findApiKeyInOrganization,
  insertApiKey,
  listApiKeysByOrganization,
  recordAudit,
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
  const key = await db.transaction(async (tx) => {
    const created = await insertApiKey(tx, {
      organizationId,
      name: input.name,
      permission: input.permission,
      tokenHash,
      tokenPrefix,
      ...creatorColumns(actor),
      ...editorColumns(actor),
    });
    await recordAudit(tx, {
      organizationId,
      actor,
      action: "api_key.created",
      entityType: "api_key",
      entityId: created.id,
      changes: { name: created.name, permission: created.permission },
    });
    return created;
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
      const revoked = await db.transaction(async (tx) => {
        const row = await revokeApiKey(tx, key, actor);
        if (row) {
          await recordAudit(tx, { organizationId, actor, action: "api_key.revoked", entityType: "api_key", entityId: id, changes: { name: row.name } });
        }
        return row;
      });
      const row = revoked ?? (await findApiKeyInOrganization(db, key));
      return row && { ...toPublicApiKey(row), ...(await withAuthors(db, row)) };
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
