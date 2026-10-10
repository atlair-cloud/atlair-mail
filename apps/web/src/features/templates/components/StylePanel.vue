<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateTheme } from '../api/templates'
import { BRAND_SWATCHES, FONT_OPTIONS, defaultTheme, resolveTheme } from '../lib/theme'
import ColorField from './ColorField.vue'
import PanelField from './PanelField.vue'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{ readonly: boolean }>()
const theme = defineModel<TemplateTheme>({ required: true })

const resolved = computed(() => resolveTheme(theme.value))

function field<K extends keyof TemplateTheme>(key: K) {
  return computed({
    get: () => resolved.value[key],
    set: (value: Required<TemplateTheme>[K]) => {
      const next = { ...theme.value, [key]: value }
      if (value === defaultTheme[key]) delete next[key]
      theme.value = next
    },
  })
}

const brandColor = field('brandColor')
const textColor = field('textColor')
const backgroundColor = field('backgroundColor')
const contentColor = field('contentColor')
const fontFamily = field('fontFamily')
const width = field('width')

const customized = computed(() => Object.keys(theme.value).length > 0)
</script>

<template>
  <div class="grid gap-5 p-4">
    <ColorField v-model="brandColor" label="Brand" :swatches="BRAND_SWATCHES" :disabled="props.readonly" />
    <div class="grid grid-cols-2 gap-3">
      <ColorField v-model="textColor" label="Text" :disabled="props.readonly" />
      <ColorField v-model="contentColor" label="Card" :disabled="props.readonly" />
    </div>
    <ColorField v-model="backgroundColor" label="Background" :disabled="props.readonly" />
    <PanelField label="Font">
      <SegmentedControl v-model="fontFamily" label="Font" :options="FONT_OPTIONS" :disabled="props.readonly" />
    </PanelField>
    <PanelField label="Width" hint="600px fits nearly every inbox.">
      <div class="flex items-center gap-3">
        <USlider v-model="width" :min="480" :max="720" :step="10" size="sm" class="flex-1" :disabled="props.readonly" aria-label="Email width" />
        <span class="w-12 text-right font-mono text-xs tabular-nums text-slate-600">{{ width }}px</span>
      </div>
    </PanelField>
    <button
      v-if="customized && !props.readonly"
      type="button"
      class="justify-self-start rounded-sm text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
      @click="theme = {}"
    >Reset to defaults</button>
  </div>
</template>
