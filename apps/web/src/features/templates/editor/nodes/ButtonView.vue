<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { readableOn } from '../../lib/theme'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { theme, readonly } = useTemplateEditorContext()

const editing = ref(false)
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

const align = computed(() => props.node.attrs.textAlign ?? 'left')
const hasLink = computed(() => String(props.node.attrs.href ?? '').trim() !== '')

async function startEditing() {
  if (readonly.value) return
  draft.value = String(props.node.attrs.text ?? '')
  editing.value = true
  await nextTick()
  input.value?.select()
}

function finish(save: boolean) {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim()
  if (save && text && text !== props.node.attrs.text) props.updateAttributes({ text })
  props.editor.commands.focus()
}
</script>

<template>
  <NodeViewWrapper class="tpl-block tpl-button" :class="{ 'is-selected': selected }" :style="{ textAlign: align }" data-type="button">
    <span
      class="tpl-button-face"
      :style="{ backgroundColor: theme.brandColor, color: readableOn(theme.brandColor) }"
      contenteditable="false"
      @dblclick="startEditing"
    >
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="tpl-button-input"
        :style="{ width: `${Math.max(draft.length, 4) + 1}ch`, color: readableOn(theme.brandColor) }"
        aria-label="Button label"
        maxlength="200"
        @keydown.enter.prevent="finish(true)"
        @keydown.esc.prevent="finish(false)"
        @blur="finish(true)"
      />
      <template v-else>{{ node.attrs.text }}</template>
    </span>
    <span v-if="!hasLink && !readonly" class="tpl-block-warning" contenteditable="false">No link yet</span>
  </NodeViewWrapper>
</template>
