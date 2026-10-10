import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageView from './ImageView.vue'

export const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      width: { default: null },
      href: { default: null },
      textAlign: { default: 'center' },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]', getAttrs: (element) => ({ src: element.getAttribute('src'), alt: element.getAttribute('alt') ?? '' }) }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageView)
  },
})
