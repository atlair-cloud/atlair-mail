import type { Executor } from "./client.ts";
import { roles } from "./schema/index.ts";
import { permissions, type Permission, type RoleName } from "./types.ts";

const viewPermissions = permissions.filter((permission) => permission.endsWith(":view") && permission !== "audit:view");

export const rolePermissions: Record<RoleName, readonly Permission[]> = {
  owner: permissions,
  admin: permissions.filter((permission) => permission !== "organization:delete"),
  member: [...viewPermissions, "email:send"],
};

export async function seedOrganizationRoles(db: Executor, organizationId: string, createdBy: string | null) {
  return db
    .insert(roles)
    .values(
      Object.entries(rolePermissions).map(([name, granted]) => ({
        organizationId,
        name,
        permissions: [...granted],
        createdBy,
      })),
    )
    .returning();
}
