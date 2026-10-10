import { apiFetch } from '../../../lib/api/client'

export type SuppressionReason = 'hard_bounce' | 'complaint' | 'manual'

export type Suppression = {
  id: string
  address: string
  reason: SuppressionReason
  sourceEmailId: string | null
  createdAt: string
}

export const suppressionPageSize = 50

export const suppressionsQueryKey = (organizationId: string, address: string | null) => ['organizations', organizationId, 'suppressions', { address }] as const

const base = (organizationId: string) => `/organizations/${organizationId}/suppressions`

export function listSuppressions(organizationId: string, query: { address: string | null; after?: string }) {
  const params = new URLSearchParams({ limit: String(suppressionPageSize) })
  if (query.address) params.set('address', query.address)
  if (query.after) params.set('after', query.after)
  return apiFetch<{ data: Suppression[]; hasMore: boolean }>(`${base(organizationId)}?${params}`)
}

export function addSuppression(organizationId: string, address: string) {
  return apiFetch<Suppression>(base(organizationId), { method: 'POST', body: JSON.stringify({ address }) })
}

export function removeSuppression(organizationId: string, id: string) {
  return apiFetch<void>(`${base(organizationId)}/${id}`, { method: 'DELETE' })
}

export const SUPPRESSION_REASON: Record<SuppressionReason, { label: string; description: string; dot: string }> = {
  hard_bounce: { label: 'Bounced', description: 'The address doesn’t exist or refused mail.', dot: 'bg-status-attention' },
  complaint: { label: 'Marked as spam', description: 'The recipient reported an email as spam.', dot: 'bg-red-500' },
  manual: { label: 'Added by you', description: 'Added from the panel or the API.', dot: 'bg-slate-400' },
}
