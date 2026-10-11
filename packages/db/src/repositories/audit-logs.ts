import { and, desc, eq, lt } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { apiKeys, auditLogs, users, type NewAuditLog } from "../schema/index.ts";
import type { Actor } from "../types.ts";

export async function insertAuditLog(db: Executor, values: NewAuditLog) {
  await db.insert(auditLogs).values(values);
}

export interface AuditRecord {
  organizationId: string;
  actor: Actor | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}

export function recordAudit(db: Executor, { actor, ...record }: AuditRecord) {
  return insertAuditLog(db, {
    ...record,
    actorUserId: actor?.userId ?? null,
    actorApiKeyId: actor?.apiKeyId ?? null,
  });
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
      apiKey: { id: apiKeys.id, name: apiKeys.name },
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(apiKeys, eq(apiKeys.id, auditLogs.actorApiKeyId))
    .where(
      and(
        eq(auditLogs.organizationId, page.organizationId),
        page.before === undefined ? undefined : lt(auditLogs.id, page.before),
      ),
    )
    .orderBy(desc(auditLogs.id))
    .limit(page.limit);
}
