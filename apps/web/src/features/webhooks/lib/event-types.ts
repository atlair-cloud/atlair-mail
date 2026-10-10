import type { WebhookEventType } from '../api/webhooks'

export const WEBHOOK_EVENTS: { value: WebhookEventType; label: string; description: string }[] = [
  { value: 'email.delivered', label: 'Delivered', description: 'The receiving server accepted it.' },
  { value: 'email.bounced', label: 'Bounced', description: 'The address doesn’t exist or refused it.' },
  { value: 'email.complained', label: 'Complained', description: 'The recipient marked it as spam.' },
  { value: 'email.failed', label: 'Failed', description: 'Atlair Mail gave up before SES took it.' },
  { value: 'email.sent', label: 'Sent', description: 'Amazon SES accepted it for delivery.' },
  { value: 'email.delivery_delayed', label: 'Delivery delayed', description: 'SES is still retrying.' },
  { value: 'email.rejected', label: 'Rejected', description: 'SES refused it, for example for a virus.' },
  { value: 'email.opened', label: 'Opened', description: 'Needs open tracking in SES.' },
  { value: 'email.clicked', label: 'Clicked', description: 'Needs click tracking in SES.' },
]

export const RECOMMENDED_EVENTS: WebhookEventType[] = ['email.delivered', 'email.bounced', 'email.complained', 'email.failed']

export function eventLabel(value: WebhookEventType) {
  return WEBHOOK_EVENTS.find((event) => event.value === value)?.label ?? value
}
