<script setup lang="ts" generic="T extends string | number">
import { Check } from '@iconoir/vue'

defineProps<{ options: { value: T; label: string; description?: string }[]; name: string; legend: string; columns?: 1 | 2 | 3; disabled?: boolean }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <fieldset class="m-0 border-0 p-0" :disabled="disabled">
    <legend class="mb-1.5 text-xs font-medium text-slate-700">{{ legend }}</legend>
    <div class="grid gap-2" :class="columns === 3 ? 'sm:grid-cols-3' : columns === 1 ? '' : 'sm:grid-cols-2'">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="relative flex cursor-pointer items-start gap-3 rounded-sm bg-white px-3.5 py-3 ring-1 transition-[box-shadow,background-color] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-atlair-950 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 motion-reduce:transition-none"
        :class="model === option.value ? 'bg-slate-50 ring-2 ring-atlair-950' : 'ring-slate-200 hover:ring-slate-300'"
      >
        <input v-model="model" type="radio" :name="name" :value="option.value" class="sr-only" />
        <span
          aria-hidden="true"
          class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] ring-1 transition-colors motion-reduce:transition-none"
          :class="model === option.value ? 'bg-atlair-950 text-canvas ring-atlair-950' : 'bg-white ring-slate-300'"
        >
          <Check v-if="model === option.value" class="size-3" stroke-width="2.5" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-medium text-slate-900">{{ option.label }}</span>
          <span v-if="option.description" class="mt-0.5 block text-xs leading-relaxed text-slate-500">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
