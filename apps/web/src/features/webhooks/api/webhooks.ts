import type { Authorship } from '../../../lib/api/actors'
import { apiFetch } from '../../../lib/api/client'

export type WebhookEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.rejected'
  | 'email.opened'
  | 'email.clicked'
  | 'email.failed'

export type Webhook = Authorship & {
  id: string
  url: string
  eventTypes: WebhookEventType[]
  enabled: boolean
  previousSecretExpiresAt: string | null
}

export type WebhookWithSecret = Webhook & { signingSecret: string }

export type WebhookDelivery = {
  id: string
  eventType: WebhookEventType
  emailId: string
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  nextAttemptAt: string | null
  lastResponseStatus: number | null
  lastError: string | null
  deliveredAt: string | null
  createdAt: string
}

export const webhooksQueryKey = (organizationId: string) => ['organizations', organizationId, 'webhooks'] as const
export const webhookQueryKey = (organizationId: string, webhookId: string) => ['organizations', organizationId, 'webhooks', webhookId] as const
export const webhookDeliveriesQueryKey = (organizationId: string, webhookId: string) => ['organizations', organizationId, 'webhooks', webhookId, 'deliveries'] as const

const base = (organizationId: string) => `/organizations/${organizationId}/webhooks`

export async function listWebhooks(organizationId: string) {
  const { data } = await apiFetch<{ data: Webhook[] }>(base(organizationId))
  return data
}

export function getWebhook(organizationId: string, webhookId: string) {
  return apiFetch<Webhook>(`${base(organizationId)}/${webhookId}`)
}

export function createWebhook(organizationId: string, input: { url: string; eventTypes: WebhookEventType[] }) {
  return apiFetch<WebhookWithSecret>(base(organizationId), { method: 'POST', body: JSON.stringify(input) })
}

export function updateWebhook(organizationId: string, webhookId: string, input: { url?: string; eventTypes?: WebhookEventType[]; enabled?: boolean }) {
  return apiFetch<Webhook>(`${base(organizationId)}/${webhookId}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteWebhook(organizationId: string, webhookId: string) {
  return apiFetch<void>(`${base(organizationId)}/${webhookId}`, { method: 'DELETE' })
}

export function rotateWebhookSecret(organizationId: string, webhookId: string, overlapHours: number) {
  return apiFetch<WebhookWithSecret>(`${base(organizationId)}/${webhookId}/rotate-secret`, { method: 'POST', body: JSON.stringify({ overlapHours }) })
}

export const deliveryPageSize = 50

export function listWebhookDeliveries(organizationId: string, webhookId: string, before?: string) {
  const params = new URLSearchParams({ limit: String(deliveryPageSize) })
  if (before) params.set('before', before)
  return apiFetch<{ data: WebhookDelivery[]; hasMore: boolean }>(`${base(organizationId)}/${webhookId}/deliveries?${params}`)
}
