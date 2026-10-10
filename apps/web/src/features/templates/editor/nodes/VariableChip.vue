<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { declared } = useTemplateEditorContext()

const name = computed(() => String(props.node.attrs.name))
const label = computed(() => `{{${name.value}}}`)
const missing = computed(() => !declared.value.has(name.value))
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="tpl-variable"
    :class="{ 'is-missing': missing, 'is-selected': selected }"
    :title="missing ? `${name} isn’t declared yet. It’s added when you save.` : `Variable ${name}`"
    data-drag-handle
  >{{ label }}</NodeViewWrapper>
</template>
