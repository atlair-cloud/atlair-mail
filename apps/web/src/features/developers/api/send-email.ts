import { apiFetch } from '../../../lib/api/client'
import type { EmailStatus } from '../../emails'

export type SendEmailBody = {
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string[]
  tags?: { name: string; value: string }[]
}

export type SentEmail = { id: string; status: EmailStatus; scheduledAt: string; createdAt: string }

export function sendEmail(organizationId: string, body: SendEmailBody) {
  return apiFetch<SentEmail>(`/organizations/${organizationId}/emails`, { method: 'POST', body: JSON.stringify(body) })
}
