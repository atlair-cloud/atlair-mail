import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import { BracesIcon } from './icons'
import { availableBlocks, filterBlocks, type BlockItem } from '../../lib/blocks'
import { variableKeyPattern } from '../../lib/variables'
import SuggestionList, { type SuggestionItem } from './SuggestionList.vue'

type ListExposed = { onKeyDown: (props: { event: KeyboardEvent }) => boolean }

function renderList(title: string, empty: string) {
  return () => {
    let component: VueRenderer | null = null
    let unmount: (() => void) | null = null
    const toProps = (props: SuggestionProps<SuggestionItem>) => ({
      items: props.items,
      query: props.query,
      title,
      empty,
      command: (item: SuggestionItem) => props.command(item),
    })
    return {
      onStart(props: SuggestionProps<SuggestionItem>) {
        component = new VueRenderer(SuggestionList, { props: toProps(props), editor: props.editor })
        if (component.element) unmount = props.mount(component.element as HTMLElement)
      },
      onUpdate(props: SuggestionProps<SuggestionItem>) {
        component?.updateProps(toProps(props))
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') return false
        return (component?.ref as ListExposed | undefined)?.onKeyDown(props) ?? false
      },
      onExit() {
        unmount?.()
        component?.destroy()
        component = null
        unmount = null
      },
    }
  }
}

const toItem = (block: BlockItem): SuggestionItem => ({
  id: block.id,
  label: block.label,
  hint: block.hint,
  group: block.group,
  icon: block.icon,
  glyph: block.glyph,
  shortcut: block.shortcut,
})

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    let blocks: BlockItem[] = []
    return [
      Suggestion<SuggestionItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          return $from.parent.type.name === 'paragraph'
        },
        items: ({ editor, query }) => {
          blocks = filterBlocks(availableBlocks(editor), query)
          return blocks.map(toItem)
        },
        command: ({ editor, range, props }) => {
          blocks.find((block) => block.id === props.id)?.run(editor, range)
        },
        render: renderList('Blocks', 'No blocks match'),
      }),
    ]
  },
})

export type VariableMenuOptions = {
  declared: () => string[]
  onCreate: (key: string) => void
}

export const VariableSuggestion = Extension.create<VariableMenuOptions>({
  name: 'variableSuggestion',

  addOptions() {
    return { declared: () => [], onCreate: () => {} }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      Suggestion<SuggestionItem>({
        editor: this.editor,
        pluginKey: new PluginKey('variableSuggestion'),
        char: '{{',
        allowedPrefixes: null,
        items: ({ query }) => {
          const needle = query.replace(/\}+$/, '').trim()
          const declared = options.declared()
          const matches = declared
            .filter((key) => key.toLowerCase().includes(needle.toLowerCase()))
            .map((key): SuggestionItem => ({ id: key, label: key, group: 'Variables', icon: BracesIcon, mono: true }))
          const creatable = needle && variableKeyPattern.test(needle) && !declared.includes(needle)
          return creatable
            ? [...matches, { id: `create:${needle}`, label: needle, hint: 'Create a new variable', group: 'New', icon: BracesIcon, mono: true }]
            : matches
        },
        command: ({ editor, range, props }) => insertVariable(editor, range, props.id, options),
        render: renderList('Variables', 'Type a name, like first_name'),
      }),
    ]
  },
})

function insertVariable(editor: Editor, range: Range, id: string, options: VariableMenuOptions) {
  const key = id.startsWith('create:') ? id.slice('create:'.length) : id
  if (id.startsWith('create:')) options.onCreate(key)
  editor.chain().focus().deleteRange(range).insertVariable(key).run()
}
