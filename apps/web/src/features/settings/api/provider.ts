import type { Authorship } from '../../../lib/api/actors'
import { ApiError, apiFetch } from '../../../lib/api/client'

export type ProviderAccount = { sendingEnabled: boolean; sandbox: boolean; dailyQuota: number; maxSendRate: number; sentLast24h: number }

export type EventsStatus = 'disabled' | 'pending_confirmation' | 'confirmed' | 'failing'

export type EventsMode = 'push' | 'pull'

export type EventsSetup = { mode: 'pull' } | { mode: 'push'; url: string }

export type ProviderConnection = Authorship & {
  id: string
  type: 'ses'
  region: string
  accessKeyId: string
  events: {
    mode: EventsMode | null
    url: string | null
    status: EventsStatus
    confirmedAt: string | null
    lastReceivedAt: string | null
    nextCheckAt: string | null
    lastError: string | null
    backlog: number | null
    deadLetters: number | null
  }
  account?: ProviderAccount
}

export const providerQueryKey = (organizationId: string) => ['organizations', organizationId, 'provider'] as const

const base = (organizationId: string) => `/organizations/${organizationId}/provider`

export async function getProvider(organizationId: string) {
  try {
    return await apiFetch<ProviderConnection>(base(organizationId))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function connectSes(organizationId: string, input: { region: string; accessKeyId: string; secretAccessKey: string }) {
  return apiFetch<ProviderConnection>(base(organizationId), { method: 'PUT', body: JSON.stringify({ type: 'ses', ...input }) })
}

export function turnOnDeliveryEvents(organizationId: string, setup: EventsSetup) {
  return apiFetch<ProviderConnection>(`${base(organizationId)}/events`, { method: 'POST', body: JSON.stringify(setup) })
}

export function redriveEvents(organizationId: string) {
  return apiFetch<{ status: 'started' }>(`${base(organizationId)}/events/redrive`, { method: 'POST' })
}

export function disconnectProvider(organizationId: string) {
  return apiFetch<void>(base(organizationId), { method: 'DELETE' })
}
