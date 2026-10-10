import type { Authorship } from '../../../lib/api/actors'
import { apiFetch } from '../../../lib/api/client'

export type DomainStatus = 'pending' | 'verified' | 'failed'

export type DnsRecord = {
  record: 'DKIM' | 'MAIL_FROM' | 'SPF' | 'DMARC'
  type: 'CNAME' | 'TXT' | 'MX'
  name: string
  value: string
  priority?: number
  required: boolean
  status: DomainStatus | null
}

export type Domain = Authorship & {
  id: string
  name: string
  status: DomainStatus
  records: DnsRecord[]
  lastCheckedAt: string | null
  verifiedAt: string | null
}

export const domainQueryKey = (organizationId: string, domainId: string) => ['organizations', organizationId, 'domains', domainId] as const

export function getDomain(organizationId: string, domainId: string) {
  return apiFetch<Domain>(`/organizations/${organizationId}/domains/${domainId}`)
}

export function addDomain(organizationId: string, name: string) {
  return apiFetch<Domain>(`/organizations/${organizationId}/domains`, { method: 'POST', body: JSON.stringify({ name }) })
}

export function verifyDomain(organizationId: string, domainId: string) {
  return apiFetch<Domain>(`/organizations/${organizationId}/domains/${domainId}/verify`, { method: 'POST' })
}

export const domainsQueryKey = (organizationId: string) => ['organizations', organizationId, 'domains'] as const

export async function listDomains(organizationId: string) {
  const { data } = await apiFetch<{ data: Domain[] }>(`/organizations/${organizationId}/domains`)
  return data
}

export function removeDomain(organizationId: string, domainId: string) {
  return apiFetch<void>(`/organizations/${organizationId}/domains/${domainId}`, { method: 'DELETE' })
}
