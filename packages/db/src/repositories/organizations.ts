import { eq } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { organizations, type NewOrganization } from "../schema/index.ts";

export async function insertOrganization(db: Executor, values: NewOrganization) {
  const [organization] = await db.insert(organizations).values(values).returning();
  return organization!;
}

export async function findOrganizationById(db: Executor, id: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return organization ?? null;
}
