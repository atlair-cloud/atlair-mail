import { apiFetch } from '../../../lib/api/client'

export type OrganizationSummary = {
  id: string
  name: string
  slug: string
  role: string
  createdAt: string
}

export const organizationsQueryKey = ['organizations'] as const

export async function listOrganizations() {
  const { data } = await apiFetch<{ data: OrganizationSummary[] }>('/organizations?limit=100')
  return data
}
