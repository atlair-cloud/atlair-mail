import type { TemplateDraft } from '../api/templates'

const BLOCK_NAMES: Record<string, string> = {
  paragraph: 'text block',
  heading: 'heading',
  bulletList: 'list',
  orderedList: 'list',
  blockquote: 'quote',
  button: 'button',
  image: 'image',
  spacer: 'spacer',
  columns: 'columns block',
  section: 'section',
}

const FIELD_NAMES: Record<string, string> = { href: 'link', src: 'image address', alt: 'alt text', text: 'label', fallback: 'fallback', key: 'name' }

export function describeTemplateError(message: string, draft: TemplateDraft) {
  const match = /^([^:]+): (.+)$/.exec(message)
  if (!match) return message
  const [, path, problem] = match as unknown as [string, string, string]
  const field = path.split('.').at(-1) ?? ''
  const variable = /^variables\[(\d+)\]/.exec(path)
  if (variable) {
    const key = draft.variables[Number(variable[1])]?.key ?? 'A variable'
    return `The ${FIELD_NAMES[field] ?? field} for ${key} ${problem}`
  }
  if (path === 'variables') return `Variables: ${problem}`
  if (path === 'subject') return `The subject ${problem}`
  if (path.startsWith('theme.')) return `The ${field.replace(/Color$/, ' color').toLowerCase()} ${problem}`
  if (path.startsWith('content')) {
    let node: unknown = draft.content
    for (const step of path.matchAll(/\.content\[(\d+)\]/g)) node = (node as { content?: unknown[] })?.content?.[Number(step[1])]
    const type = (node as { type?: string } | undefined)?.type ?? ''
    const what = BLOCK_NAMES[type] ?? 'block'
    return field in FIELD_NAMES ? `A ${what}’s ${FIELD_NAMES[field]} ${problem}` : `A ${what} ${problem}`
  }
  return message
}
