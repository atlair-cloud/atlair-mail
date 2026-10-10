<script setup lang="ts">
import { NavArrowLeft, NavArrowRight } from '@iconoir/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    rowCount: number
    hasNext: boolean
    pageSizes?: number[]
    noun?: string
  }>(),
  { pageSizes: () => [25, 50, 100], noun: 'rows' },
)

const emit = defineEmits<{ previous: []; next: []; 'update:pageSize': [size: number] }>()

const range = computed(() => {
  if (props.rowCount === 0) return `No ${props.noun}`
  const start = (props.page - 1) * props.pageSize + 1
  return `${start}–${start + props.rowCount - 1}${props.hasNext ? '' : ` of ${start + props.rowCount - 1}`}`
})

const sizeItems = computed(() => props.pageSizes.map((size) => ({ label: String(size), value: size })))

const pageSizeModel = computed({
  get: () => props.pageSize,
  set: (size: number) => emit('update:pageSize', size),
})

const stepButton =
  'flex size-7 items-center justify-center rounded-sm text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none'
</script>

<template>
  <nav aria-label="Pagination" class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-500">
    <span class="font-mono tabular-nums" aria-live="polite">{{ range }}</span>
    <div class="flex items-center gap-5">
      <label class="hidden items-center gap-2 sm:flex">
        Rows per page
        <USelect
          v-model="pageSizeModel"
          :items="sizeItems"
          size="xs"
          class="w-16"
          :ui="{ base: 'h-7 rounded-sm bg-white font-mono text-xs tabular-nums', content: 'rounded-sm', item: 'rounded-sm font-mono text-xs' }"
        />
      </label>
      <div class="flex items-center gap-1.5">
        <span class="mr-1 font-mono tabular-nums">Page {{ page }}</span>
        <button type="button" :class="stepButton" :disabled="page === 1" aria-label="Previous page" @click="emit('previous')">
          <NavArrowLeft aria-hidden="true" class="size-3.5" />
        </button>
        <button type="button" :class="stepButton" :disabled="!hasNext" aria-label="Next page" @click="emit('next')">
          <NavArrowRight aria-hidden="true" class="size-3.5" />
        </button>
      </div>
    </div>
  </nav>
</template>
