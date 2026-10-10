import { apiFetch } from '../../../lib/api/client'
import type { DomainStatus } from './get-overview'

export type DnsRecord = {
  record: 'DKIM' | 'MAIL_FROM' | 'SPF' | 'DMARC'
  type: 'CNAME' | 'TXT' | 'MX'
  name: string
  value: string
  priority?: number
  required: boolean
  status: DomainStatus | null
}

export type Domain = {
  id: string
  name: string
  status: DomainStatus
  records: DnsRecord[]
  lastCheckedAt: string | null
  verifiedAt: string | null
  createdAt: string
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
