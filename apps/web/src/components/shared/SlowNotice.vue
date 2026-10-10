<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { productName } from '../../lib/brand'

const props = withDefaults(defineProps<{ after?: number; what?: string }>(), { after: 4, what: productName })

const startedAt = Date.now()
const now = useNow({ interval: 1000 })
const seconds = computed(() => Math.floor((now.value.getTime() - startedAt) / 1000))
const message = computed(() => (seconds.value >= 15 ? 'This is taking longer than usual. It will keep trying.' : `Still waiting on ${props.what}…`))
</script>

<template>
  <Transition enter-active-class="transition duration-300 motion-reduce:transition-none" enter-from-class="translate-y-1 opacity-0">
    <p v-if="seconds >= after" role="status" class="m-0 flex items-center gap-2.5 font-mono text-[11px] text-slate-500">
      <span aria-hidden="true" class="relative inline-flex size-2">
        <span class="absolute inset-0 animate-ping rounded-full bg-status-active/60 motion-reduce:hidden" />
        <span class="relative inline-flex size-2 rounded-full bg-status-active" />
      </span>
      {{ message }}
      <span class="tabular-nums text-slate-400">{{ seconds }}s</span>
    </p>
  </Transition>
</template>
