import { ApiError, apiFetch } from '../../../lib/api/client'
import type { Email, EmailEvent, EmailStatus, EmailSummary } from './types'

export interface EmailListQuery {
  status: EmailStatus | null
  search: string
  since: string | null
  before?: string
  limit: number
}

export const emailsQueryKey = (organizationId: string, query?: Omit<EmailListQuery, 'since'> & { range: string | null }) =>
  query ? (['organizations', organizationId, 'emails', 'list', query] as const) : (['organizations', organizationId, 'emails', 'list'] as const)

export const emailQueryKey = (organizationId: string, emailId: string) => ['organizations', organizationId, 'emails', emailId] as const

export const emailEventsQueryKey = (organizationId: string, emailId: string) => ['organizations', organizationId, 'emails', emailId, 'events'] as const

export function listEmails(organizationId: string, query: EmailListQuery) {
  const params = new URLSearchParams({ limit: String(query.limit) })
  if (query.status) params.set('status', query.status)
  if (query.search) params.set('search', query.search)
  if (query.since) params.set('since', query.since)
  if (query.before) params.set('before', query.before)
  return apiFetch<{ data: EmailSummary[]; hasMore: boolean }>(`/organizations/${organizationId}/emails?${params}`)
}

export function getEmail(organizationId: string, emailId: string) {
  return apiFetch<Email>(`/organizations/${organizationId}/emails/${emailId}`)
}

export async function listEmailEvents(organizationId: string, emailId: string) {
  const { data } = await apiFetch<{ data: EmailEvent[] }>(`/organizations/${organizationId}/emails/${emailId}/events`)
  return data
}

export const deliveryTrackingQueryKey = (organizationId: string) => ['organizations', organizationId, 'provider', 'tracking'] as const

export type DeliveryTracking = { on: boolean; nextCheckAt: string | null }

export async function getDeliveryTracking(organizationId: string): Promise<DeliveryTracking> {
  try {
    const provider = await apiFetch<{ events: { status: string; nextCheckAt: string | null } }>(`/organizations/${organizationId}/provider`)
    return { on: provider.events.status === 'confirmed', nextCheckAt: provider.events.nextCheckAt }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { on: false, nextCheckAt: null }
    throw error
  }
}
