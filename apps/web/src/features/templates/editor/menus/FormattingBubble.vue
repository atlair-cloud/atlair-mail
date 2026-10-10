<script setup lang="ts">
import { AlignCenter, AlignLeft, AlignRight, Bold, Code, Italic, Link, LinkSlash, Strikethrough, Underline } from '@iconoir/vue'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, type Component } from 'vue'

const props = defineProps<{ editor: Editor }>()

const linking = ref(false)
const href = ref('')
const linkError = ref('')
const linkInput = useTemplateRef<HTMLInputElement>('linkInput')
const revision = shallowRef(0)

const bump = () => {
  revision.value++
}
props.editor.on('transaction', bump)
onBeforeUnmount(() => props.editor.off('transaction', bump))

useEventListener(() => props.editor.view.dom, 'keydown', (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !props.editor.state.selection.empty) {
    event.preventDefault()
    openLink()
  }
})

const isActive = (name: string, attrs?: Record<string, unknown>) => computed(() => (revision.value, props.editor.isActive(name, attrs)))

type Mark = { name: string; label: string; icon: Component; keys: string; toggle: () => void }

const marks: (Mark & { active: ReturnType<typeof isActive> })[] = [
  { name: 'bold', label: 'Bold', icon: Bold, keys: '⌘B', toggle: () => props.editor.chain().focus().toggleBold().run() },
  { name: 'italic', label: 'Italic', icon: Italic, keys: '⌘I', toggle: () => props.editor.chain().focus().toggleItalic().run() },
  { name: 'underline', label: 'Underline', icon: Underline, keys: '⌘U', toggle: () => props.editor.chain().focus().toggleUnderline().run() },
  { name: 'strike', label: 'Strikethrough', icon: Strikethrough, keys: '⌘⇧S', toggle: () => props.editor.chain().focus().toggleStrike().run() },
  { name: 'code', label: 'Code', icon: Code, keys: '⌘E', toggle: () => props.editor.chain().focus().toggleCode().run() },
].map((mark) => ({ ...mark, active: isActive(mark.name) }))

const aligns = (['left', 'center', 'right'] as const).map((value) => ({
  value,
  icon: { left: AlignLeft, center: AlignCenter, right: AlignRight }[value],
  active: computed(() => (revision.value, props.editor.isActive({ textAlign: value }) || (value === 'left' && !['center', 'right'].some((other) => props.editor.isActive({ textAlign: other }))))),
}))

const linkActive = isActive('link')

const shouldShow = ({ editor, from, to }: { editor: Editor; from: number; to: number }) => {
  if (!editor.isEditable || from === to) return false
  if (editor.state.selection instanceof NodeSelection) return false
  return editor.state.doc.textBetween(from, to).trim().length > 0
}

async function openLink() {
  href.value = String(props.editor.getAttributes('link').href ?? '')
  linkError.value = ''
  linking.value = true
  await nextTick()
  linkInput.value?.focus()
  linkInput.value?.select()
}

function normalize(value: string) {
  const trimmed = value.trim()
  if (/^\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}$/.test(trimmed)) return trimmed
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`
  if (/^(https?:\/\/|mailto:)\S+$/.test(trimmed)) return trimmed
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed)) return `https://${trimmed}`
  return null
}

function applyLink() {
  const value = normalize(href.value)
  if (!value) {
    linkError.value = 'Use a web address, an email, or a {{variable}}'
    return
  }
  props.editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run()
  linking.value = false
}

function removeLink() {
  props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
  linking.value = false
}

function onHide() {
  linking.value = false
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :should-show="shouldShow"
    :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 }, onHide }"
    class="tpl-bubble"
  >
    <form v-if="linking" class="flex items-center gap-1 p-1" @submit.prevent="applyLink" @keydown.esc.prevent="linking = false; editor.commands.focus()">
      <div class="relative">
        <input
          ref="linkInput"
          v-model="href"
          type="text"
          aria-label="Link address"
          placeholder="https://, email, or {{variable}}"
          class="h-7 w-64 rounded-sm bg-white px-2 font-mono text-xs text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-slate-400"
          :aria-invalid="Boolean(linkError)"
          @input="linkError = ''"
        />
        <p v-if="linkError" role="alert" class="absolute left-0 top-full mt-2 w-max rounded-sm bg-white px-2 py-1 text-xs text-red-600 shadow ring-1 ring-slate-200">{{ linkError }}</p>
      </div>
      <button type="submit" class="h-7 rounded-sm bg-atlair-950 px-2.5 text-xs font-medium text-canvas hover:bg-atlair-900">Apply</button>
      <button v-if="linkActive" type="button" class="tpl-bubble-button" aria-label="Remove link" @click="removeLink"><LinkSlash class="size-4" /></button>
    </form>
    <div v-else class="flex items-center gap-0.5 p-1" role="toolbar" aria-label="Format text">
      <UTooltip v-for="mark in marks" :key="mark.name" :content="{ side: 'top' }" :delay-duration="300">
        <template #content><span class="text-xs">{{ mark.label }} <kbd class="ml-1 font-mono text-[10px] opacity-70">{{ mark.keys }}</kbd></span></template>
        <button type="button" class="tpl-bubble-button" :class="{ 'is-active': mark.active.value }" :aria-label="mark.label" :aria-pressed="mark.active.value" @click="mark.toggle">
          <component :is="mark.icon" aria-hidden="true" class="size-4" />
        </button>
      </UTooltip>
      <span aria-hidden="true" class="mx-1 h-5 w-px bg-slate-200" />
      <UTooltip :content="{ side: 'top' }" :delay-duration="300">
        <template #content><span class="text-xs">Link <kbd class="ml-1 font-mono text-[10px] opacity-70">⌘K</kbd></span></template>
        <button type="button" class="tpl-bubble-button" :class="{ 'is-active': linkActive }" aria-label="Link" :aria-pressed="linkActive" @click="openLink">
          <Link aria-hidden="true" class="size-4" />
        </button>
      </UTooltip>
      <span aria-hidden="true" class="mx-1 h-5 w-px bg-slate-200" />
      <button
        v-for="align in aligns"
        :key="align.value"
        type="button"
        class="tpl-bubble-button"
        :class="{ 'is-active': align.active.value }"
        :aria-label="`Align ${align.value}`"
        :aria-pressed="align.active.value"
        @click="editor.chain().focus().setTextAlign(align.value).run()"
      >
        <component :is="align.icon" aria-hidden="true" class="size-4" />
      </button>
    </div>
  </BubbleMenu>
</template>
