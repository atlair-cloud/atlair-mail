import type { EmailStatus } from '../api/types'

export const EMAIL_STATUS: Record<EmailStatus, { label: string; dot: string; text: string }> = {
  queued: { label: 'Queued', dot: 'bg-slate-300', text: 'text-slate-600' },
  sending: { label: 'Sending', dot: 'bg-status-active animate-pulse motion-reduce:animate-none', text: 'text-slate-700' },
  sent: { label: 'Sent', dot: 'bg-status-active', text: 'text-slate-700' },
  delivered: { label: 'Delivered', dot: 'bg-status-live', text: 'text-slate-700' },
  bounced: { label: 'Bounced', dot: 'bg-status-attention', text: 'text-amber-700' },
  complained: { label: 'Complained', dot: 'bg-red-500', text: 'text-red-600' },
  failed: { label: 'Failed', dot: 'bg-red-500', text: 'text-red-600' },
  canceled: { label: 'Canceled', dot: 'bg-slate-300', text: 'text-slate-500' },
}

export function isInFlight(status: EmailStatus) {
  return status === 'queued' || status === 'sending'
}
