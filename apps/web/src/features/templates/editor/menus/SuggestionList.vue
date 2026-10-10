<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'

export type SuggestionItem = {
  id: string
  label: string
  hint?: string
  group?: string
  icon?: Component
  glyph?: string
  shortcut?: string
  mono?: boolean
}

const props = defineProps<{
  items: SuggestionItem[]
  query: string
  title: string
  empty: string
  command: (item: SuggestionItem) => void
}>()

const active = ref(0)
const list = ref<HTMLElement | null>(null)

const groups = computed(() => {
  const order: string[] = []
  const byGroup = new Map<string, { item: SuggestionItem; index: number }[]>()
  props.items.forEach((item, index) => {
    const group = item.group ?? ''
    if (!byGroup.has(group)) {
      byGroup.set(group, [])
      order.push(group)
    }
    byGroup.get(group)!.push({ item, index })
  })
  return order.map((name) => ({ name, entries: byGroup.get(name)! }))
})

watch(
  () => props.items,
  () => {
    active.value = 0
  },
)

watch(active, async (index) => {
  await nextTick()
  list.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
})

function choose(index: number) {
  const item = props.items[index]
  if (item) props.command(item)
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (props.items.length === 0) return false
  if (event.key === 'ArrowDown') {
    active.value = (active.value + 1) % props.items.length
    return true
  }
  if (event.key === 'ArrowUp') {
    active.value = (active.value - 1 + props.items.length) % props.items.length
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    choose(active.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="w-72 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-slate-200" role="listbox" :aria-label="title">
    <div ref="list" class="max-h-80 overflow-y-auto p-1 [scrollbar-width:thin]">
      <p v-if="items.length === 0" class="m-0 px-2.5 py-6 text-center text-sm text-slate-500">{{ empty }}</p>
      <div v-for="group in groups" :key="group.name" role="group" :aria-label="group.name || title">
        <p v-if="group.name" class="m-0 px-2.5 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{{ group.name }}</p>
        <button
          v-for="{ item, index } in group.entries"
          :key="item.id"
          type="button"
          role="option"
          :data-index="index"
          :aria-selected="index === active"
          class="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors motion-reduce:transition-none"
          :class="index === active ? 'bg-slate-100' : 'hover:bg-slate-50'"
          @mouseenter="active = index"
          @mousedown.prevent="choose(index)"
        >
          <span aria-hidden="true" class="flex size-7 shrink-0 items-center justify-center rounded-sm bg-white text-slate-600 ring-1 ring-slate-200">
            <component :is="item.icon" v-if="item.icon" class="size-4" />
            <span v-else class="font-mono text-[11px] font-semibold text-slate-700">{{ item.glyph }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-900" :class="item.mono && 'font-mono text-[13px]'">{{ item.label }}</span>
            <span v-if="item.hint" class="block truncate text-xs text-slate-500">{{ item.hint }}</span>
          </span>
          <kbd v-if="item.shortcut" class="shrink-0 font-mono text-[11px] text-slate-400">{{ item.shortcut }}</kbd>
        </button>
      </div>
    </div>
    <div class="flex items-center gap-3 whitespace-nowrap border-t border-slate-100 px-2.5 py-1.5 font-mono text-[10.5px] text-slate-400">
      <span><kbd>↑↓</kbd> move</span>
      <span><kbd>↵</kbd> insert</span>
      <span class="ml-auto"><kbd>esc</kbd> close</span>
    </div>
  </div>
</template>
