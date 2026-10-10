<script setup lang="ts">
import { Laptop, SmartphoneDevice } from '@iconoir/vue'
import type { Editor } from '@tiptap/vue-3'
import { EditorContent } from '@tiptap/vue-3'
import { computed, nextTick, onMounted, provide, ref, useTemplateRef } from 'vue'
import type { TemplateTheme } from '../api/templates'
import { templateEditorKey } from '../editor/context'
import '../editor/editor.css'
import BlockHandle from '../editor/menus/BlockHandle.vue'
import FormattingBubble from '../editor/menus/FormattingBubble.vue'
import { fontStacks } from '../lib/theme'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{ editor: Editor | undefined; theme: Required<TemplateTheme>; declared: string[]; readonly: boolean }>()
const device = defineModel<'desktop' | 'mobile'>('device', { required: true })

const mobileWidth = 375

const stage = useTemplateRef<HTMLElement>('stage')
const paper = useTemplateRef<HTMLElement>('paper')
const mounted = ref(false)

provide(templateEditorKey, {
  declared: computed(() => new Set(props.declared)),
  theme: computed(() => props.theme),
  readonly: computed(() => props.readonly),
})

const paperStyle = computed(() => ({
  '--tpl-brand': props.theme.brandColor,
  '--tpl-text': props.theme.textColor,
  '--tpl-content': props.theme.contentColor,
  '--tpl-font': fontStacks[props.theme.fontFamily],
  '--tpl-width': `${device.value === 'mobile' ? mobileWidth : props.theme.width}px`,
}))

onMounted(async () => {
  await nextTick()
  mounted.value = true
})

function focusEnd(event: MouseEvent) {
  if (props.readonly || !props.editor || event.target !== event.currentTarget) return
  props.editor.chain().focus('end').run()
}
</script>

<template>
  <div
    ref="stage"
    class="relative flex min-h-[560px] justify-center rounded-md px-4 pb-24 pt-16 ring-1 ring-black/5 transition-colors duration-300 sm:px-16 motion-reduce:transition-none"
    :style="{ backgroundColor: theme.backgroundColor }"
    @mousedown="focusEnd"
  >
    <div class="absolute inset-x-3 top-3 flex items-center justify-between gap-3" @mousedown.stop>
      <span class="rounded-sm bg-[#ffffff]/70 px-2 py-1 font-mono text-[10.5px] text-[#52525b] backdrop-blur">{{ device === 'mobile' ? `Phone · ${mobileWidth}px` : `Desktop · ${theme.width}px` }}</span>
      <SegmentedControl
        v-model="device"
        label="Editing view"
        icon-only
        class="w-20"
        :options="[{ value: 'desktop', label: 'Desktop', icon: Laptop }, { value: 'mobile', label: 'Phone', icon: SmartphoneDevice }]"
      />
    </div>
    <div ref="paper" class="tpl-paper self-start" :class="{ 'is-mobile': device === 'mobile' }" :style="paperStyle">
      <EditorContent v-if="editor" :editor="editor" />
    </div>
    <template v-if="editor && mounted && !readonly">
      <BlockHandle :editor="editor" :stage="stage" :paper="paper" />
      <FormattingBubble :editor="editor" />
    </template>
  </div>
</template>
