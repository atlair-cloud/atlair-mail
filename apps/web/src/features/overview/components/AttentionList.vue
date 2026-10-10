<script setup lang="ts">
import { NavArrowRight, WarningCircle, WarningTriangle } from '@iconoir/vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { routeIfExists } from '../../../lib/links'
import type { AttentionItem } from '../api/get-overview'

const props = defineProps<{ items: AttentionItem[]; organizationId: string }>()

const router = useRouter()

function fixFor(item: AttentionItem): { to: RouteLocationRaw; label: string } | null {
  const organizationId = props.organizationId
  const to = (() => {
    switch (item.kind) {
      case 'domain_failed':
      case 'domain_pending':
        return item.targetId ? routeIfExists(router, 'domain', { organizationId, domainId: item.targetId }) : null
      case 'events_not_connected':
      case 'events_error':
        return routeIfExists(router, 'organization-settings-provider', { organizationId })
      case 'bounce_rate':
      case 'complaint_rate':
        return routeIfExists(router, 'suppressions', { organizationId })
      case 'emails_failed':
        return routeIfExists(router, 'emails', { organizationId }, { status: 'failed' })
      case 'webhook_failing':
        return item.targetId ? routeIfExists(router, 'webhook', { organizationId, webhookId: item.targetId }) : null
    }
  })()
  const labels: Record<AttentionItem['kind'], string> = {
    domain_failed: 'Check DNS records',
    domain_pending: 'View DNS records',
    events_not_connected: 'Connect events',
    events_error: 'Open provider',
    bounce_rate: 'Review suppressions',
    complaint_rate: 'Review suppressions',
    emails_failed: 'See failed emails',
    webhook_failing: 'Open webhook',
  }
  return to ? { to, label: labels[item.kind] } : null
}
</script>

<template>
  <section aria-labelledby="attention-heading">
    <h2 id="attention-heading" class="m-0 mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Needs attention</h2>
    <ul class="m-0 grid list-none gap-2 p-0">
      <li
        v-for="item in items"
        :key="`${item.kind}-${item.targetId ?? ''}`"
        class="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md px-4 py-3 ring-1"
        :class="item.severity === 'critical' ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200'"
      >
        <component
          :is="item.severity === 'critical' ? WarningCircle : WarningTriangle"
          aria-hidden="true"
          class="mt-0.5 size-4 shrink-0"
          :class="item.severity === 'critical' ? 'text-red-600' : 'text-amber-600'"
        />
        <div class="min-w-0 flex-1">
          <p class="m-0 text-sm font-medium text-slate-900">
            <span class="sr-only">{{ item.severity === 'critical' ? 'Critical: ' : 'Warning: ' }}</span>{{ item.title }}
          </p>
          <p class="m-0 mt-0.5 text-sm leading-relaxed text-slate-600">{{ item.detail }}</p>
        </div>
        <RouterLink
          v-if="fixFor(item)"
          :to="fixFor(item)!.to"
          class="inline-flex shrink-0 items-center gap-1 self-center rounded-sm px-2 py-1 text-sm font-medium text-slate-800 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-atlair-950"
        >{{ fixFor(item)!.label }}<NavArrowRight aria-hidden="true" class="size-3.5" /></RouterLink>
      </li>
    </ul>
  </section>
</template>
