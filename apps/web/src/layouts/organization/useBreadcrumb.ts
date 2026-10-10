import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { domainQueryKey, getDomain } from '../../features/domains'
import { emailQueryKey, getEmail } from '../../features/emails'
import { useCurrentOrganization } from '../../features/organizations'
import { getWebhook, webhookQueryKey } from '../../features/webhooks'

const param = (value: unknown) => (typeof value === 'string' ? value : '')

export function useBreadcrumb() {
  const route = useRoute()
  const { organizationId } = useCurrentOrganization()

  const emailId = computed(() => (route.name === 'email' ? param(route.params.emailId) : ''))
  const domainId = computed(() => (route.name === 'domain' ? param(route.params.domainId) : ''))
  const webhookId = computed(() => (route.name === 'webhook' ? param(route.params.webhookId) : ''))

  const email = useQuery({
    queryKey: computed(() => emailQueryKey(organizationId.value, emailId.value)),
    queryFn: () => getEmail(organizationId.value, emailId.value),
    enabled: computed(() => !!emailId.value),
  })
  const domain = useQuery({
    queryKey: computed(() => domainQueryKey(organizationId.value, domainId.value)),
    queryFn: () => getDomain(organizationId.value, domainId.value),
    enabled: computed(() => !!domainId.value),
  })
  const webhook = useQuery({
    queryKey: computed(() => webhookQueryKey(organizationId.value, webhookId.value)),
    queryFn: () => getWebhook(organizationId.value, webhookId.value),
    enabled: computed(() => !!webhookId.value),
  })

  return computed<{ section: { label: string; to: RouteLocationRaw }; item: string } | null>(() => {
    const params = { organizationId: organizationId.value }
    if (emailId.value) return { section: { label: 'Emails', to: { name: 'emails', params } }, item: email.data.value?.subject ?? '…' }
    if (domainId.value) return { section: { label: 'Domains', to: { name: 'domains', params } }, item: domain.data.value?.name ?? '…' }
    if (webhookId.value) return { section: { label: 'Webhooks', to: { name: 'webhooks', params } }, item: webhook.data.value?.url.replace(/^https:\/\//, '') ?? '…' }
    return null
  })
}
