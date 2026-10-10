<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { routeIfExists } from '../../../lib/links'
import type { Overview } from '../api/get-overview'
import { formatCount, formatRate } from '../lib/format'

const props = defineProps<{ overview: Overview; organizationId: string }>()

const router = useRouter()
const limits = {
  bounce: { warning: 0.02, review: 0.05, label: '5%' },
  complaint: { warning: 0.0005, review: 0.001, label: '0.1%' },
}

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

const metrics = computed(() => props.overview.metrics)
const tracking = computed(() => props.overview.setup.provider.eventsConnected)
const providerSettings = computed(() => routeIfExists(router, 'organization-settings-provider', { organizationId: props.organizationId }))

const outcomes = computed(() => {
  const week = metrics.value.last7d
  return [
    { key: 'delivered', label: 'Delivered', value: week.delivered, dot: 'bg-status-live' },
    { key: 'failed', label: 'Failed', value: week.failed, dot: 'bg-red-500' },
    { key: 'bounced', label: 'Bounced or spam', value: week.bounced + week.complained, dot: 'bg-status-attention' },
    tracking.value
      ? { key: 'in-flight', label: 'In flight', value: week.queued + week.sending + week.sent, dot: 'bg-status-active' }
      : { key: 'in-flight', label: 'Sent, not tracked', value: week.queued + week.sending + week.sent, dot: 'bg-slate-400' },
  ]
})

const outcomeTotal = computed(() => outcomes.value.reduce((sum, outcome) => sum + outcome.value, 0))

const deliverySentence = computed(() => {
  const { volume, last7d, rates } = metrics.value
  if (!tracking.value) return 'Turn on delivery tracking to see what was delivered.'
  if (volume.finished === 0) return last7d.total ? 'Nothing has finished sending yet.' : 'Nothing sent this week.'
  return `${formatCount(last7d.delivered)} of ${formatCount(volume.finished)} delivered · ${formatRate(rates.delivery)}`
})

const days = computed(() => {
  const peak = Math.max(1, ...metrics.value.daily.map((entry) => entry.counts.total))
  return metrics.value.daily.map((entry, index) => {
    const counts = entry.counts
    const date = new Date(`${entry.day}T00:00:00Z`)
    const problems = counts.failed + counts.bounced + counts.complained
    return {
      day: entry.day,
      label: weekday.format(date),
      today: index === metrics.value.daily.length - 1,
      total: counts.total,
      title: `${longDate.format(date)}: ${formatCount(counts.total)} emails, ${formatCount(counts.delivered)} delivered, ${formatCount(problems)} failed or bounced`,
      segments: [
        { key: 'delivered', value: counts.delivered, class: 'bg-status-live' },
        { key: 'other', value: counts.total - counts.delivered - problems, class: tracking.value ? 'bg-status-active' : 'bg-slate-400' },
        { key: 'problems', value: problems, class: 'bg-red-400' },
      ]
        .filter((segment) => segment.value > 0)
        .map((segment) => ({ ...segment, height: `${(segment.value / peak) * 100}%` })),
    }
  })
})

const activeDays = computed(() => days.value.filter((day) => day.total > 0))

const quietWeek = computed(() => {
  const active = activeDays.value
  if (active.length >= 3 || active.length === 0) return null
  if (active.length === 1) return active[0]!.today ? 'All of them today.' : `All of them on ${longDate.format(new Date(`${active[0]!.day}T00:00:00Z`))}.`
  return `Over ${active.length} days this week.`
})

function rateCard(rate: number | null, limit: { warning: number; review: number }) {
  const value = rate ?? 0
  return {
    value: formatRate(rate),
    width: `${(value > 0 ? Math.max(0.03, Math.min(1, value / limit.review)) : 0) * 100}%`,
    tone: value >= limit.review ? 'bg-red-500' : value >= limit.warning ? 'bg-status-attention' : 'bg-status-live',
    text: value >= limit.review ? 'text-red-600' : value >= limit.warning ? 'text-amber-700' : 'text-slate-900',
  }
}

const enoughVolume = computed(() => metrics.value.volume.accepted >= metrics.value.volume.minimumForRates)
const rates = computed(() => [
  { key: 'bounce', label: 'Bounce rate', limit: limits.bounce, ...rateCard(metrics.value.rates.bounce, limits.bounce) },
  { key: 'complaint', label: 'Complaint rate', limit: limits.complaint, ...rateCard(metrics.value.rates.complaint, limits.complaint) },
])
</script>

