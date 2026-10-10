import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ButtonView from './ButtonView.vue'

export const Button = Node.create({
  name: 'button',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: 'Get started' },
      href: { default: '' },
      textAlign: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="button"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'button' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(ButtonView)
  },
})
