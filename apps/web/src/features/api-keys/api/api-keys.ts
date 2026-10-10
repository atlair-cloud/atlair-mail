import { apiFetch } from '../../../lib/api/client'

export type ApiKeyPermission = 'full_access' | 'sending_access'

export type CreatedApiKey = { id: string; name: string; permission: ApiKeyPermission; token: string; tokenPrefix: string; createdAt: string }

export function createApiKey(organizationId: string, input: { name: string; permission: ApiKeyPermission }) {
  return apiFetch<CreatedApiKey>(`/organizations/${organizationId}/api-keys`, { method: 'POST', body: JSON.stringify(input) })
}

export type ApiKey = {
  id: string
  name: string
  permission: ApiKeyPermission
  tokenPrefix: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export const apiKeysQueryKey = (organizationId: string) => ['organizations', organizationId, 'api-keys'] as const

export async function listApiKeys(organizationId: string) {
  const { data } = await apiFetch<{ data: ApiKey[] }>(`/organizations/${organizationId}/api-keys`)
  return data
}

export function revokeApiKey(organizationId: string, keyId: string) {
  return apiFetch<ApiKey>(`/organizations/${organizationId}/api-keys/${keyId}`, { method: 'DELETE' })
}

export const API_KEY_PERMISSIONS: { value: ApiKeyPermission; label: string; description: string }[] = [
  { value: 'sending_access', label: 'Sending only', description: 'Can send emails and read their status. Right for your app.' },
  { value: 'full_access', label: 'Full access', description: 'Can also manage domains, keys, webhooks and the provider.' },
]
