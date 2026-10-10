import { apiFetch } from '../../../lib/api/client'

export type AuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  changes: Record<string, unknown> | null
  actor: { id: string; name: string; email: string } | null
  apiKey: { id: string; name: string } | null
  createdAt: string
}

export const auditPageSize = 50

export const auditLogQueryKey = (organizationId: string) => ['organizations', organizationId, 'audit-log'] as const

export async function listAuditLog(organizationId: string, before?: string) {
  const params = new URLSearchParams({ limit: String(auditPageSize) })
  if (before) params.set('before', before)
  const { data } = await apiFetch<{ data: AuditEntry[] }>(`/organizations/${organizationId}/audit-log?${params}`)
  return data
}
