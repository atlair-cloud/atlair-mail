<script setup lang="ts">
import { Check, Copy } from '@iconoir/vue'
import { useClipboard } from '@vueuse/core'

const props = withDefaults(defineProps<{ value: string; label?: string; tone?: 'light' | 'dark'; iconOnly?: boolean }>(), { label: 'Copy', tone: 'light', iconOnly: false })

const { copy, copied, isSupported } = useClipboard({ copiedDuring: 1500 })
</script>

<template>
  <UTooltip v-if="isSupported && iconOnly" arrow :content="{ side: 'top' }" :text="copied ? 'Copied' : label">
    <button
      type="button"
      class="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
      :aria-label="copied ? 'Copied' : label"
      @click="copy(props.value)"
    >
      <Check v-if="copied" aria-hidden="true" class="size-3.5 text-emerald-600" />
      <Copy v-else aria-hidden="true" class="size-3.5" />
    </button>
  </UTooltip>
  <button
    v-else-if="isSupported"
    type="button"
    class="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium focus-visible:outline-2"
    :class="tone === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white focus-visible:outline-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-atlair-950'"
    :aria-label="copied ? 'Copied' : label"
    @click="copy(props.value)"
  >
    <Check v-if="copied" aria-hidden="true" class="size-3.5" />
    <Copy v-else aria-hidden="true" class="size-3.5" />
    <span>{{ copied ? 'Copied' : label }}</span>
  </button>
</template>
