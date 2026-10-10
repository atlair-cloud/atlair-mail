import { Extension, type Editor } from '@tiptap/core'
import { useEditor } from '@tiptap/vue-3'
import { shallowRef, watch, type Ref } from 'vue'
import type { TemplateDocument } from '../api/templates'
import { templateExtensions } from './extensions'

const blockParents = new Set(['doc', 'column', 'section'])

export function currentBlock(editor: Editor) {
  const { selection } = editor.state
  const $from = selection.$from
  if ('node' in selection && selection.node) return { pos: selection.from, node: selection.node as NonNullable<ReturnType<typeof editor.state.doc.nodeAt>> }
  for (let depth = $from.depth; depth > 0; depth--) {
    if (blockParents.has($from.node(depth - 1).type.name)) return { pos: $from.before(depth), node: $from.node(depth) }
  }
  return null
}

const BlockShortcuts = Extension.create({
  name: 'blockShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-d': () => {
        const block = currentBlock(this.editor)
        if (!block) return false
        return this.editor.chain().insertContentAt(block.pos + block.node.nodeSize, block.node.toJSON()).run()
      },
    }
  },
})

export type TemplateEditorOptions = {
  content: TemplateDocument
  editable: Ref<boolean>
  declared: () => string[]
  onChange: (content: TemplateDocument) => void
  onCreateVariable: (key: string) => void
}

export function useTemplateEditor(options: TemplateEditorOptions) {
  const revision = shallowRef(0)
  const editor = useEditor({
    content: options.content,
    editable: options.editable.value,
    extensions: [
      ...templateExtensions({ declared: options.declared, onCreate: options.onCreateVariable }),
      BlockShortcuts,
    ],
    editorProps: {
      attributes: { 'aria-label': 'Email content', 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => options.onChange(editor.getJSON() as TemplateDocument),
    onTransaction: () => {
      revision.value++
    },
  })

  watch(options.editable, (editable) => editor.value?.setEditable(editable, false))

  function replace(content: TemplateDocument) {
    editor.value?.commands.setContent(content, { emitUpdate: false })
  }

  return { editor, revision, replace }
}
