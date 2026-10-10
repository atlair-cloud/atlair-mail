<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center rounded-sm border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
    <div v-if="$slots.icon" aria-hidden="true" class="mb-4 flex size-10 items-center justify-center rounded-sm bg-slate-100 text-slate-500">
      <slot name="icon" />
    </div>
    <h2 class="m-0 text-sm font-semibold text-slate-900">{{ title }}</h2>
    <p v-if="description" class="mb-0 mt-1.5 max-w-80 text-balance text-sm leading-relaxed text-slate-600">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
