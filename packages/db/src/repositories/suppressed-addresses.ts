import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { suppressedAddresses } from "../schema/index.ts";

export async function findSuppressedAddresses(db: Executor, organizationId: string, addresses: string[]) {
  if (addresses.length === 0) return [];
  const rows = await db
    .select({ address: suppressedAddresses.address })
    .from(suppressedAddresses)
    .where(
      and(
        eq(suppressedAddresses.organizationId, organizationId),
        inArray(
          suppressedAddresses.address,
          addresses.map((address) => address.toLowerCase()),
        ),
      ),
    );
  return rows.map((row) => row.address);
}
