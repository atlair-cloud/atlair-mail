export type EmailStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'canceled'

export const emailStatuses: EmailStatus[] = ['queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'canceled']

export type EmailSummary = {
  id: string
  status: EmailStatus
  from: string
  to: string[]
  subject: string
  scheduledAt: string
  sentAt: string | null
  lastError: string | null
  createdAt: string
}

export type Email = EmailSummary & {
  cc: string[]
  bcc: string[]
  replyTo: string[]
  html: string | null
  text: string | null
  headers: Record<string, string>
  tags: { name: string; value: string }[]
  providerMessageId: string | null
  updatedAt: string
}

export type EmailEventType = 'sent' | 'delivered' | 'delivery_delayed' | 'bounced' | 'complained' | 'rejected' | 'opened' | 'clicked' | 'failed'

export type EmailEvent = {
  id: string
  type: EmailEventType
  occurredAt: string
  recipients: { address: string; diagnosticCode?: string }[]
  bounce?: { kind: 'permanent' | 'transient' | 'undetermined'; subType: string }
  complaint?: { feedbackType?: string }
  smtpResponse?: string
  link?: string
  error?: string
}
