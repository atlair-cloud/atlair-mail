<script setup lang="ts">
import { MediaImage } from '@iconoir/vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref, watch } from 'vue'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { readonly } = useTemplateEditorContext()

const url = ref('')
const broken = ref(false)
const src = computed(() => String(props.node.attrs.src ?? ''))
const usesVariable = computed(() => src.value.includes('{{'))
const align = computed(() => props.node.attrs.textAlign ?? 'center')
const justify = computed(() => ({ left: 'flex-start', center: 'center', right: 'flex-end' })[align.value as 'left' | 'center' | 'right'] ?? 'center')

watch(src, () => {
  broken.value = false
})

function apply() {
  const value = url.value.trim()
  if (/^https?:\/\/\S+$/.test(value) || /^\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}$/.test(value)) {
    props.updateAttributes({ src: value })
    url.value = ''
  }
}
</script>

<template>
  <NodeViewWrapper class="tpl-block tpl-image" :class="{ 'is-selected': selected }" :style="{ justifyContent: justify }" data-type="image">
    <img
      v-if="src && !usesVariable && !broken"
      :src="src"
      :alt="node.attrs.alt"
      :style="{ width: node.attrs.width ? `${node.attrs.width}px` : undefined }"
      draggable="false"
      @error="broken = true"
    />
    <div v-else class="tpl-image-empty" contenteditable="false">
      <MediaImage aria-hidden="true" class="size-5" />
      <template v-if="usesVariable">
        <span class="tpl-image-empty-title">Image from {{ src }}</span>
        <span class="tpl-image-empty-hint">Filled in when the email is sent.</span>
      </template>
      <template v-else-if="broken">
        <span class="tpl-image-empty-title">This image didn’t load</span>
        <span class="tpl-image-empty-hint">Check the address in the sidebar.</span>
      </template>
      <form v-else-if="!readonly" class="tpl-image-form" @submit.prevent="apply">
        <input v-model="url" type="url" placeholder="Paste an image address, https://…" aria-label="Image address" />
        <button type="submit" :disabled="!url.trim()">Add</button>
      </form>
      <span v-else class="tpl-image-empty-title">No image</span>
    </div>
  </NodeViewWrapper>
</template>
