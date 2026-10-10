<script setup lang="ts">
import { Copy, Plus, Trash } from '@iconoir/vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

const props = defineProps<{ editor: Editor; stage: HTMLElement | null; paper: HTMLElement | null }>()

type Hovered = { pos: number; element: HTMLElement; top: number; left: number }

const hovered = shallowRef<Hovered | null>(null)
const menuOpen = ref(false)
const dragging = ref(false)

const containers = '.ProseMirror, .tpl-column, .tpl-section'

function blockElement(target: Element | null) {
  let element = target instanceof HTMLElement ? target : target?.parentElement ?? null
  while (element && !element.classList.contains('ProseMirror')) {
    if (element.parentElement?.matches(containers)) return element
    element = element.parentElement
  }
  return null
}

function positionOf(view: EditorView, element: HTMLElement) {
  const pos = view.posAtDOM(element, 0)
  for (const candidate of [pos - 1, pos]) if (candidate >= 0 && view.nodeDOM(candidate) === element) return candidate
  const $pos = view.state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth--) if (view.nodeDOM($pos.before(depth)) === element) return $pos.before(depth)
  return null
}

function locate(event: MouseEvent) {
  if (menuOpen.value || dragging.value || !props.stage || !props.paper || !props.editor.isEditable) return
  const paper = props.paper.getBoundingClientRect()
  if (event.clientY < paper.top || event.clientY > paper.bottom) {
    hovered.value = null
    return
  }
  const insidePaper = event.clientX >= paper.left && event.clientX <= paper.right
  const x = insidePaper ? event.clientX : Math.min(Math.max(event.clientX, paper.left + 24), paper.right - 24)
  const element = blockElement(document.elementFromPoint(x, event.clientY))
  if (!element) return
  if (hovered.value?.element === element) return
  const pos = positionOf(props.editor.view, element)
  if (pos === null) return
  const stage = props.stage.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const contentLeft = rect.left + Number.parseFloat(style.paddingLeft || '0')
  const contentTop = rect.top + Number.parseFloat(style.paddingTop || '0')
  const lineHeight = Number.parseFloat(style.lineHeight) || 26
  const firstLine = Math.min(rect.height - Number.parseFloat(style.paddingTop || '0'), lineHeight)
  hovered.value = {
    pos,
    element,
    top: contentTop - stage.top + firstLine / 2 - 11,
    left: contentLeft - stage.left - 44,
  }
}

useEventListener(() => props.stage, 'mousemove', locate)
useEventListener(() => props.stage, 'mouseleave', () => {
  if (!menuOpen.value && !dragging.value) hovered.value = null
})
useEventListener(() => props.editor.view.dom, 'keydown', () => {
  if (!menuOpen.value) hovered.value = null
})

const node = computed(() => (hovered.value ? props.editor.state.doc.nodeAt(hovered.value.pos) : null))
const isTextBlock = computed(() => ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote'].includes(node.value?.type.name ?? ''))

function select() {
  if (!hovered.value) return
  props.editor.chain().setNodeSelection(hovered.value.pos).run()
}

function onDragStart(event: DragEvent) {
  const target = hovered.value
  if (!target || !event.dataTransfer) return
  const { view } = props.editor
  const selection = NodeSelection.create(view.state.doc, target.pos)
  view.dispatch(view.state.tr.setSelection(selection))
  view.dragging = { slice: selection.content(), move: true }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', '')
  event.dataTransfer.setDragImage(target.element, 0, 0)
  dragging.value = true
}

function onDragEnd() {
  dragging.value = false
  hovered.value = null
}

function insertBelow() {
  const target = hovered.value
  const current = node.value
  if (!target || !current) return
  if (current.type.name === 'paragraph' && current.content.size === 0) {
    props.editor.chain().focus().setTextSelection(target.pos + 1).insertContent('/').run()
    return
  }
  const after = target.pos + current.nodeSize
  props.editor
    .chain()
    .insertContentAt(after, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
    .setTextSelection(after + 2)
    .focus()
    .run()
}

function turnInto(run: (editor: Editor) => void) {
  const target = hovered.value
  if (!target) return
  props.editor.commands.setTextSelection(target.pos + 1)
  run(props.editor)
}

const items = computed<DropdownMenuItem[][]>(() => {
  const target = hovered.value
  const current = node.value
  if (!target || !current) return []
  const actions: DropdownMenuItem[] = [
    {
      label: 'Duplicate',
      icon: Copy,
      kbd: ['meta', 'd'],
      onSelect: () => props.editor.chain().focus().insertContentAt(target.pos + current.nodeSize, current.toJSON()).run(),
    },
    {
      label: 'Delete',
      icon: Trash,
      color: 'error',
      kbd: ['delete'],
      onSelect: () => props.editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + current.nodeSize }).run(),
    },
  ]
  if (!isTextBlock.value) return [actions]
  const turn: DropdownMenuItem = {
    label: 'Turn into',
    children: [
      { label: 'Text', onSelect: () => turnInto((editor) => editor.chain().focus().setParagraph().run()) },
      { label: 'Heading 1', onSelect: () => turnInto((editor) => editor.chain().focus().setHeading({ level: 1 }).run()) },
      { label: 'Heading 2', onSelect: () => turnInto((editor) => editor.chain().focus().setHeading({ level: 2 }).run()) },
      { label: 'Heading 3', onSelect: () => turnInto((editor) => editor.chain().focus().setHeading({ level: 3 }).run()) },
      { label: 'Bulleted list', onSelect: () => turnInto((editor) => editor.chain().focus().toggleBulletList().run()) },
      { label: 'Numbered list', onSelect: () => turnInto((editor) => editor.chain().focus().toggleOrderedList().run()) },
      { label: 'Quote', onSelect: () => turnInto((editor) => editor.chain().focus().toggleBlockquote().run()) },
    ],
  }
  return [[turn], actions]
})

function onMenu(open: boolean) {
  menuOpen.value = open
  if (open) select()
}
</script>

<template>
  <div
    v-if="hovered"
    class="tpl-handle absolute z-10 flex items-center"
    :style="{ top: `${hovered.top}px`, left: `${hovered.left}px` }"
    contenteditable="false"
  >
    <UTooltip text="Add a block below" :content="{ side: 'top' }" :delay-duration="400">
      <button type="button" class="tpl-handle-button" aria-label="Add a block below" @click="insertBelow">
        <Plus aria-hidden="true" class="size-4" />
      </button>
    </UTooltip>
    <UDropdownMenu
      :items="items"
      :open="menuOpen"
      :content="{ align: 'start', side: 'bottom', sideOffset: 4 }"
      :ui="{ content: 'w-52 rounded-sm', item: 'rounded-sm text-sm' }"
      @update:open="onMenu"
    >
      <UTooltip :content="{ side: 'top' }" :delay-duration="400">
        <template #content>
          <span class="text-xs"><b class="font-medium">Drag</b> to move · <b class="font-medium">Click</b> for options</span>
        </template>
        <button type="button" class="tpl-handle-button cursor-grab active:cursor-grabbing" aria-label="Move or change this block" draggable="true" @dragstart="onDragStart" @dragend="onDragEnd">
          <svg aria-hidden="true" viewBox="0 0 10 16" class="h-4 w-2.5 fill-current"><circle cx="2" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" /><circle cx="2" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="2" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg>
        </button>
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>
