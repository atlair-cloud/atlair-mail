import type { DomainStatus } from '../api/domains'

export const DOMAIN_STATUS: Record<DomainStatus, { label: string; dot: string }> = {
  verified: { label: 'Verified', dot: 'bg-status-live' },
  pending: { label: 'Waiting for DNS', dot: 'bg-status-attention' },
  failed: { label: 'Failed', dot: 'bg-red-500' },
}

export const STATUS_BADGE: Record<DomainStatus, string> = {
  verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
}
