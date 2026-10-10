<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { readonly } = useTemplateEditorContext()

const live = ref<number | null>(null)
const height = computed(() => live.value ?? Number(props.node.attrs.height ?? 24))

function resize(event: PointerEvent) {
  if (readonly.value) return
  const startY = event.clientY
  const start = height.value
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  const move = (next: PointerEvent) => {
    live.value = Math.min(160, Math.max(4, Math.round((start + next.clientY - startY) / 4) * 4))
  }
  const stop = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', stop)
    if (live.value !== null) props.updateAttributes({ height: live.value })
    live.value = null
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', stop)
}
</script>

<template>
  <NodeViewWrapper class="tpl-block tpl-spacer" :class="{ 'is-selected': selected, 'is-resizing': live !== null }" :style="{ height: `${height}px` }" data-type="spacer">
    <span class="tpl-spacer-label" contenteditable="false">{{ height }}px</span>
    <span
      v-if="!readonly"
      class="tpl-spacer-grip"
      contenteditable="false"
      role="separator"
      aria-orientation="horizontal"
      :aria-valuenow="height"
      aria-label="Drag to change the space"
      @pointerdown.prevent="resize"
    />
  </NodeViewWrapper>
</template>
