<script setup lang="ts">
import { AlignCenter, AlignLeft, AlignRight, Copy, Trash } from '@iconoir/vue'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { computed, ref, watch } from 'vue'
import { currentBlock } from '../editor/useTemplateEditor'
import ColorField from './ColorField.vue'
import PanelField from './PanelField.vue'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{ editor: Editor; revision: number; readonly: boolean }>()

type Located = { pos: number; node: PMNode }

const BLOCK_NAMES: Record<string, string> = {
  paragraph: 'Text',
  heading: 'Heading',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  blockquote: 'Quote',
  horizontalRule: 'Divider',
  button: 'Button',
  image: 'Image',
  spacer: 'Spacer',
  columns: 'Columns',
  section: 'Section',
}

const SECTION_SWATCHES = ['#f4f4f5', '#f8fafc', '#eef2ff', '#ecfdf5', '#fff7ed', '#fef2f2', '#111827', '#243041']

const alignOptions = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
]

const located = computed<{ block: Located | null; section: Located | null; columns: Located | null }>(() => {
  void props.revision
  const block = currentBlock(props.editor)
  const $from = props.editor.state.selection.$from
  let section: Located | null = null
  let columns: Located | null = null
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (!section && node.type.name === 'section') section = { pos: $from.before(depth), node }
    if (!columns && node.type.name === 'columns') columns = { pos: $from.before(depth), node }
  }
  if (block?.node.type.name === 'section') section = null
  if (block?.node.type.name === 'columns') columns = null
  return { block, section, columns }
})

const block = computed(() => located.value.block)
const type = computed(() => block.value?.node.type.name ?? null)
const attrs = computed(() => (block.value?.node.attrs ?? {}) as Record<string, unknown>)

function setAttrs(target: Located | null, patch: Record<string, unknown>) {
  if (!target || props.readonly) return
  const { state, view } = props.editor
  const node = state.doc.nodeAt(target.pos)
  if (!node) return
  view.dispatch(state.tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, ...patch }))
}

const textStyle = computed({
  get: () => (type.value === 'heading' ? `h${attrs.value.level}` : 'p'),
  set: (value: string) => {
    if (!block.value) return
    const chain = props.editor.chain().setTextSelection(block.value.pos + 1)
    if (value === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
  },
})

const textAlign = computed({
  get: () => String(attrs.value.textAlign ?? (type.value === 'image' ? 'center' : 'left')),
  set: (value: string) => setAttrs(block.value, { textAlign: value }),
})

const buttonText = ref('')
const buttonHref = ref('')
const imageSrc = ref('')
const imageAlt = ref('')
const imageHref = ref('')
const linkError = ref<string | null>(null)
const srcError = ref<string | null>(null)
const imageHrefError = ref<string | null>(null)

watch(
  block,
  (current) => {
    const value = (current?.node.attrs ?? {}) as Record<string, unknown>
    buttonText.value = String(value.text ?? '')
    buttonHref.value = String(value.href ?? '')
    imageSrc.value = String(value.src ?? '')
    imageAlt.value = String(value.alt ?? '')
    imageHref.value = String(value.href ?? '')
  },
  { immediate: true },
)

watch(
  () => block.value?.pos,
  () => {
    linkError.value = null
    srcError.value = null
    imageHrefError.value = null
  },
)

const singleVariable = /^\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}$/

function checkLink(value: string, allowEmpty: boolean) {
  const trimmed = value.trim()
  if (!trimmed) return allowEmpty ? null : 'Add a link so the button goes somewhere'
  if (singleVariable.test(trimmed)) return null
  const filled = trimmed.replace(/\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}/g, 'x')
  return /^(https?:\/\/|mailto:)\S+$/.test(filled) ? null : 'Start with https://, http:// or mailto:, or use a {{variable}}'
}

function commitButtonText() {
  const text = buttonText.value.trim()
  if (text) setAttrs(block.value, { text })
  else buttonText.value = String(attrs.value.text ?? '')
}

function commitButtonHref() {
  linkError.value = checkLink(buttonHref.value, true)
  if (!linkError.value) setAttrs(block.value, { href: buttonHref.value.trim() })
}

function commitImageSrc() {
  const value = imageSrc.value.trim()
  const filled = value.replace(/\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}/g, 'x')
  srcError.value = !value || singleVariable.test(value) || /^https?:\/\/\S+$/.test(filled) ? null : 'Use an https:// image address, or a {{variable}}'
  if (!srcError.value) setAttrs(block.value, { src: value })
}

function commitImageHref() {
  imageHrefError.value = checkLink(imageHref.value, true)
  if (!imageHrefError.value) setAttrs(block.value, { href: imageHref.value.trim() || null })
}

const imageWidth = computed({
  get: () => (attrs.value.width as number | null) ?? null,
  set: (value: number | null) => setAttrs(block.value, { width: value }),
})

const spacerHeight = computed({
  get: () => Number(attrs.value.height ?? 24),
  set: (value: number) => setAttrs(block.value, { height: value }),
})

