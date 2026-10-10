<script setup lang="ts">
import { useRouter } from 'vue-router'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { routeIfExists } from '../../../lib/links'
import type { Overview } from '../api/get-overview'
import { DOMAIN_STATUS } from '../../domains'

defineProps<{ overview: Overview; organizationId: string }>()

const router = useRouter()
</script>

<template>
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
</template>
