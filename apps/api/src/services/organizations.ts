import {
  findOrganizationById,
  insertApiKey,
  insertOrganization,
  type Database,
} from "@atlair-mail/db";
import { generateApiKeyToken } from "../lib/api-key-tokens.ts";

export function createOrganizationService(db: Database) {
  return {
    async create(input: { name: string }) {
      const { token, tokenHash, tokenPrefix } = generateApiKeyToken();
      return db.transaction(async (tx) => {
        const organization = await insertOrganization(tx, { name: input.name });
        const apiKey = await insertApiKey(tx, {
          organizationId: organization.id,
          name: "Default",
          tokenHash,
          tokenPrefix,
        });
        return { ...organization, apiKey: { ...apiKey, token } };
      });
    },

    get: (id: string) => findOrganizationById(db, id),
  };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
