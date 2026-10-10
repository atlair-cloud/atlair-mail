import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import VariableChip from './VariableChip.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (name: string) => ReturnType
    }
  }
}

export const Variable = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-variable') ?? '',
        renderHTML: (attributes) => ({ 'data-variable': attributes.name }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tpl-variable' }), `{{${node.attrs.name}}}`]
  },

  renderText({ node }) {
    return `{{${node.attrs.name}}}`
  },

  addNodeView() {
    return VueNodeViewRenderer(VariableChip)
  },

  addCommands() {
    return {
      insertVariable:
        (name) =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name, attrs: { name } }, { type: 'text', text: ' ' }]).run(),
    }
  },
})
