<script setup lang="ts">
import GridBackdrop from './GridBackdrop.vue'
import PuffMood, { type PuffMood as Mood } from './PuffMood.vue'

withDefaults(defineProps<{ mood: Mood; eyebrow?: string; title: string; body: string; alert?: boolean }>(), { eyebrow: undefined, alert: false })
</script>

<template>
  <section :role="alert ? 'alert' : undefined" class="relative isolate flex min-h-[min(36rem,70svh)] items-center justify-center px-4 py-16 text-center">
    <GridBackdrop class="-z-10" />
    <div class="flex max-w-md flex-col items-center">
      <span class="flex size-16 items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.05),0_8px_24px_-12px_rgb(15_23_42/0.2)] ring-1 ring-slate-200 [--surface:var(--color-white)]">
        <PuffMood :mood="mood" />
      </span>
      <p v-if="eyebrow" class="mb-0 mt-6 font-mono text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{{ eyebrow }}</p>
      <h1 tabindex="-1" class="m-0 text-2xl font-semibold tracking-tight text-atlair-950 outline-none" :class="eyebrow ? 'mt-2' : 'mt-6'">{{ title }}</h1>
      <p class="mb-0 mt-2.5 text-balance text-sm leading-relaxed text-slate-600">{{ body }}</p>
      <div v-if="$slots.default" class="mt-7 flex flex-wrap items-center justify-center gap-2">
        <slot />
      </div>
      <div v-if="$slots.detail" class="mt-8 w-full">
        <slot name="detail" />
      </div>
    </div>
  </section>
</template>
