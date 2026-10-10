<script setup lang="ts">
import { NavArrowRight, OpenNewWindow } from '@iconoir/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { routeIfExists } from '../../../lib/links'
import type { Overview } from '../api/get-overview'
import { formatCount } from '../lib/format'

const props = defineProps<{ overview: Overview; organizationId: string }>()

const router = useRouter()
const provider = computed(() => props.overview.setup.provider)
const account = computed(() => provider.value.account)
const sandboxAlert = computed(() => props.overview.attention.some((item) => item.kind === 'emails_sandbox'))
const settings = computed(() => routeIfExists(router, 'organization-settings-provider', { organizationId: props.organizationId }))
const sesConsole = computed(() => (provider.value.region ? `https://${provider.value.region}.console.aws.amazon.com/ses/home?region=${provider.value.region}#/account` : null))

const used = computed(() => {
  const value = account.value
  if (!value || value.dailyQuota <= 0) return null
  const share = Math.min(1, value.sentLast24h / value.dailyQuota)
  return { share, width: `${share > 0 ? Math.max(0.02, share) * 100 : 0}%`, tone: share >= 1 ? 'bg-red-500' : share >= 0.8 ? 'bg-status-attention' : 'bg-status-live' }
})
</script>

<template>
  <section v-if="provider.connected" aria-labelledby="limits-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
      <h2 id="limits-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Sending limits</h2>
      <span v-if="account" class="rounded-sm px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="account.sandbox ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200'">
        {{ account.sandbox ? 'Sandbox' : 'Production' }}
      </span>
    </header>

    <div class="px-4 py-3.5">
      <p class="m-0 text-sm text-slate-700">Amazon SES · <span class="font-mono text-[13px]">{{ provider.region }}</span></p>

      <template v-if="account">
        <template v-if="used">
          <p class="m-0 mt-3 flex items-baseline justify-between gap-2 text-sm">
            <span class="text-slate-600">Sent in the last 24 hours</span>
            <span class="font-mono tabular-nums text-slate-900">{{ formatCount(account.sentLast24h) }} / {{ formatCount(account.dailyQuota) }}</span>
          </p>
          <span class="mt-1.5 flex h-1.5 overflow-hidden rounded-[3px] bg-slate-100" aria-hidden="true">
            <span :class="used.tone" :style="{ width: used.width }" />
          </span>
        </template>
        <p class="m-0 mt-3 flex items-baseline justify-between gap-2 text-sm">
          <span class="text-slate-600">Sending rate</span>
          <span class="font-mono tabular-nums text-slate-900">{{ formatCount(account.maxSendRate) }} / second</span>
        </p>
        <p v-if="account.sandbox && sandboxAlert" class="m-0 mt-3 text-xs leading-relaxed text-slate-500">Only addresses verified in SES can receive email.</p>
        <p v-else-if="account.sandbox" class="m-0 mt-3 rounded-sm bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
          Only addresses verified in SES can receive email.
          <a v-if="sesConsole" :href="sesConsole" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 font-medium underline decoration-amber-400 underline-offset-2">Request production access<OpenNewWindow aria-hidden="true" class="size-3" /></a>
        </p>
        <p v-if="!account.sendingEnabled" class="m-0 mt-3 rounded-sm bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800 ring-1 ring-red-200">Amazon SES has paused sending for this account.</p>
      </template>
      <p v-else class="m-0 mt-2 text-xs leading-relaxed text-slate-500">Couldn’t read the limits from Amazon SES right now. Check the credentials if this keeps happening.</p>

      <RouterLink v-if="settings" :to="settings" class="mt-3 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950">
        Provider settings<NavArrowRight aria-hidden="true" class="size-3" />
      </RouterLink>
    </div>
  </section>
</template>
