import createError from "@fastify/error";
import {
  deleteSuppression,
  findSuppression,
  listSuppressions,
  suppressAddresses,
  type Database,
} from "@atlair-mail/db";
import type { SuppressedAddress } from "@atlair-mail/db/schema";
import { parseMailbox } from "@atlair-mail/core";

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
  return {
    async list(organizationId: string, query: SuppressionQuery) {
      const limit = query.limit ?? defaultSuppressionPageSize;
      const rows = await listSuppressions(db, organizationId, {
        address: query.address === undefined ? undefined : normalizeAddress(query.address),
        after: query.after,
        limit: limit + 1,
      });
      return { data: rows.slice(0, limit).map(toPublicSuppression), hasMore: rows.length > limit };
    },

    async add(organizationId: string, input: string) {
      const address = normalizeAddress(input);
      const [created] = await suppressAddresses(db, organizationId, [{ address, reason: "manual" }], null);
      if (created) return { suppression: toPublicSuppression(created), created: true };
      const existing = await findSuppression(db, organizationId, address);
      return { suppression: toPublicSuppression(existing!), created: false };
    },

    remove: (organizationId: string, id: string) => deleteSuppression(db, organizationId, id),
  };
}

export type SuppressionService = ReturnType<typeof createSuppressionService>;
