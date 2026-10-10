import Blockquote from '@tiptap/extension-blockquote'
import Document from '@tiptap/extension-document'
import { ListItem } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { Button } from './nodes/Button'
import { Image } from './nodes/Image'
import { Column, Columns, Section } from './nodes/Layout'
import { Spacer } from './nodes/Spacer'
import { Variable } from './nodes/Variable'
import { SlashCommand, VariableSuggestion, type VariableMenuOptions } from './menus/suggestions'

const safeLink = /^(https?:\/\/|mailto:)\S+$|^\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}$/

const placeholderFor = ({ node }: { node: { type: { name: string }; attrs: Record<string, unknown> } }) => {
  if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
  return 'Type / for blocks, or {{ for a variable'
}

export function templateExtensions(variables: VariableMenuOptions) {
  return [
    StarterKit.configure({
      document: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        enableClickSelection: true,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['mailto'],
        isAllowedUri: (url) => safeLink.test(url),
        HTMLAttributes: { rel: null, target: null },
      },
      dropcursor: { color: '#5eb7e6', width: 2 },
      trailingNode: { node: 'paragraph' },
    }),
    Document.extend({ content: '(block | layout | section)+' }),
    ListItem.extend({ content: 'paragraph (paragraph | bulletList | orderedList)*' }),
    Blockquote.extend({ content: 'paragraph+' }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
    Placeholder.configure({ placeholder: placeholderFor, showOnlyCurrent: true, includeChildren: true }),
    Variable,
    Button,
    Image,
    Spacer,
    Columns,
    Column,
    Section,
    SlashCommand,
    VariableSuggestion.configure(variables),
  ]
}
