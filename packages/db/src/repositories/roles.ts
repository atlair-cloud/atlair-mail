import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { roles } from "../schema/index.ts";

export async function listRoles(db: Executor, organizationId: string) {
  return db
    .select({ id: roles.id, name: roles.name, permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.organizationId, organizationId))
    .orderBy(asc(roles.createdAt), asc(roles.id));
}

export async function findRoleByName(db: Executor, organizationId: string, name: string) {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.organizationId, organizationId), eq(roles.name, name)))
    .limit(1);
  return role ?? null;
}
