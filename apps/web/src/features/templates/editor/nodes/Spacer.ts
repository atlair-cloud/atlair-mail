import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import SpacerView from './SpacerView.vue'

export const Spacer = Node.create({
  name: 'spacer',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { height: { default: 24 } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="spacer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'spacer' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(SpacerView)
  },
})
