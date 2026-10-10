import type { Authorship } from '../../../lib/api/actors'
import { apiFetch } from '../../../lib/api/client'

export type OrganizationDetails = Authorship & { id: string; name: string; slug: string; role: string }

export const organizationQueryKey = (organizationId: string) => ['organizations', organizationId, 'details'] as const

export function getOrganization(organizationId: string) {
  return apiFetch<OrganizationDetails>(`/organizations/${organizationId}`)
}

export function updateOrganization(organizationId: string, input: { name?: string; slug?: string }) {
  return apiFetch<OrganizationDetails>(`/organizations/${organizationId}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deactivateOrganization(organizationId: string) {
  return apiFetch<void>(`/organizations/${organizationId}`, { method: 'DELETE' })
}

export async function isSlugAvailable(slug: string) {
  const { available } = await apiFetch<{ available: boolean }>(`/organizations/slug-availability?${new URLSearchParams({ slug })}`)
  return available
}
