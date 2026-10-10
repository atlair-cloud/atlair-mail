import createError from "@fastify/error";
import {
  deleteSuppression,
  findSuppression,
  listSuppressions,
  suppressAddresses,
  type Actor,
  type Database,
} from "@atlair-mail/db";
import type { SuppressedAddress } from "@atlair-mail/db/schema";
import { parseMailbox } from "@atlair-mail/core";
import { loadCreators } from "../lib/authors.ts";

export const InvalidSuppressionAddressError = createError(
  "ATL_INVALID_ADDRESS",
  "address must be a single email address such as ada@example.com",
  400,
);

export const defaultSuppressionPageSize = 50;
export const maxSuppressionPageSize = 100;

export interface SuppressionQuery {
  address?: string;
  after?: string;
  limit?: number;
}

export const toPublicSuppression = (row: SuppressedAddress) => ({
  id: row.id,
  address: row.address,
  reason: row.reason,
  sourceEmailId: row.sourceEmailId,
  createdAt: row.createdAt,
});

const normalizeAddress = (input: string) => {
  const mailbox = parseMailbox(input);
  if (!mailbox || mailbox.name) throw new InvalidSuppressionAddressError();
  return mailbox.address.toLowerCase();
};

export function createSuppressionService(db: Database) {
  const withCreators = async (rows: SuppressedAddress[]) => {
    const creators = await loadCreators(db, rows);
    return rows.map((row) => ({ ...toPublicSuppression(row), ...creators(row) }));
  };

  return {
    async list(organizationId: string, query: SuppressionQuery) {
      const limit = query.limit ?? defaultSuppressionPageSize;
      const rows = await listSuppressions(db, organizationId, {
        address: query.address === undefined ? undefined : normalizeAddress(query.address),
        after: query.after,
        limit: limit + 1,
      });
      return { data: await withCreators(rows.slice(0, limit)), hasMore: rows.length > limit };
    },

    async add(organizationId: string, input: string, actor: Actor) {
      const address = normalizeAddress(input);
      const [created] = await suppressAddresses(db, organizationId, [{ address, reason: "manual" }], null, actor);
      const row = created ?? (await findSuppression(db, organizationId, address))!;
      const [suppression] = await withCreators([row]);
      return { suppression: suppression!, created: created !== undefined };
    },

    remove: (organizationId: string, id: string) => deleteSuppression(db, organizationId, id),
  };
}

export type SuppressionService = ReturnType<typeof createSuppressionService>;
