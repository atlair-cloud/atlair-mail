import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import SocialLinksView from './SocialLinksView.vue'

export const SocialLinks = Node.create({
  name: 'socialLinks',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      links: { default: [] },
      textAlign: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="social-links"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'social-links' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(SocialLinksView)
  },
})
