<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'default' | 'danger' }>(), { tone: 'default' })
</script>

<template>
  <button
    type="button"
    class="rounded-sm px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-atlair-950 disabled:opacity-50 motion-reduce:transition-none"
    :class="tone === 'danger' ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
  >
    <slot />
  </button>
</template>
