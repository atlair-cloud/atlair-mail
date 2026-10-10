import type { Email, EmailEvent } from '../api/types'

export type TimelineTone = 'neutral' | 'active' | 'good' | 'warning' | 'bad'

export type TimelineEntry = {
  key: string
  at: string | null
  title: string
  detail?: string
  tone: TimelineTone
  recipients?: { address: string; diagnosticCode?: string }[]
  pending?: boolean
}

const failureReasons: Record<string, string> = {
  ATL_RECIPIENT_SUPPRESSED: 'Every recipient is on the suppression list because of an earlier bounce or complaint, so nothing was sent.',
  ATL_PROVIDER_REJECTED: 'Amazon SES refused the email.',
  ATL_PROVIDER_NOT_CONNECTED: 'No email provider was connected when it was due to send.',
  ATL_DOMAIN_NOT_VERIFIED: 'The sending domain wasn’t verified when it was due to send.',
  ATL_INVALID_ADDRESS: 'One of the addresses isn’t a valid email address.',
  ATL_PROVIDER_THROTTLED: 'Amazon SES was over its sending rate and every retry was used up.',
  ATL_PROVIDER_TIMEOUT: 'Amazon SES didn’t answer in time on any retry.',
  ATL_PROVIDER_UNAVAILABLE: 'Amazon SES was unavailable on every retry.',
  ATL_WORKER_ERROR: 'The worker hit an unexpected error while sending.',
}

const shortReasons: Record<string, string> = {
  ATL_RECIPIENT_SUPPRESSED: 'Recipient suppressed',
  ATL_PROVIDER_REJECTED: 'Refused by Amazon SES',
  ATL_PROVIDER_NOT_CONNECTED: 'No provider connected',
  ATL_DOMAIN_NOT_VERIFIED: 'Domain not verified',
  ATL_INVALID_ADDRESS: 'Invalid address',
  ATL_PROVIDER_THROTTLED: 'Over the SES sending rate',
  ATL_PROVIDER_TIMEOUT: 'Amazon SES timed out',
  ATL_PROVIDER_UNAVAILABLE: 'Amazon SES unavailable',
  ATL_WORKER_ERROR: 'Worker error',
}

export function shortFailureReason(error: string | null | undefined, sandbox = false) {
  if (!error) return 'Failed'
  const [code = '', reason = ''] = error.split(':').map((part) => part.trim())
  if (code === 'ATL_PROVIDER_REJECTED' && reason === 'MessageRejected' && sandbox) return 'Sandbox: recipient not verified in SES'
  return shortReasons[code] ?? code
}

export function explainFailure(error: string | null | undefined) {
  if (!error) return undefined
  const code = error.split(':')[0]?.trim() ?? ''
  const known = failureReasons[code]
  return known ? `${known} (${error})` : error
}

function describe(event: EmailEvent): Omit<TimelineEntry, 'key' | 'at'> {
  switch (event.type) {
    case 'sent':
      return { title: 'Accepted by Amazon SES', detail: 'SES has the email and is handing it to the receiving mail servers.', tone: 'active' }
    case 'delivered':
      return { title: 'Delivered', detail: event.smtpResponse ? `The receiving server answered: ${event.smtpResponse}` : 'The receiving server accepted it.', tone: 'good', recipients: event.recipients }
    case 'delivery_delayed':
      return { title: 'Delivery delayed', detail: 'The receiving server didn’t accept it yet. Amazon keeps retrying for up to a day.', tone: 'warning', recipients: event.recipients }
    case 'bounced':
      return event.bounce?.kind === 'transient'
        ? { title: 'Soft bounce', detail: `The mailbox is temporarily unavailable (${event.bounce.subType}), for example full. Sending again later may work.`, tone: 'warning', recipients: event.recipients }
        : {
            title: 'Bounced',
            detail: `The address doesn’t exist or refuses mail${event.bounce ? ` (${event.bounce.subType})` : ''}. It’s now on the suppression list, so it won’t be emailed again.`,
            tone: 'bad',
            recipients: event.recipients,
          }
    case 'complained':
      return { title: 'Marked as spam', detail: 'The recipient reported this email as spam. They’re now suppressed, so they won’t be emailed again.', tone: 'bad', recipients: event.recipients }
    case 'rejected':
      return { title: 'Rejected by Amazon SES', detail: 'SES refused to send it, usually because it contained a virus or broke a sending policy.', tone: 'bad' }
    case 'opened':
      return { title: 'Opened', tone: 'neutral', recipients: event.recipients }
    case 'clicked':
      return { title: 'Link clicked', detail: event.link, tone: 'neutral', recipients: event.recipients }
    case 'failed':
      return { title: 'Failed', detail: explainFailure(event.error), tone: 'bad' }
  }
}

export function buildTimeline(email: Email, events: EmailEvent[], trackingOn: boolean): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ key: 'queued', at: email.createdAt, title: 'Queued', detail: 'Received by Atlair Mail and waiting for the worker.', tone: 'neutral' }]

  if (new Date(email.scheduledAt).getTime() - new Date(email.createdAt).getTime() > 60_000) {
    entries.push({ key: 'scheduled', at: email.scheduledAt, title: 'Scheduled', detail: 'Held until this time before sending.', tone: 'neutral', pending: new Date(email.scheduledAt).getTime() > Date.now() })
  }

  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  if (email.sentAt && !sorted.some((event) => event.type === 'sent')) {
    entries.push({ key: 'sent', at: email.sentAt, title: 'Accepted by Amazon SES', detail: 'SES has the email and is handing it to the receiving mail servers.', tone: 'active' })
  }
  for (const event of sorted) entries.push({ key: event.id, at: event.occurredAt, ...describe(event) })

  if (email.status === 'failed' && !sorted.some((event) => event.type === 'failed')) {
    entries.push({ key: 'failed', at: email.updatedAt, title: 'Failed', detail: explainFailure(email.lastError), tone: 'bad' })
  }

  if (email.status === 'queued' || email.status === 'sending') {
    entries.push({ key: 'next', at: null, title: email.status === 'sending' ? 'Sending now…' : 'Waiting to send…', tone: 'active', pending: true })
  } else if (email.status === 'sent') {
    entries.push({
      key: 'next',
      at: null,
      title: trackingOn ? 'Waiting for the receiving server…' : 'Delivery isn’t tracked',
      detail: trackingOn ? 'Usually a few seconds. This page updates on its own.' : 'Turn on delivery tracking on the overview to see deliveries, bounces and complaints.',
      tone: trackingOn ? 'active' : 'neutral',
      pending: true,
    })
  }

  return entries
}
