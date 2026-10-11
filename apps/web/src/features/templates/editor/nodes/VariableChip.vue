<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import { isBuiltInVariable } from '../../lib/variables'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { declared } = useTemplateEditorContext()

const name = computed(() => String(props.node.attrs.name))
const label = computed(() => `{{${name.value}}}`)
const builtIn = computed(() => isBuiltInVariable(name.value))
const missing = computed(() => !builtIn.value && !declared.value.has(name.value))
const title = computed(() => {
  if (builtIn.value) return `${name.value} is filled in automatically when the email is sent`
  return missing.value ? `${name.value} isn’t declared yet. It’s added when you save.` : `Variable ${name.value}`
})
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="tpl-variable"
    :class="{ 'is-missing': missing, 'is-selected': selected }"
    :title="title"
    data-drag-handle
  >{{ label }}</NodeViewWrapper>
</template>