const sectionTarget = computed(() => (type.value === 'section' ? block.value : located.value.section))
const sectionColor = computed({
  get: () => String(sectionTarget.value?.node.attrs.backgroundColor ?? '#f4f4f5'),
  set: (value: string) => setAttrs(sectionTarget.value, { backgroundColor: value }),
})
const sectionPadding = computed({
  get: () => Number(sectionTarget.value?.node.attrs.padding ?? 16),
  set: (value: number) => setAttrs(sectionTarget.value, { padding: value }),
})

const columnsTarget = computed(() => (type.value === 'columns' ? block.value : located.value.columns))
const columnCount = computed({
  get: () => columnsTarget.value?.node.childCount ?? 2,
  set: (count: number) => {
    const target = columnsTarget.value
    if (!target || props.readonly || count === target.node.childCount) return
    const { state, view } = props.editor
    const end = target.pos + target.node.nodeSize - 1
    if (count > target.node.childCount) {
      const column = state.schema.nodes.column!.create(null, state.schema.nodes.paragraph!.create())
      view.dispatch(state.tr.insert(end, column))
      return
    }
    const last = target.node.lastChild!
    const lastStart = end - last.nodeSize
    const previousEnd = lastStart - 1
    const tr = state.tr.delete(lastStart, end)
    view.dispatch(tr.insert(previousEnd, last.content))
  },
})

function duplicate() {
  if (!block.value) return
  props.editor.chain().focus().insertContentAt(block.value.pos + block.value.node.nodeSize, block.value.node.toJSON()).run()
}

function remove() {
  if (!block.value) return
  props.editor.chain().focus().deleteRange({ from: block.value.pos, to: block.value.pos + block.value.node.nodeSize }).run()
}

const inputClass =
  'h-8 w-full rounded-sm bg-white px-2 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition-shadow placeholder:text-slate-400 focus:ring-slate-400 disabled:opacity-60'
</script>

