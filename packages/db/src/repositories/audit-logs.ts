import { and, desc, eq, lt } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { auditLogs, users, type NewAuditLog } from "../schema/index.ts";

export async function insertAuditLog(db: Executor, values: NewAuditLog) {
  await db.insert(auditLogs).values(values);
}

export interface AuditLogPage {
  organizationId: string;
  before?: string;
  limit: number;
}

export async function listAuditLogs(db: Executor, page: AuditLogPage) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      changes: auditLogs.changes,
      actor: { id: users.id, name: users.name, email: users.email },
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(
      and(
        eq(auditLogs.organizationId, page.organizationId),
        page.before === undefined ? undefined : lt(auditLogs.id, page.before),
      ),
    )
    .orderBy(desc(auditLogs.id))
    .limit(page.limit);
}
