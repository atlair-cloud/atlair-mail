<script setup lang="ts">
import { ArrowRight } from '@iconoir/vue'
import { STARTERS, type StarterId } from '../lib/starters'
import StarterThumbnail from './StarterThumbnail.vue'

defineProps<{ disabled?: boolean; columns?: 2 | 4 }>()
const emit = defineEmits<{ choose: [starter: StarterId] }>()
</script>

<template>
  <ul class="m-0 grid list-none gap-3 p-0" :class="columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'">
    <li v-for="starter in STARTERS" :key="starter.value">
      <button
        type="button"
        :disabled="disabled"
        class="group flex h-full w-full flex-col overflow-hidden rounded-md bg-white text-left ring-1 ring-slate-200 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        @click="emit('choose', starter.value)"
      >
        <span class="block h-32 border-b border-slate-100">
          <StarterThumbnail :starter="starter.value" />
        </span>
        <span class="flex flex-1 items-start justify-between gap-3 px-3.5 py-3">
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-900">{{ starter.label }}</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-slate-500">{{ starter.description }}</span>
          </span>
          <ArrowRight aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-slate-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-slate-700 motion-reduce:transition-none" />
        </span>
      </button>
    </li>
  </ul>
</template>
