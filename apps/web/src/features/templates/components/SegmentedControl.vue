<script setup lang="ts" generic="Value extends string | number">
import type { Component } from 'vue'

defineProps<{ options: { value: Value; label: string; icon?: Component }[]; label: string; disabled?: boolean; iconOnly?: boolean }>()
const model = defineModel<Value>({ required: true })
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="flex rounded-sm bg-slate-100 p-0.5 ring-1 ring-slate-200/70" :class="disabled && 'pointer-events-none opacity-60'">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :aria-label="iconOnly ? option.label : undefined"
      :title="iconOnly ? option.label : undefined"
      :disabled="disabled"
      class="flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-atlair-950 motion-reduce:transition-none"
      :class="model === option.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'"
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" aria-hidden="true" class="size-3.5" />
      <span v-if="!iconOnly || !option.icon">{{ option.label }}</span>
    </button>
  </div>
</template>