<template>
  <section aria-label="Sending this week" class="grid overflow-hidden rounded-md bg-white ring-1 ring-slate-200 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
    <div class="border-slate-100 px-5 py-4 max-lg:border-b lg:border-r">
      <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div class="min-w-0">
          <h2 class="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Last 7 days</h2>
          <p class="m-0 mt-1.5 flex items-baseline gap-2">
            <span class="font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{{ formatCount(metrics.last7d.total) }}</span>
            <span class="text-sm text-slate-600">{{ metrics.last7d.total === 1 ? 'email' : 'emails' }}</span>
          </p>
          <p class="m-0 mt-0.5 text-sm text-slate-600">
            {{ deliverySentence }}
            <RouterLink v-if="!tracking && providerSettings" :to="providerSettings" class="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">Turn it on</RouterLink>
          </p>
        </div>

        <p v-if="quietWeek" class="m-0 self-end text-xs text-slate-500">{{ quietWeek }}</p>
        <div v-else-if="activeDays.length" class="flex h-20 w-full max-w-72 items-end gap-1.5 self-end" role="img" :aria-label="days.map((day) => day.title).join('; ')">
          <span v-for="day in days" :key="day.day" class="flex h-full min-w-0 flex-1 flex-col items-center gap-1" :title="day.title">
            <span aria-hidden="true" class="font-mono text-[10px] leading-none tabular-nums text-slate-500">{{ day.total ? formatCount(day.total) : '' }}</span>
            <span class="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-[2px] bg-slate-100">
              <span v-for="segment in day.segments" :key="segment.key" class="w-full" :class="segment.class" :style="{ height: segment.height }" />
            </span>
            <span aria-hidden="true" class="text-[10px] leading-none" :class="day.today ? 'font-semibold text-slate-800' : 'text-slate-500'">{{ day.label }}</span>
          </span>
        </div>
      </div>

      <div v-if="outcomeTotal" class="mt-4 flex h-2 overflow-hidden rounded-[3px] bg-slate-100" aria-hidden="true">
        <span v-for="outcome in outcomes.filter((entry) => entry.value > 0)" :key="outcome.key" :class="outcome.dot" :style="{ width: `${(outcome.value / outcomeTotal) * 100}%` }" />
      </div>
      <ul class="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-sm">
        <li v-for="outcome in outcomes" :key="outcome.key" class="inline-flex items-center gap-1.5" :class="outcome.value ? 'text-slate-700' : 'text-slate-400'">
          <span aria-hidden="true" class="size-2 rounded-[2px]" :class="outcome.value ? outcome.dot : 'bg-slate-200'" />
          <span class="font-mono font-medium tabular-nums" :class="outcome.value ? 'text-slate-900' : ''">{{ formatCount(outcome.value) }}</span>{{ outcome.label.toLowerCase() }}
        </li>
      </ul>
    </div>

    <div v-for="(card, index) in rates" :key="card.key" class="border-slate-100 px-5 py-4" :class="index === 0 ? 'max-lg:border-b lg:border-r' : ''">
      <h2 class="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{{ card.label }}</h2>
      <template v-if="!tracking">
        <p class="m-0 mt-1.5 font-mono text-2xl font-semibold text-slate-300">—</p>
        <p class="m-0 mt-1 text-xs leading-relaxed text-slate-500">Needs delivery tracking.</p>
      </template>
      <template v-else-if="!enoughVolume">
        <p class="m-0 mt-2 text-sm font-medium text-slate-700">Not enough emails yet</p>
        <p class="m-0 mt-1 text-xs leading-relaxed text-slate-500">
          Shown after {{ formatCount(metrics.volume.minimumForRates) }} accepted emails this week; {{ formatCount(metrics.volume.accepted) }} so far.
        </p>
      </template>
      <template v-else>
        <p class="m-0 mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight" :class="card.text">{{ card.value }}</p>
        <span class="mt-2 flex h-1.5 overflow-hidden rounded-[3px] bg-slate-100" role="img" :aria-label="`${card.label} ${card.value}; Amazon SES reviews accounts at ${card.limit.label}`">
          <span class="transition-[width] duration-500 motion-reduce:transition-none" :class="card.tone" :style="{ width: card.width }" />
        </span>
        <p class="m-0 mt-1.5 text-xs text-slate-500">Amazon SES reviews accounts at {{ card.limit.label }}</p>
      </template>
    </div>
  </section>
</template>
