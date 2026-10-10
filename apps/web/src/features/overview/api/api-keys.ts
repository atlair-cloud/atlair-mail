import { apiFetch } from '../../../lib/api/client'

export type ApiKeyPermission = 'full_access' | 'sending_access'

export type CreatedApiKey = { id: string; name: string; permission: ApiKeyPermission; token: string; tokenPrefix: string; createdAt: string }

export function createApiKey(organizationId: string, input: { name: string; permission: ApiKeyPermission }) {
  return apiFetch<CreatedApiKey>(`/organizations/${organizationId}/api-keys`, { method: 'POST', body: JSON.stringify(input) })
}
