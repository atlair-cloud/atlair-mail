<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { computed } from 'vue'
import type { TemplateTheme } from '../api/templates'
import { setNodeAttrs, type LocatedNode } from '../editor/useTemplateEditor'
import { automaticSectionText, contrastRatio } from '../lib/theme'
import ColorField from './ColorField.vue'
import PanelField from './PanelField.vue'

const props = defineProps<{ editor: Editor; target: LocatedNode; theme: Required<TemplateTheme>; readonly: boolean }>()

const BACKGROUND_SWATCHES = ['#f4f4f5', '#f8fafc', '#eef2ff', '#ecfdf5', '#fff7ed', '#fef2f2', '#111827', '#243041']
const TEXT_SWATCHES = ['#ffffff', '#f8fafc', '#111827', '#1f2937', '#4b5563']

const update = (patch: Record<string, unknown>) => {
  if (!props.readonly) setNodeAttrs(props.editor, props.target, patch)
}

const backgroundColor = computed({
  get: () => String(props.target.node.attrs.backgroundColor ?? '#f4f4f5'),
  set: (value: string) => update({ backgroundColor: value }),
})

const customText = computed(() => (props.target.node.attrs.textColor as string | null) ?? null)
const automaticText = computed(() => automaticSectionText(backgroundColor.value, props.theme))

const textColor = computed({
  get: () => customText.value ?? automaticText.value,
  set: (value: string) => update({ textColor: value === automaticText.value ? null : value }),
})

const hardToRead = computed(() => contrastRatio(textColor.value, backgroundColor.value) < 4.5)

const padding = computed({
  get: () => Number(props.target.node.attrs.padding ?? 16),
  set: (value: number) => update({ padding: value }),
})
</script>

<template>
  <ColorField v-model="backgroundColor" label="Background" :swatches="BACKGROUND_SWATCHES" :disabled="readonly" />
  <ColorField v-model="textColor" label="Text" :swatches="TEXT_SWATCHES" :disabled="readonly">
    <template #aside>
      <button v-if="customText && !readonly" type="button" class="text-xs text-slate-500 hover:text-slate-900" @click="update({ textColor: null })">Use automatic</button>
    </template>
    <p v-if="hardToRead" role="status" class="m-0 mt-1.5 text-xs text-amber-700">Hard to read on this background.</p>
    <p v-else-if="!customText" class="m-0 mt-1.5 text-xs leading-relaxed text-slate-500">Automatic: light on dark backgrounds, dark on light ones.</p>
  </ColorField>
  <PanelField label="Padding">
    <div class="flex items-center gap-3">
      <USlider v-model="padding" :min="0" :max="64" :step="4" size="sm" class="flex-1" :disabled="readonly" aria-label="Section padding" />
      <span class="w-12 text-right font-mono text-xs tabular-nums text-slate-600">{{ padding }}px</span>
    </div>
  </PanelField>
</template>
