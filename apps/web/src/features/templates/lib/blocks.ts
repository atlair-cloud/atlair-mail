import {
  CursorPointer,
  List,
  MediaImage,
  Minus,
  NumberedListLeft,
  Quote,
  SquareDashed,
  Text,
  TextArrowsUpDown,
  ViewColumns2,
  ViewColumns3,
} from '@iconoir/vue'
import type { Editor, JSONContent, Range } from '@tiptap/core'
import { markRaw, type Component } from 'vue'

export type BlockGroup = 'Text' | 'Content' | 'Layout'

export type BlockItem = {
  id: string
  label: string
  hint: string
  group: BlockGroup
  icon?: Component
  glyph?: string
  keywords: string[]
  shortcut?: string
  run: (editor: Editor, range?: Range) => void
}

const chainAt = (editor: Editor, range?: Range) => (range ? editor.chain().focus().deleteRange(range) : editor.chain().focus())

const RAW_BLOCKS: BlockItem[] = [
  { id: 'paragraph', label: 'Text', hint: 'Plain paragraph', group: 'Text', icon: Text, keywords: ['paragraph', 'p', 'body'], run: (editor, range) => chainAt(editor, range).setParagraph().run() },
  { id: 'h1', label: 'Heading 1', hint: 'Big section title', group: 'Text', glyph: 'H1', keywords: ['title', 'h1', 'heading'], shortcut: '#', run: (editor, range) => chainAt(editor, range).setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', hint: 'Medium title', group: 'Text', glyph: 'H2', keywords: ['subtitle', 'h2', 'heading'], shortcut: '##', run: (editor, range) => chainAt(editor, range).setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', hint: 'Small title', group: 'Text', glyph: 'H3', keywords: ['h3', 'heading'], shortcut: '###', run: (editor, range) => chainAt(editor, range).setHeading({ level: 3 }).run() },
  { id: 'bullets', label: 'Bulleted list', hint: 'Simple list', group: 'Text', icon: List, keywords: ['ul', 'bullet', 'unordered', 'list'], shortcut: '-', run: (editor, range) => chainAt(editor, range).toggleBulletList().run() },
  { id: 'numbers', label: 'Numbered list', hint: 'Steps in order', group: 'Text', icon: NumberedListLeft, keywords: ['ol', 'ordered', 'numbered', 'steps', 'list'], shortcut: '1.', run: (editor, range) => chainAt(editor, range).toggleOrderedList().run() },
  { id: 'quote', label: 'Quote', hint: 'Testimonial or callout', group: 'Text', icon: Quote, keywords: ['blockquote', 'quote', 'citation'], shortcut: '>', run: (editor, range) => chainAt(editor, range).setBlockquote().run() },
  { id: 'button', label: 'Button', hint: 'Call to action link', group: 'Content', icon: CursorPointer, keywords: ['cta', 'link', 'action', 'button'], run: (editor, range) => chainAt(editor, range).insertContent({ type: 'button' }).run() },
  { id: 'image', label: 'Image', hint: 'Logo, banner or photo', group: 'Content', icon: MediaImage, keywords: ['picture', 'photo', 'logo', 'img'], run: (editor, range) => chainAt(editor, range).insertContent({ type: 'image' }).run() },
  { id: 'divider', label: 'Divider', hint: 'Horizontal line', group: 'Content', icon: Minus, keywords: ['hr', 'line', 'separator', 'rule'], shortcut: '---', run: (editor, range) => chainAt(editor, range).setHorizontalRule().run() },
  { id: 'spacer', label: 'Spacer', hint: 'Empty vertical space', group: 'Content', icon: TextArrowsUpDown, keywords: ['space', 'gap', 'margin', 'padding'], run: (editor, range) => chainAt(editor, range).insertContent({ type: 'spacer' }).run() },
  { id: 'columns2', label: '2 columns', hint: 'Side by side, stacks on phones', group: 'Layout', icon: ViewColumns2, keywords: ['columns', 'grid', 'two', 'side'], run: (editor, range) => chainAt(editor, range).insertColumns(2).run() },
  { id: 'columns3', label: '3 columns', hint: 'Three across, stacks on phones', group: 'Layout', icon: ViewColumns3, keywords: ['columns', 'grid', 'three'], run: (editor, range) => chainAt(editor, range).insertColumns(3).run() },
  { id: 'section', label: 'Section', hint: 'Colored background box', group: 'Layout', icon: SquareDashed, keywords: ['box', 'background', 'container', 'callout', 'section'], run: (editor, range) => chainAt(editor, range).insertSection().run() },
]

export const BLOCKS: BlockItem[] = RAW_BLOCKS.map((block) => (block.icon ? { ...block, icon: markRaw(block.icon) } : block))

const insertable: Record<string, JSONContent> = {
  button: { type: 'button' },
  image: { type: 'image' },
  divider: { type: 'horizontalRule' },
  spacer: { type: 'spacer' },
  columns2: { type: 'columns', content: [{ type: 'column', content: [{ type: 'paragraph' }] }, { type: 'column', content: [{ type: 'paragraph' }] }] },
  columns3: { type: 'columns', content: [1, 2, 3].map(() => ({ type: 'column', content: [{ type: 'paragraph' }] })) },
  section: { type: 'section', content: [{ type: 'paragraph' }] },
}

export function availableBlocks(editor: Editor, range?: Range) {
  return BLOCKS.filter((block) => {
    const content = insertable[block.id]
    if (!content) return true
    const chain = editor.can().chain()
    return (range ? chain.deleteRange(range) : chain).insertContent(content).run()
  })
}

export function filterBlocks(blocks: BlockItem[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return blocks
  return blocks
    .map((block) => {
      const label = block.label.toLowerCase()
      const score = label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : block.keywords.some((keyword) => keyword.startsWith(needle)) ? 2 : -1
      return { block, score }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.block)
}
