<script setup lang="ts" generic="Value extends string">
import { Check, NavArrowDown } from '@iconoir/vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'
import type { FilterOption } from './types'

const props = defineProps<{ label: string; options: FilterOption<Value>[]; anyLabel: string }>()

const model = defineModel<Value | null>({ default: null })

const selected = computed(() => props.options.find((option) => option.value === model.value) ?? null)

const items = computed<DropdownMenuItem[]>(() => [
  { label: props.anyLabel, current: model.value === null, onSelect: () => (model.value = null) },
  { type: 'separator' },
  ...props.options.map((option) => ({ label: option.label, dot: option.dot, current: option.value === model.value, onSelect: () => (model.value = option.value) })),
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start', sideOffset: 4 }" :ui="{ content: 'min-w-44 rounded-sm', item: 'rounded-sm text-sm' }">
    <button
      type="button"
      class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm bg-white px-2.5 text-sm ring-1 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 data-[state=open]:bg-slate-50 motion-reduce:transition-none"
      :class="selected ? 'ring-slate-400' : 'ring-slate-200'"
      :aria-label="`${label}: ${selected?.label ?? anyLabel}`"
    >
      <span class="text-slate-500">{{ label }}</span>
      <template v-if="selected">
        <span aria-hidden="true" class="h-3.5 w-px bg-slate-200" />
        <span v-if="selected.dot" aria-hidden="true" class="size-2 rounded-full" :class="selected.dot" />
        <span class="font-medium text-slate-900">{{ selected.label }}</span>
      </template>
      <NavArrowDown aria-hidden="true" class="size-3.5 text-slate-400" />
    </button>
    <template #item-leading="{ item }">
      <span aria-hidden="true" class="flex h-5 w-4 shrink-0 items-center justify-center"><span v-if="item.dot" class="size-2 rounded-full" :class="item.dot" /></span>
    </template>
    <template #item-trailing="{ item }">
      <Check v-if="item.current" aria-label="Selected" class="size-4 text-atlair-950" />
    </template>
  </UDropdownMenu>
</template>
