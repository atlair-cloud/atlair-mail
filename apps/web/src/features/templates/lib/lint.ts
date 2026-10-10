import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

export type TemplateIssue = { pos: number | null; message: string }

const quote = (text: string) => `“${text.length > 32 ? `${text.slice(0, 31)}…` : text}”`

export function lintTemplate(subject: string, doc: PMNode | null): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  if (!subject.trim()) issues.push({ pos: null, message: 'Add a subject line' })
  doc?.descendants((node, pos) => {
    if (node.type.name === 'button' && !String(node.attrs.href ?? '').trim()) {
      issues.push({ pos, message: `Add a link to the ${quote(String(node.attrs.text ?? 'button'))} button` })
    }
    if (node.type.name === 'image' && !String(node.attrs.src ?? '').trim()) {
      issues.push({ pos, message: 'Add an address for the image, or remove it' })
    }
    return true
  })
  return issues
}

function sanitize(node: JSONContent): JSONContent | null {
  if (node.type === 'image' && !String(node.attrs?.src ?? '').trim()) return null
  if (node.type === 'button' && !String(node.attrs?.href ?? '').trim()) return { ...node, attrs: { ...node.attrs, href: 'https://example.com' } }
  if (!node.content) return node
  const content = node.content.map(sanitize).filter((child): child is JSONContent => child !== null)
  if (content.length === 0 && ['column', 'section'].includes(node.type ?? '')) return { ...node, content: [{ type: 'paragraph' }] }
  return { ...node, content }
}

export function previewableContent<T extends JSONContent>(content: T): T {
  return (sanitize(content) ?? content) as T
}
