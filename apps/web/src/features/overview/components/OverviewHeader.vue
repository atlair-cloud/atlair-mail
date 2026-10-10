<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import type { Overview } from '../api/get-overview'
import { formatCount } from '../lib/format'

const props = defineProps<{ organizationName: string; overview: Overview | null; stepsDone: number; stepsTotal: number }>()

const now = useNow({ interval: 15_000 })

const tone = computed(() => {
  const overview = props.overview
  if (!overview) return null
  if (overview.health === 'setup') {
    return { dot: 'bg-slate-300', label: 'Not sending yet', detail: `${props.stepsDone} of ${props.stepsTotal} setup steps done` }
  }
  const { last24h, latestEmailAt } = overview.metrics
  const activity = [`${formatCount(last24h.total)} ${last24h.total === 1 ? 'email' : 'emails'} in the last 24 hours`]
  if (latestEmailAt) activity.push(`last ${formatRelativeTime(latestEmailAt, now.value.getTime())}`)
  const [first, ...rest] = overview.attention
  if (first && (overview.health === 'critical' || overview.health === 'warning')) {
    return {
      dot: overview.health === 'critical' ? 'bg-red-500' : 'bg-status-attention',
      label: first.title,
      detail: rest.length ? `${rest.length} more below` : activity.join(' · '),
    }
  }
  return { dot: 'bg-status-live', label: 'Sending normally', detail: activity.join(' · ') }
})
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div class="min-w-0">
      <p class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Overview</p>
      <h1 tabindex="-1" class="m-0 mt-1.5 truncate text-[28px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ organizationName }}</h1>
      <div v-if="!tone" aria-hidden="true" class="skeleton mt-3 h-3.5 w-80 max-w-full rounded-sm" />
      <p v-else class="mb-0 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm" aria-live="polite">
        <span class="inline-flex items-center gap-2 font-medium text-slate-900">
          <span aria-hidden="true" class="relative inline-flex size-2">
            <span v-if="overview?.health === 'ok'" class="absolute inset-0 animate-ping rounded-full bg-status-live/60 [animation-duration:2.5s] motion-reduce:hidden" />
            <span class="relative inline-flex size-2 rounded-full" :class="tone.dot" />
          </span>
          {{ tone.label }}
        </span>
        <template v-if="tone.detail">
          <span aria-hidden="true" class="text-slate-300">·</span>
          <span class="text-slate-600">{{ tone.detail }}</span>
        </template>
      </p>
    </div>
    <slot name="action" />
  </header>
</template>
