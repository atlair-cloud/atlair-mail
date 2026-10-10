<script setup lang="ts" generic="Row">
import type { RouteLocationRaw } from 'vue-router'
import type { TableColumn } from './types'

withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: Row[]
    rowKey: (row: Row) => string
    label: string
    loading?: boolean
    refreshing?: boolean
    skeletonRows?: number
    rowTo?: (row: Row) => RouteLocationRaw
    rowLabel?: (row: Row) => string
  }>(),
  { loading: false, refreshing: false, skeletonRows: 8, rowTo: undefined, rowLabel: undefined },
)

const visibility = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

const cellClass = (column: TableColumn) => [column.width, column.align === 'right' && 'text-right', column.hideBelow && visibility[column.hideBelow]]

const cellValue = (row: Row, key: string) => (row as Record<string, unknown>)[key]
</script>

<template>
  <div class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
    <div v-if="$slots.toolbar" class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
      <slot name="toolbar" />
    </div>

    <table class="w-full table-fixed border-collapse text-sm" :aria-label="label" :aria-busy="loading || refreshing">
      <thead class="border-b border-slate-100 bg-slate-50 text-left">
        <tr class="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
          <th v-for="column in columns" :key="column.key" scope="col" class="px-4 py-2 font-medium" :class="cellClass(column)"><span :class="column.labelHiddenOnMobile && 'max-sm:sr-only'">{{ column.label }}</span></th>
        </tr>
      </thead>

      <tbody v-if="loading" class="divide-y divide-slate-100">
        <tr v-for="n in skeletonRows" :key="n">
          <td v-for="(column, index) in columns" :key="column.key" class="px-4 py-3.5" :class="cellClass(column)">
            <div class="skeleton h-3 rounded-sm" :class="[index === 1 ? 'w-3/4' : 'w-16', column.align === 'right' && 'ml-auto']" />
          </td>
        </tr>
      </tbody>

      <tbody v-else-if="rows.length === 0">
        <tr>
          <td :colspan="columns.length" class="px-6 py-12 text-center">
            <slot name="empty"><p class="m-0 text-sm text-slate-500">Nothing here yet.</p></slot>
          </td>
        </tr>
      </tbody>

      <tbody v-else class="divide-y divide-slate-100 transition-opacity motion-reduce:transition-none" :class="refreshing && 'opacity-60'">
        <tr v-for="row in rows" :key="rowKey(row)" class="relative transition-colors hover:bg-slate-50 motion-reduce:transition-none">
          <td v-for="(column, index) in columns" :key="column.key" class="min-w-0 px-4 py-3" :class="cellClass(column)">
            <RouterLink
              v-if="rowTo && index === 0"
              :to="rowTo(row)"
              :aria-label="rowLabel?.(row)"
              class="absolute inset-0 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950"
            />
            <slot :name="`cell-${column.key}`" :row="row">
              <span class="block truncate text-slate-700">{{ cellValue(row, column.key) }}</span>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="$slots.footer" class="border-t border-slate-100 px-4 py-2">
      <slot name="footer" />
    </div>
  </div>
</template>
