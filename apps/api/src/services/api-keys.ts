import {
  findApiKeyInOrganization,
  insertApiKey,
  listApiKeysByOrganization,
  revokeApiKey,
  type ApiKeyPermission,
  type Database,
  type Executor,
} from "@atlair-mail/db";
import { generateApiKeyToken } from "../lib/api-key-tokens.ts";

export interface NewApiKeyInput {
  name: string;
  permission?: ApiKeyPermission;
}

export async function createApiKey(db: Executor, organizationId: string, input: NewApiKeyInput) {
  const { token, tokenHash, tokenPrefix } = generateApiKeyToken();
  const key = await insertApiKey(db, {
    organizationId,
    name: input.name,
    permission: input.permission,
    tokenHash,
    tokenPrefix,
  });
  return { ...key, token };
}

export function createApiKeyService(db: Database) {
  return {
    create: (organizationId: string, input: NewApiKeyInput) =>
      createApiKey(db, organizationId, input),

    list: (organizationId: string) => listApiKeysByOrganization(db, organizationId),

    async revoke(organizationId: string, id: string) {
      const key = { id, organizationId };
      return (await revokeApiKey(db, key)) ?? (await findApiKeyInOrganization(db, key));
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
