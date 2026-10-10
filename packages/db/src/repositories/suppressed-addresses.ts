import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { suppressedAddresses } from "../schema/index.ts";
import type { Actor, SuppressionReason } from "../types.ts";
import { creatorColumns } from "./actors.ts";

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

export interface SuppressionInput {
  address: string;
  reason: SuppressionReason;
}

export async function suppressAddresses(
  db: Executor,
  organizationId: string,
  entries: SuppressionInput[],
  sourceEmailId: string | null,
  actor: Actor | null = null,
) {
  if (entries.length === 0) return [];
  const ordered = [...entries].sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
  return db
    .insert(suppressedAddresses)
    .values(ordered.map(({ address, reason }) => ({ organizationId, address, reason, sourceEmailId, ...creatorColumns(actor) })))
    .onConflictDoNothing({ target: [suppressedAddresses.organizationId, suppressedAddresses.address] })
    .returning();
}

export interface SuppressionPage {
  address?: string;
  after?: string;
  limit: number;
}

export async function listSuppressions(db: Executor, organizationId: string, page: SuppressionPage) {
  return db
    .select()
    .from(suppressedAddresses)
    .where(
      and(
        eq(suppressedAddresses.organizationId, organizationId),
        page.address === undefined ? undefined : eq(suppressedAddresses.address, page.address.toLowerCase()),
        page.after === undefined ? undefined : gt(suppressedAddresses.id, page.after),
      ),
    )
    .orderBy(asc(suppressedAddresses.id))
    .limit(page.limit);
}

export async function findSuppression(db: Executor, organizationId: string, address: string) {
  const [row] = await db
    .select()
    .from(suppressedAddresses)
    .where(
      and(eq(suppressedAddresses.organizationId, organizationId), eq(suppressedAddresses.address, address.toLowerCase())),
    )
    .limit(1);
  return row ?? null;
}

export async function deleteSuppression(db: Executor, organizationId: string, id: string) {
  const [row] = await db
    .delete(suppressedAddresses)
    .where(and(eq(suppressedAddresses.organizationId, organizationId), eq(suppressedAddresses.id, id)))
    .returning({ id: suppressedAddresses.id });
  return row ?? null;
}
