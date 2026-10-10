<script setup lang="ts">
import { NavArrowRight, OpenNewWindow, WarningCircle, WarningTriangle } from '@iconoir/vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { routeIfExists } from '../../../lib/links'
import type { AttentionItem } from '../api/get-overview'

const props = defineProps<{ items: AttentionItem[]; organizationId: string; region: string | null }>()

const router = useRouter()

type Action = { label: string; to: RouteLocationRaw } | { label: string; href: string }

function actionsFor(item: AttentionItem): Action[] {
  const organizationId = props.organizationId
  const sesConsole = props.region ? `https://${props.region}.console.aws.amazon.com/ses/home?region=${props.region}#/account` : null
  const route = (label: string, to: RouteLocationRaw | null): Action[] => (to ? [{ label, to }] : [])
  const external = (label: string): Action[] => (sesConsole ? [{ label, href: sesConsole }] : [])
  const failedEmails = () => route('See failed emails', routeIfExists(router, 'emails', { organizationId }, { status: 'failed' }))
  switch (item.kind) {
    case 'domain_failed':
      return route('Check DNS records', item.targetId ? routeIfExists(router, 'domain', { organizationId, domainId: item.targetId }) : null)
    case 'domain_pending':
      return route('View DNS records', item.targetId ? routeIfExists(router, 'domain', { organizationId, domainId: item.targetId }) : null)
    case 'events_not_connected':
      return route('Turn on tracking', routeIfExists(router, 'organization-settings-provider', { organizationId }))
    case 'events_error':
      return route('Open provider', routeIfExists(router, 'organization-settings-provider', { organizationId }))
    case 'bounce_rate':
    case 'complaint_rate':
      return route('Review suppressions', routeIfExists(router, 'suppressions', { organizationId }))
    case 'emails_sandbox':
      return [...external('Request production access'), ...failedEmails()]
    case 'emails_suppressed':
      return [...route('Review suppressions', routeIfExists(router, 'suppressions', { organizationId })), ...failedEmails()]
    case 'emails_failed':
      return failedEmails()
    case 'sending_paused':
      return external('Open the SES console')
    case 'quota_near':
      return external('Request a higher quota')
    case 'webhook_failing':
      return route('Open webhook', item.targetId ? routeIfExists(router, 'webhook', { organizationId, webhookId: item.targetId }) : null)
  }
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
        <div v-if="actionsFor(item).length" class="flex min-w-0 flex-wrap items-center gap-1 self-center max-sm:basis-full max-sm:pl-6 sm:shrink-0">
          <template v-for="(action, index) in actionsFor(item)" :key="action.label">
            <a
              v-if="'href' in action"
              :href="action.href"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-atlair-950"
              :class="index === 0 ? 'bg-atlair-950 text-canvas hover:bg-atlair-900' : 'text-slate-800 hover:bg-white/70'"
            >{{ action.label }}<OpenNewWindow aria-hidden="true" class="size-3.5" /><span class="sr-only"> (opens AWS)</span></a>
            <RouterLink
              v-else
              :to="action.to"
              class="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-medium text-slate-800 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-atlair-950"
            >{{ action.label }}<NavArrowRight aria-hidden="true" class="size-3.5" /></RouterLink>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>
