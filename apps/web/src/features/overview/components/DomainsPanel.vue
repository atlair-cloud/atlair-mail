<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { routeIfExists } from '../../../lib/links'
import type { Overview } from '../api/get-overview'
import { DOMAIN_STATUS } from '../../domains'
import { formatCount } from '../lib/format'

const props = defineProps<{ overview: Overview; organizationId: string }>()

const router = useRouter()
const params = computed(() => ({ organizationId: props.organizationId }))

const glance = computed(() => {
  const setup = props.overview.setup
  const plural = (count: number, one: string, many: string) => `${formatCount(count)} ${count === 1 ? one : many}`
  return [
    { key: 'keys', label: plural(setup.apiKeys, 'API key', 'API keys'), to: routeIfExists(router, 'api-keys', params.value) },
    { key: 'webhooks', label: plural(setup.webhooks, 'webhook', 'webhooks'), to: routeIfExists(router, 'webhooks', params.value) },
    { key: 'suppressions', label: plural(setup.suppressions, 'suppressed address', 'suppressed addresses'), to: routeIfExists(router, 'suppressions', params.value) },
    { key: 'members', label: plural(setup.members, 'member', 'members'), to: routeIfExists(router, 'organization-settings-members', params.value) },
  ]
})

const provider = computed(() => props.overview.setup.provider)
</script>

<template>
  <aside class="grid gap-4 self-start lg:sticky lg:top-6">
    <section aria-labelledby="domains-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
      <header class="border-b border-slate-100 px-4 py-2.5">
        <h2 id="domains-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Sending domains</h2>
      </header>
      <p v-if="overview.domains.length === 0" class="m-0 px-4 py-4 text-sm text-slate-500">No domains yet.</p>
      <ul v-else class="m-0 list-none divide-y divide-slate-100 p-0">
        <li v-for="domain in overview.domains" :key="domain.id" class="flex items-center justify-between gap-3 px-4 py-2.5">
          <RouterLink
            v-if="routeIfExists(router, 'domain', { organizationId, domainId: domain.id })"
            :to="routeIfExists(router, 'domain', { organizationId, domainId: domain.id })!"
            class="min-w-0 truncate rounded-sm text-sm font-medium text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-atlair-950"
          >{{ domain.name }}</RouterLink>
          <span v-else class="min-w-0 truncate text-sm font-medium text-slate-900">{{ domain.name }}</span>
          <span class="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600" :title="domain.lastCheckedAt ? `Checked ${formatRelativeTime(domain.lastCheckedAt)}` : undefined">
            <span aria-hidden="true" class="size-2 rounded-full" :class="DOMAIN_STATUS[domain.status].dot" />{{ DOMAIN_STATUS[domain.status].label }}
          </span>
        </li>
      </ul>
    </section>

    <section aria-labelledby="glance-heading" class="rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
      <h2 id="glance-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">At a glance</h2>
      <p v-if="provider.connected" class="m-0 mt-2.5 flex items-center gap-2 text-sm text-slate-700">
        <span aria-hidden="true" class="size-2 rounded-full bg-status-live" />Amazon SES · {{ provider.region }}
      </p>
      <ul class="m-0 mt-1.5 list-none p-0 text-sm">
        <li v-for="item in glance" :key="item.key" class="py-1">
          <RouterLink v-if="item.to" :to="item.to" class="rounded-sm text-slate-700 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-atlair-950">{{ item.label }}</RouterLink>
          <span v-else class="text-slate-700">{{ item.label }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>
