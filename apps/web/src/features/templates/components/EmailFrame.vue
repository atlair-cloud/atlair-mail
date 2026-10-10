<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

const props = withDefaults(defineProps<{ html: string | undefined; title: string; height?: number; loading?: boolean }>(), { height: 420, loading: false })

const minimumWidth = 640
const box = useTemplateRef<HTMLElement>('box')
const { width } = useElementSize(box)
const frameWidth = computed(() => Math.max(width.value, minimumWidth))
const scale = computed(() => (width.value ? width.value / frameWidth.value : 1))
</script>

<template>
  <div ref="box" class="relative overflow-hidden rounded-sm bg-white ring-1 ring-slate-200" :style="{ height: `${props.height}px` }">
    <div v-if="loading || !html" class="skeleton absolute inset-3 rounded-sm" aria-busy="true" :aria-label="`Rendering ${title}`" />
    <iframe
      v-else
      :title="title"
      sandbox=""
      :srcdoc="html"
      class="absolute left-0 top-0 origin-top-left border-0 bg-white"
      :style="{ width: `${frameWidth}px`, height: `${props.height / scale}px`, transform: `scale(${scale})` }"
    />
  </div>
</template>
