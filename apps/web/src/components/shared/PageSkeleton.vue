<script setup lang="ts">
import SlowNotice from './SlowNotice.vue'

defineProps<{ label?: string }>()
</script>

<template>
  <div aria-busy="true" :aria-label="label ?? 'Loading'">
    <div class="flex items-end justify-between gap-6">
      <div class="min-w-0 flex-1">
        <div class="skeleton h-2.5 w-20 rounded-sm" />
        <div class="skeleton mt-3 h-7 w-64 max-w-full rounded-sm" />
        <div class="skeleton mt-3 h-3 w-80 max-w-full rounded-sm" />
      </div>
      <div class="skeleton h-9 w-36 rounded-sm max-sm:hidden" />
    </div>
    <div class="skeleton-card mt-8 h-24 rounded-md ring-1 ring-slate-200" />
    <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="skeleton-card h-56 rounded-md ring-1 ring-slate-200" />
      <div class="skeleton-card h-56 rounded-md ring-1 ring-slate-200 max-lg:hidden" />
    </div>
    <SlowNotice class="mt-6" />
  </div>
</template>
