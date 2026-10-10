import { apiFetch } from '../../../lib/api/client'
import type { EmailStatus, EmailSummary } from '../../emails'

export type StatusCounts = Record<EmailStatus, number> & { total: number }

export type Health = 'setup' | 'ok' | 'warning' | 'critical'

export type AttentionItem = {
  kind: 'domain_failed' | 'domain_pending' | 'events_not_connected' | 'events_error' | 'bounce_rate' | 'complaint_rate' | 'emails_failed' | 'webhook_failing'
  severity: 'warning' | 'critical'
  title: string
  detail: string
  targetId: string | null
}

export type DomainStatus = 'pending' | 'verified' | 'failed'

export type Overview = {
  generatedAt: string
  health: Health
  setup: {
    provider: { connected: boolean; provider: string | null; region: string | null; eventsConnected: boolean }
    domains: { total: number; verified: number; pending: number; failed: number }
    apiKeys: number
    webhooks: number
    suppressions: number
    members: number
    firstEmailSent: boolean
  }
  metrics: {
    last24h: StatusCounts
    last7d: StatusCounts
    daily: { day: string; counts: StatusCounts }[]
    rates: { delivery: number | null; bounce: number | null; complaint: number | null }
    latestEmailAt: string | null
  }
  attention: AttentionItem[]
  domains: { id: string; name: string; status: DomainStatus; lastCheckedAt: string | null }[]
  recentEmails: EmailSummary[]
}

export const overviewQueryKey = (organizationId: string) => ['organizations', organizationId, 'overview'] as const

export function getOverview(organizationId: string) {
  return apiFetch<Overview>(`/organizations/${organizationId}/overview`)
}
