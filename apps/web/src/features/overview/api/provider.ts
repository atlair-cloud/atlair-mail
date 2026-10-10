import { apiFetch } from '../../../lib/api/client'

export type ProviderAccount = { sendingEnabled: boolean; sandbox: boolean; dailyQuota: number; maxSendRate: number }

export type ProviderConnection = {
  id: string
  type: 'ses'
  region: string
  accessKeyId: string
  events: { mode: 'push' | 'pull' | null; status: 'disabled' | 'pending_confirmation' | 'confirmed' | 'failing'; lastError: string | null }
  account?: ProviderAccount
}

export function connectSes(organizationId: string, input: { region: string; accessKeyId: string; secretAccessKey: string }) {
  return apiFetch<ProviderConnection>(`/organizations/${organizationId}/provider`, {
    method: 'PUT',
    body: JSON.stringify({ type: 'ses', ...input }),
  })
}

export function turnOnDeliveryEvents(organizationId: string) {
  return apiFetch<ProviderConnection>(`/organizations/${organizationId}/provider/events`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'pull' }),
  })
}
