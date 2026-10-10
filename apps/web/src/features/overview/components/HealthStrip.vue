<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../api/get-overview'
import { formatCount, formatRate } from '../lib/format'

const props = defineProps<{ overview: Overview }>()

const limits = {
  bounce: { warning: 0.02, review: 0.05, label: '5%' },
  complaint: { warning: 0.0005, review: 0.001, label: '0.1%' },
}

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

const metrics = computed(() => props.overview.metrics)
const eventsConnected = computed(() => props.overview.setup.provider.eventsConnected)
const accepted = computed(() => {
  const week = metrics.value.last7d
  return week.sent + week.delivered + week.bounced + week.complained
})

const bars = computed(() => {
  const peak = Math.max(1, ...metrics.value.daily.map((entry) => entry.counts.total))
  return metrics.value.daily.map((entry, index) => {
    const counts = entry.counts
    const problems = counts.bounced + counts.complained + counts.failed
    const inFlight = counts.queued + counts.sending + counts.sent
    const date = new Date(`${entry.day}T00:00:00Z`)
    return {
      day: entry.day,
      label: weekday.format(date),
      today: index === metrics.value.daily.length - 1,
      title: `${longDate.format(date)}: ${formatCount(counts.total)} emails, ${formatCount(counts.delivered)} delivered, ${formatCount(problems)} bounced, complained or failed`,
      segments: [
        { key: 'delivered', value: counts.delivered, class: 'bg-status-live' },
        { key: 'in-flight', value: inFlight, class: 'bg-status-active' },
        { key: 'problems', value: problems, class: 'bg-red-400' },
      ]
        .filter((segment) => segment.value > 0)
        .map((segment) => ({ ...segment, height: `${(segment.value / peak) * 100}%` })),
    }
  })
})

const chartSummary = computed(() => `${formatCount(metrics.value.last7d.total)} emails over the last 7 days: ${bars.value.map((bar) => bar.title).join('; ')}`)

function gauge(rate: number | null, limit: { warning: number; review: number }) {
  const value = rate ?? 0
  return {
    width: `${(value > 0 ? Math.max(0.03, Math.min(1, value / limit.review)) : 0) * 100}%`,
    tone: value >= limit.review ? 'bg-red-500' : value >= limit.warning ? 'bg-status-attention' : 'bg-status-live',
    text: value >= limit.review ? 'text-red-600' : value >= limit.warning ? 'text-amber-700' : 'text-slate-900',
  }
}

const bounce = computed(() => gauge(metrics.value.rates.bounce, limits.bounce))
const complaint = computed(() => gauge(metrics.value.rates.complaint, limits.complaint))
</script>

<template>
  <dl class="m-0 grid overflow-hidden rounded-md bg-white ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
    <div class="flex items-end justify-between gap-6 border-slate-100 px-5 py-4 max-lg:border-b sm:max-lg:col-span-2 lg:border-r">
      <div class="shrink-0">
        <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Emails · 7 days</dt>
        <dd class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{{ formatCount(metrics.last7d.total) }}</dd>
        <dd class="m-0 mt-0.5 text-xs text-slate-500">{{ formatCount(metrics.last24h.total) }} in the last 24 hours</dd>
      </div>
      <dd class="m-0 flex h-16 w-full max-w-64 items-end gap-1.5" role="img" :aria-label="chartSummary">
        <span v-for="bar in bars" :key="bar.day" class="flex h-full min-w-0 flex-1 flex-col items-center gap-1" :title="bar.title">
          <span class="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-[2px] bg-slate-100">
            <span v-for="segment in bar.segments" :key="segment.key" class="w-full" :class="segment.class" :style="{ height: segment.height }" />
          </span>
          <span aria-hidden="true" class="font-mono text-[9.5px] leading-none" :class="bar.today ? 'font-semibold text-slate-700' : 'text-slate-400'">{{ bar.label }}</span>
        </span>
      </dd>
    </div>

    <div class="border-slate-100 px-5 py-4 max-sm:border-b sm:border-r">
      <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Delivered</dt>
      <template v-if="eventsConnected">
        <dd class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{{ formatRate(metrics.rates.delivery) }}</dd>
        <dd class="m-0 mt-0.5 text-xs text-slate-500">{{ accepted ? `${formatCount(metrics.last7d.delivered)} of ${formatCount(accepted)} accepted` : 'Nothing accepted yet' }}</dd>
      </template>
      <template v-else>
        <dd class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-400">—</dd>
        <dd class="m-0 mt-0.5 text-xs text-amber-700">Connect delivery events to see this</dd>
      </template>
    </div>

    <div class="border-slate-100 px-5 py-4 max-sm:border-b sm:border-r">
      <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Bounce rate</dt>
      <dd class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight" :class="eventsConnected ? bounce.text : 'text-slate-400'">{{ eventsConnected ? formatRate(metrics.rates.bounce) : '—' }}</dd>
      <dd class="m-0 mt-2">
        <span class="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" :aria-label="`Bounce rate ${formatRate(metrics.rates.bounce)} of Amazon's ${limits.bounce.label} review limit`">
          <span class="rounded-full transition-[width] duration-500 motion-reduce:transition-none" :class="bounce.tone" :style="{ width: eventsConnected ? bounce.width : '0%' }" />
        </span>
        <span class="mt-1 flex justify-between font-mono text-[10px] text-slate-400"><span>0</span><span>SES reviews at {{ limits.bounce.label }}</span></span>
      </dd>
    </div>

    <div class="px-5 py-4">
      <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Complaint rate</dt>
      <dd class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight" :class="eventsConnected ? complaint.text : 'text-slate-400'">{{ eventsConnected ? formatRate(metrics.rates.complaint) : '—' }}</dd>
      <dd class="m-0 mt-2">
        <span class="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" :aria-label="`Complaint rate ${formatRate(metrics.rates.complaint)} of Amazon's ${limits.complaint.label} review limit`">
          <span class="rounded-full transition-[width] duration-500 motion-reduce:transition-none" :class="complaint.tone" :style="{ width: eventsConnected ? complaint.width : '0%' }" />
        </span>
        <span class="mt-1 flex justify-between font-mono text-[10px] text-slate-400"><span>0</span><span>SES reviews at {{ limits.complaint.label }}</span></span>
      </dd>
    </div>
  </dl>
</template>
