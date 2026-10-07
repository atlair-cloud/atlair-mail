import { findOrganizationById, insertOrganization, type Database } from "@atlair-mail/db";
import { createApiKey } from "./api-keys.ts";

export function createOrganizationService(db: Database) {
  return {
    create: (input: { name: string }) =>
      db.transaction(async (tx) => {
        const organization = await insertOrganization(tx, { name: input.name });
        const apiKey = await createApiKey(tx, organization.id, { name: "Default" });
        return { ...organization, apiKey };
      }),

    get: (id: string) => findOrganizationById(db, id),
  };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
