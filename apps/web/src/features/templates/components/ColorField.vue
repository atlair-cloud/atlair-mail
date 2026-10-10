<script setup lang="ts">
import { ref, watch } from 'vue'
import { hexColor } from '../lib/theme'

const props = defineProps<{ label: string; swatches?: string[]; disabled?: boolean }>()
const model = defineModel<string>({ required: true })

const text = ref(model.value)
const invalid = ref(false)

watch(model, (value) => {
  text.value = value
  invalid.value = false
})

function commit() {
  const value = text.value.trim().startsWith('#') ? text.value.trim() : `#${text.value.trim()}`
  if (hexColor.test(value)) {
    model.value = value.toLowerCase()
    invalid.value = false
  } else {
    invalid.value = true
  }
}

const id = `color-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div>
    <label :for="id" class="block text-xs font-medium text-slate-700">{{ label }}</label>
    <div class="mt-1.5 flex items-center gap-2">
      <label class="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-sm ring-1 ring-black/10" :style="{ backgroundColor: model }" :class="props.disabled && 'pointer-events-none opacity-60'">
        <span class="sr-only">Pick {{ label.toLowerCase() }}</span>
        <input v-model="model" type="color" class="absolute inset-0 cursor-pointer opacity-0" :disabled="props.disabled" />
      </label>
      <input
        :id="id"
        v-model="text"
        type="text"
        spellcheck="false"
        maxlength="7"
        :disabled="props.disabled"
        :aria-invalid="invalid"
        class="h-8 w-full min-w-0 rounded-sm bg-white px-2 font-mono text-xs uppercase text-slate-900 outline-none ring-1 transition-shadow focus:ring-slate-400 disabled:opacity-60"
        :class="invalid ? 'ring-red-300' : 'ring-slate-200'"
        @blur="commit"
        @keydown.enter.prevent="commit"
      />
    </div>
    <div v-if="swatches?.length" class="mt-2 flex flex-wrap gap-1.5" role="group" :aria-label="`${label} presets`">
      <button
        v-for="swatch in swatches"
        :key="swatch"
        type="button"
        :disabled="props.disabled"
        class="size-5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
        :class="model.toLowerCase() === swatch && 'ring-2 ring-offset-1 ring-slate-500'"
        :style="{ backgroundColor: swatch }"
        :aria-label="swatch"
        :aria-pressed="model.toLowerCase() === swatch"
        @click="model = swatch"
      />
    </div>
  </div>
</template>
