<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { computed, ref, watch } from 'vue'
import { linkProblem, normalizeLink } from '../lib/links'
import PanelField from './PanelField.vue'

const props = defineProps<{ editor: Editor; revision: number; readonly: boolean; inputClass: string }>()

const state = computed(() => {
  void props.revision
  const { selection } = props.editor.state
  const href = props.editor.isActive('link') ? String(props.editor.getAttributes('link').href ?? '') : ''
  return { href, canLink: Boolean(href) || !selection.empty, from: selection.from, to: selection.to }
})

const href = ref('')
const error = ref<string | null>(null)

watch(
  () => [state.value.href, state.value.from, state.value.to],
  () => {
    href.value = state.value.href
    error.value = null
  },
  { immediate: true },
)

function apply() {
  const value = normalizeLink(href.value)
  if (!value) {
    error.value = linkProblem
    return
  }
  props.editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run()
}

function remove() {
  props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
}
</script>

<template>
  <PanelField v-if="state.canLink" label="Link" for="block-text-link" :error="error" :hint="state.href ? undefined : 'Links the selected text.'">
    <template #aside>
      <button v-if="state.href && !readonly" type="button" class="text-xs text-slate-500 hover:text-red-600" @click="remove">Remove</button>
    </template>
    <form class="flex gap-1.5" @submit.prevent="apply">
      <input
        id="block-text-link"
        v-model="href"
        :class="[inputClass, 'font-mono text-xs']"
        placeholder="https://, email, or {{variable}}"
        spellcheck="false"
        :disabled="readonly"
        :aria-invalid="Boolean(error)"
        @input="error = null"
      />
      <button
        v-if="!readonly"
        type="submit"
        class="h-8 shrink-0 rounded-sm bg-atlair-950 px-2.5 text-xs font-medium text-canvas hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
      >{{ state.href ? 'Update' : 'Add' }}</button>
    </form>
  </PanelField>
  <p v-else class="m-0 text-xs leading-relaxed text-slate-500">Select text to make it a link, or press <kbd class="font-mono">⌘K</kbd>.</p>
</template>
