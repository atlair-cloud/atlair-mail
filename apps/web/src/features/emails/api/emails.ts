import { ApiError, apiFetch } from '../../../lib/api/client'
import type { Email, EmailEvent, EmailStatus, EmailSummary } from './types'

export const emailPageSize = 50

export const emailsQueryKey = (organizationId: string, status: EmailStatus | null) => ['organizations', organizationId, 'emails', { status }] as const

export const emailQueryKey = (organizationId: string, emailId: string) => ['organizations', organizationId, 'emails', emailId] as const

export const emailEventsQueryKey = (organizationId: string, emailId: string) => ['organizations', organizationId, 'emails', emailId, 'events'] as const

export async function listEmails(organizationId: string, query: { status: EmailStatus | null; before?: string }) {
  const params = new URLSearchParams({ limit: String(emailPageSize) })
  if (query.status) params.set('status', query.status)
  if (query.before) params.set('before', query.before)
  const { data } = await apiFetch<{ data: EmailSummary[] }>(`/organizations/${organizationId}/emails?${params}`)
  return data
}

export function getEmail(organizationId: string, emailId: string) {
  return apiFetch<Email>(`/organizations/${organizationId}/emails/${emailId}`)
}

export async function listEmailEvents(organizationId: string, emailId: string) {
  const { data } = await apiFetch<{ data: EmailEvent[] }>(`/organizations/${organizationId}/emails/${emailId}/events`)
  return data
}

export const deliveryTrackingQueryKey = (organizationId: string) => ['organizations', organizationId, 'provider', 'tracking'] as const

export async function getDeliveryTracking(organizationId: string) {
  try {
    const provider = await apiFetch<{ events: { status: string } }>(`/organizations/${organizationId}/provider`)
    return provider.events.status === 'confirmed'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false
    throw error
  }
}
