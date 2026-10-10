<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ publishedVersion: number | null; hasUnpublishedChanges: boolean; compact?: boolean }>()

const state = computed(() => {
  if (props.publishedVersion === null) return { dot: 'bg-slate-300', label: 'Not published', detail: null }
  return {
    dot: props.hasUnpublishedChanges ? 'bg-status-attention' : 'bg-status-live',
    label: `Live v${props.publishedVersion}`,
    detail: props.hasUnpublishedChanges ? (props.compact ? 'changes' : 'draft has changes') : null,
  }
})
</script>

<template>
  <span class="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px]">
    <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full" :class="state.dot" />
    <span :class="publishedVersion === null ? 'text-slate-500' : 'font-medium text-slate-800'">{{ state.label }}</span>
    <span v-if="state.detail" class="text-amber-700">· {{ state.detail }}</span>
  </span>
</template>
