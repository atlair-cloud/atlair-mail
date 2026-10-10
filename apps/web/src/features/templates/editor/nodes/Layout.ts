import { mergeAttributes, Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    layout: {
      insertColumns: (count: 2 | 3) => ReturnType
      insertSection: () => ReturnType
    }
  }
}

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'tpl-column' }), 0]
  },
})

export const Columns = Node.create({
  name: 'columns',
  group: 'layout',
  content: 'column{2,3}',
  isolating: true,
  draggable: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'tpl-columns', 'data-count': node.childCount }), 0]
  },

  addCommands() {
    return {
      insertColumns:
        (count) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }, () => ({ type: 'column', content: [{ type: 'paragraph' }] })),
          }),
    }
  },
})

export const Section = Node.create({
  name: 'section',
  group: 'section',
  content: '(block | layout)+',
  isolating: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      backgroundColor: { default: '#f4f4f5' },
      padding: { default: 16 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="section"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'section',
        class: 'tpl-section',
        style: `background-color: ${node.attrs.backgroundColor ?? 'transparent'}; padding-block: ${node.attrs.padding ?? 16}px`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertSection:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, content: [{ type: 'paragraph' }] }),
    }
  },
})
