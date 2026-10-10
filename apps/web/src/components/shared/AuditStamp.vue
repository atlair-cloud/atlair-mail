<script setup lang="ts">
import { useNow } from '@vueuse/core'
import type { Actor } from '../../lib/api/actors'
import { formatRelativeTime } from '../../lib/format/relative-time'
import ActorName from './ActorName.vue'

withDefaults(defineProps<{ at: string; by: Actor | null; fallback?: string }>(), { fallback: '—' })

const now = useNow({ interval: 60_000 })
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <span class="flex min-w-0 flex-col gap-0.5">
    <span class="min-w-0 truncate text-sm text-slate-700"><ActorName :actor="by" :fallback="fallback" /></span>
    <time :datetime="at" :title="absolute.format(new Date(at))" class="font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(at, now.getTime()) }}</time>
  </span>
</template>
