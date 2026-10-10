<script setup lang="ts">
import type { StarterId } from '../lib/starters'

defineProps<{ starter: StarterId }>()

const BRAND: Record<StarterId, string> = {
  blank: '#d4d4d8',
  welcome: '#4f46e5',
  'password-reset': '#111827',
  receipt: '#16a34a',
}
</script>

<template>
  <span aria-hidden="true" class="flex h-full w-full items-start justify-center overflow-hidden bg-[#f4f4f5] px-5 pt-4">
    <span class="flex w-full max-w-[11rem] flex-col gap-1.5 rounded-t-[3px] bg-[#ffffff] px-3 pb-6 pt-3 shadow-[0_1px_2px_rgb(15_23_42/0.08),0_6px_16px_-8px_rgb(15_23_42/0.2)]">
      <template v-if="starter === 'blank'">
        <span class="mt-1 h-1.5 w-1/3 rounded-full bg-[#e4e4e7]" />
        <span class="mt-3 flex h-10 items-center justify-center rounded-[3px] border border-dashed border-[#d4d4d8] font-mono text-[9px] text-[#a1a1aa]">/</span>
      </template>

      <template v-else-if="starter === 'welcome'">
        <span class="h-2 w-3/5 rounded-full bg-[#1f2937]" />
        <span class="h-1 w-full rounded-full bg-[#e4e4e7]" />
        <span class="h-1 w-4/5 rounded-full bg-[#e4e4e7]" />
        <span class="mt-1 h-3.5 w-14 rounded-[2px]" :style="{ backgroundColor: BRAND.welcome }" />
        <span class="mt-1 h-px w-full bg-[#e4e4e7]" />
        <span class="flex items-center gap-1"><span class="size-1 rounded-full bg-[#a1a1aa]" /><span class="h-1 w-2/3 rounded-full bg-[#e4e4e7]" /></span>
        <span class="flex items-center gap-1"><span class="size-1 rounded-full bg-[#a1a1aa]" /><span class="h-1 w-1/2 rounded-full bg-[#e4e4e7]" /></span>
      </template>

      <template v-else-if="starter === 'password-reset'">
        <span class="h-2 w-1/2 rounded-full bg-[#1f2937]" />
        <span class="h-1 w-full rounded-full bg-[#e4e4e7]" />
        <span class="h-1 w-3/4 rounded-full bg-[#e4e4e7]" />
        <span class="mt-1 h-3.5 w-16 rounded-[2px]" :style="{ backgroundColor: BRAND['password-reset'] }" />
        <span class="h-1 w-2/3 rounded-full bg-[#e4e4e7]" />
        <span class="mt-1 flex flex-col gap-1 rounded-[2px] bg-[#f8fafc] p-1.5"><span class="h-1 w-full rounded-full bg-[#e4e4e7]" /><span class="h-1 w-1/2 rounded-full bg-[#e4e4e7]" /></span>
      </template>

      <template v-else>
        <span class="h-2 w-3/5 rounded-full bg-[#1f2937]" />
        <span class="h-1 w-4/5 rounded-full bg-[#e4e4e7]" />
        <span class="mt-1 grid grid-cols-3 gap-1 rounded-[2px] bg-[#f4f4f5] p-1.5">
          <span v-for="n in 3" :key="n" class="flex flex-col gap-0.5"><span class="h-1 w-3/4 rounded-full bg-[#a1a1aa]" /><span class="h-1 w-full rounded-full bg-[#d4d4d8]" /></span>
        </span>
        <span class="mt-1 h-3.5 w-14 rounded-[2px]" :style="{ backgroundColor: BRAND.receipt }" />
        <span class="h-1 w-1/2 rounded-full bg-[#e4e4e7]" />
      </template>
    </span>
  </span>
</template>
