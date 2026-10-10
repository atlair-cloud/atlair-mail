import { listAuditLogs, type Database } from "@atlair-mail/db";

export function createAuditLogService(db: Database) {
  return {
    list: (organizationId: string, page: { before?: string; limit: number }) =>
      listAuditLogs(db, { organizationId, ...page }),
  };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;
