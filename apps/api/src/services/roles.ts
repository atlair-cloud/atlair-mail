import { listRoles, type Database } from "@atlair-mail/db";

export function createRoleService(db: Database) {
  return {
    list: (organizationId: string) => listRoles(db, organizationId),
  };
}

export type RoleService = ReturnType<typeof createRoleService>;
