<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div class="min-w-0">
      <p class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{{ eyebrow }}</p>
      <h1 tabindex="-1" class="m-0 mt-1.5 break-words text-[28px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ title }}</h1>
      <p v-if="description || $slots.description" class="mb-0 mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
