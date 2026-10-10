<script setup lang="ts">
import { computed } from 'vue'
import { describeLoadError } from '../../lib/api/describe-error'

const props = defineProps<{ error: unknown; subject: string }>()
defineEmits<{ retry: [] }>()

const description = computed(() => describeLoadError(props.error, props.subject))
</script>

<template>
  <div role="alert" class="rounded-md bg-white px-5 py-6 ring-1 ring-slate-200">
    <p class="m-0 text-sm font-semibold text-slate-900">{{ description.title }}</p>
    <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{{ description.body }}</p>
    <div class="mt-4 flex items-center gap-4">
      <button type="button" class="h-8 rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" @click="$emit('retry')">Try again</button>
      <span class="font-mono text-[11px] text-slate-500">{{ description.detail }}</span>
    </div>
  </div>
</template>
