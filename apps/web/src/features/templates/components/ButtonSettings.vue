<script setup lang="ts">
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from '@iconoir/vue'
import type { Editor } from '@tiptap/core'
import { computed, ref, watch } from 'vue'
import type { TemplateTheme } from '../api/templates'
import { setNodeAttrs, type LocatedNode } from '../editor/useTemplateEditor'
import { isSafeLink } from '../lib/links'
import { BRAND_SWATCHES, type ButtonSize, type ButtonVariant } from '../lib/theme'
import ColorField from './ColorField.vue'
import PanelField from './PanelField.vue'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{ editor: Editor; target: LocatedNode; theme: Required<TemplateTheme>; readonly: boolean; inputClass: string }>()

const update = (patch: Record<string, unknown>) => {
  if (!props.readonly) setNodeAttrs(props.editor, props.target, patch)
}

const attrs = computed(() => props.target.node.attrs as Record<string, unknown>)

const text = ref('')
const href = ref('')
const linkError = ref<string | null>(null)

watch(
  attrs,
  (value) => {
    text.value = String(value.text ?? '')
    href.value = String(value.href ?? '')
  },
  { immediate: true },
)

watch(
  () => props.target.pos,
  () => {
    linkError.value = null
  },
)

function commitText() {
  const value = text.value.trim()
  if (value) update({ text: value })
  else text.value = String(attrs.value.text ?? '')
}

function commitHref() {
  const value = href.value.trim()
  linkError.value = !value || isSafeLink(value) ? null : 'Start with https://, http:// or mailto:, or use a {{variable}}'
  if (!linkError.value) update({ href: value })
}

const variant = computed({
  get: () => (attrs.value.variant as ButtonVariant | null) ?? 'filled',
  set: (value: ButtonVariant) => update({ variant: value === 'filled' ? null : value }),
})

const size = computed({
  get: () => (attrs.value.size as ButtonSize | null) ?? 'medium',
  set: (value: ButtonSize) => update({ size: value === 'medium' ? null : value }),
})

type Placement = 'left' | 'center' | 'right' | 'full'

const placementOptions: { value: Placement; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'full', label: 'Full width', icon: AlignJustify },
]

const placement = computed({
  get: (): Placement => (attrs.value.fullWidth ? 'full' : ((attrs.value.textAlign as Placement | null) ?? 'left')),
  set: (value: Placement) => update(value === 'full' ? { fullWidth: true } : { fullWidth: null, textAlign: value }),
})

const customColor = computed(() => (attrs.value.color as string | null) ?? null)
const color = computed({
  get: () => customColor.value ?? props.theme.brandColor,
  set: (value: string) => update({ color: value === props.theme.brandColor ? null : value }),
})
</script>

<template>
  <PanelField label="Label" for="block-button-text">
    <input id="block-button-text" v-model="text" :class="inputClass" maxlength="200" :disabled="readonly" @blur="commitText" @keydown.enter.prevent="commitText" />
  </PanelField>
  <PanelField label="Link" for="block-button-href" :error="linkError" hint="A web address, mailto:, or a {{variable}} such as {{reset_url}}.">
    <input id="block-button-href" v-model="href" :class="[inputClass, 'font-mono text-xs']" placeholder="https://" spellcheck="false" :disabled="readonly" @blur="commitHref" @keydown.enter.prevent="commitHref" />
  </PanelField>
  <PanelField label="Style">
    <SegmentedControl v-model="variant" label="Button style" :disabled="readonly" :options="[{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }]" />
  </PanelField>
  <PanelField label="Size">
    <SegmentedControl v-model="size" label="Button size" :disabled="readonly" :options="[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]" />
  </PanelField>
  <PanelField label="Alignment">
    <SegmentedControl v-model="placement" label="Alignment" icon-only :disabled="readonly" :options="placementOptions" />
  </PanelField>
  <ColorField v-model="color" label="Color" :swatches="BRAND_SWATCHES" :disabled="readonly">
    <template #aside>
      <button v-if="customColor && !readonly" type="button" class="text-xs text-slate-500 hover:text-slate-900" @click="update({ color: null })">Use brand color</button>
    </template>
  </ColorField>
</template>
