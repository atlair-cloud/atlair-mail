<script setup lang="ts">
import CopyButton from './CopyButton.vue'

defineProps<{ title: string; secret: string; hint?: string }>()
</script>

<template>
  <div class="rounded-md bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
    <p class="m-0 text-sm font-medium text-slate-900">{{ title }}</p>
    <div class="mt-2.5 flex items-center gap-2 rounded-sm bg-white px-3 py-2 ring-1 ring-slate-200">
      <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-900">{{ secret }}</code>
      <CopyButton :value="secret" />
    </div>
    <p v-if="hint" class="m-0 mt-2 text-xs leading-relaxed text-slate-600">{{ hint }}</p>
  </div>
</template>
