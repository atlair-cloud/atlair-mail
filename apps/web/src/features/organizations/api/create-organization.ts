import { apiFetch } from '../../../lib/api/client'
import type { OrganizationSummary } from './list-organizations'

export function createOrganization(input: { name: string }) {
  return apiFetch<OrganizationSummary>('/organizations', { method: 'POST', body: JSON.stringify(input) })
}
