<script setup lang="ts">
import type { Actor } from '../../lib/api/actors'
import ActorName from './ActorName.vue'

export type Fact = { label: string; value: string; title?: string; mono?: boolean; by?: Actor | null }

defineProps<{ facts: Fact[] }>()
</script>

<template>
  <dl class="m-0 grid grid-cols-2 gap-x-10 gap-y-4 border-y border-slate-200 py-4 sm:flex sm:flex-wrap">
    <div v-for="fact in facts" :key="fact.label" class="min-w-0">
      <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{{ fact.label }}</dt>
      <dd class="m-0 mt-1 text-sm text-slate-900" :class="fact.mono && 'font-mono'" :title="fact.title">{{ fact.value }}</dd>
      <dd v-if="fact.by" class="m-0 mt-1 text-xs text-slate-600"><span class="sr-only">by </span><ActorName :actor="fact.by" /></dd>
    </div>
  </dl>
</template>