<template>
  <div v-if="!block" class="px-4 py-8 text-center">
    <p class="m-0 text-sm font-medium text-slate-900">Nothing selected</p>
    <p class="mx-auto mb-0 mt-1 max-w-56 text-xs leading-relaxed text-slate-500">Click a block in the email to change it, or type <kbd class="rounded-sm bg-slate-100 px-1 font-mono text-[11px] text-slate-700">/</kbd> to add one.</p>
    <dl class="mx-auto mt-6 grid max-w-56 grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-left text-xs">
      <dt><kbd class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">/</kbd></dt><dd class="m-0 text-slate-600">Insert a block</dd>
      <dt><kbd class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{{ '{{' }}</kbd></dt><dd class="m-0 text-slate-600">Insert a variable</dd>
      <dt><kbd class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">⌘K</kbd></dt><dd class="m-0 text-slate-600">Link selected text</dd>
      <dt><kbd class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">⌘D</kbd></dt><dd class="m-0 text-slate-600">Duplicate block</dd>
      <dt><kbd class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">⌘S</kbd></dt><dd class="m-0 text-slate-600">Save</dd>
    </dl>
  </div>

  <div v-else class="grid gap-5 p-4">
    <div class="flex items-center justify-between gap-2">
      <p class="m-0 text-sm font-semibold text-slate-900">{{ BLOCK_NAMES[type ?? ''] ?? 'Block' }}</p>
      <div v-if="!readonly" class="flex items-center gap-0.5">
        <UTooltip text="Duplicate" :content="{ side: 'top' }">
          <button type="button" class="flex size-7 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Duplicate block" @click="duplicate"><Copy class="size-4" /></button>
        </UTooltip>
        <UTooltip text="Delete" :content="{ side: 'top' }">
          <button type="button" class="flex size-7 items-center justify-center rounded-sm text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete block" @click="remove"><Trash class="size-4" /></button>
        </UTooltip>
      </div>
    </div>

    <template v-if="type === 'paragraph' || type === 'heading'">
      <PanelField label="Style">
        <SegmentedControl v-model="textStyle" label="Text style" :disabled="readonly" :options="[{ value: 'p', label: 'Text' }, { value: 'h1', label: 'H1' }, { value: 'h2', label: 'H2' }, { value: 'h3', label: 'H3' }]" />
      </PanelField>
      <PanelField label="Alignment">
        <SegmentedControl v-model="textAlign" label="Alignment" icon-only :disabled="readonly" :options="alignOptions" />
      </PanelField>
      <p class="m-0 text-xs leading-relaxed text-slate-500">Select text for bold, italic and links.</p>
    </template>

    <template v-else-if="type === 'bulletList' || type === 'orderedList' || type === 'blockquote'">
      <p class="m-0 text-xs leading-relaxed text-slate-500">Press <kbd class="font-mono">Tab</kbd> to indent a list item, <kbd class="font-mono">⇧Tab</kbd> to outdent. Use the ⋮⋮ handle to turn it into something else.</p>
    </template>

    <template v-else-if="type === 'button'">
      <PanelField label="Label" for="block-button-text">
        <input id="block-button-text" v-model="buttonText" :class="inputClass" maxlength="200" :disabled="readonly" @blur="commitButtonText" @keydown.enter.prevent="commitButtonText" />
      </PanelField>
      <PanelField label="Link" for="block-button-href" :error="linkError" hint="A web address, mailto:, or a {{variable}} such as {{reset_url}}.">
        <input id="block-button-href" v-model="buttonHref" :class="[inputClass, 'font-mono text-xs']" placeholder="https://" spellcheck="false" :disabled="readonly" @blur="commitButtonHref" @keydown.enter.prevent="commitButtonHref" />
      </PanelField>
      <PanelField label="Alignment">
        <SegmentedControl v-model="textAlign" label="Alignment" icon-only :disabled="readonly" :options="alignOptions" />
      </PanelField>
    </template>

    <template v-else-if="type === 'image'">
      <PanelField label="Image address" for="block-image-src" :error="srcError" hint="Host it somewhere public. Email clients load it when the email is opened.">
        <input id="block-image-src" v-model="imageSrc" :class="[inputClass, 'font-mono text-xs']" placeholder="https://" spellcheck="false" :disabled="readonly" @blur="commitImageSrc" @keydown.enter.prevent="commitImageSrc" />
      </PanelField>
      <PanelField label="Alt text" for="block-image-alt" hint="Shown when images are off, and read by screen readers.">
        <input id="block-image-alt" v-model="imageAlt" :class="inputClass" maxlength="300" :disabled="readonly" @blur="setAttrs(block, { alt: imageAlt.trim() })" @keydown.enter.prevent="setAttrs(block, { alt: imageAlt.trim() })" />
      </PanelField>
      <PanelField label="Width">
        <template #aside>
          <button v-if="imageWidth !== null && !readonly" type="button" class="text-xs text-slate-500 hover:text-slate-900" @click="imageWidth = null">Reset to full</button>
        </template>
        <div class="flex items-center gap-3">
          <USlider :model-value="imageWidth ?? 552" :min="16" :max="552" :step="4" size="sm" class="flex-1" :disabled="readonly" aria-label="Image width" @update:model-value="(value) => (imageWidth = Number(value))" />
          <span class="w-12 text-right font-mono text-xs tabular-nums text-slate-600">{{ imageWidth ? `${imageWidth}px` : 'Full' }}</span>
        </div>
      </PanelField>
      <PanelField label="Link" for="block-image-href" :error="imageHrefError" hint="Optional. Where the image goes when clicked.">
        <input id="block-image-href" v-model="imageHref" :class="[inputClass, 'font-mono text-xs']" placeholder="https://" spellcheck="false" :disabled="readonly" @blur="commitImageHref" @keydown.enter.prevent="commitImageHref" />
      </PanelField>
      <PanelField label="Alignment">
        <SegmentedControl v-model="textAlign" label="Alignment" icon-only :disabled="readonly" :options="alignOptions" />
      </PanelField>
    </template>

    <template v-else-if="type === 'spacer'">
      <PanelField label="Height">
        <div class="flex items-center gap-3">
          <USlider v-model="spacerHeight" :min="4" :max="160" :step="4" size="sm" class="flex-1" :disabled="readonly" aria-label="Spacer height" />
          <span class="w-12 text-right font-mono text-xs tabular-nums text-slate-600">{{ spacerHeight }}px</span>
        </div>
      </PanelField>
      <p class="m-0 text-xs text-slate-500">You can also drag the spacer’s bottom edge.</p>
    </template>

    <template v-else-if="type === 'horizontalRule'">
      <p class="m-0 text-xs leading-relaxed text-slate-500">A thin line between parts of the email.</p>
    </template>

    <template v-if="columnsTarget">
      <div class="grid gap-3" :class="type !== 'columns' && 'border-t border-slate-100 pt-4'">
        <p v-if="type !== 'columns'" class="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Columns</p>
        <PanelField label="Number of columns" hint="Columns sit side by side on wide screens and stack on phones.">
          <SegmentedControl v-model="columnCount" label="Number of columns" :disabled="readonly" :options="[{ value: 2, label: '2 columns' }, { value: 3, label: '3 columns' }]" />
        </PanelField>
      </div>
    </template>

    <template v-if="sectionTarget">
      <div class="grid gap-4" :class="type !== 'section' && 'border-t border-slate-100 pt-4'">
        <p v-if="type !== 'section'" class="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Section</p>
        <ColorField v-model="sectionColor" label="Background" :swatches="SECTION_SWATCHES" :disabled="readonly" />
        <PanelField label="Padding">
          <div class="flex items-center gap-3">
            <USlider v-model="sectionPadding" :min="0" :max="64" :step="4" size="sm" class="flex-1" :disabled="readonly" aria-label="Section padding" />
            <span class="w-12 text-right font-mono text-xs tabular-nums text-slate-600">{{ sectionPadding }}px</span>
          </div>
        </PanelField>
      </div>
    </template>
  </div>
</template>
