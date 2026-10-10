import type { JSONContent } from '@tiptap/core'
import type { TemplateVariable, VariableValues } from '../api/templates'

export const variableKeyPattern = /^[A-Za-z0-9_]{1,50}$/

const variablePattern = () => /\{\{\s*([A-Za-z0-9_]{1,50})\s*\}\}/g

function keysIn(text: string, counts: Map<string, number>) {
  for (const match of text.matchAll(variablePattern())) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + 1)
}

function walk(value: unknown, counts: Map<string, number>) {
  if (typeof value === 'string') return keysIn(value, counts)
  if (Array.isArray(value)) return value.forEach((item) => walk(item, counts))
  if (typeof value !== 'object' || value === null) return
  const node = value as JSONContent
  if (node.type === 'variable' && typeof node.attrs?.name === 'string') counts.set(node.attrs.name, (counts.get(node.attrs.name) ?? 0) + 1)
  Object.values(value).forEach((item) => walk(item, counts))
}

export function countVariables(subject: string, content: JSONContent) {
  const counts = new Map<string, number>()
  keysIn(subject, counts)
  walk(content, counts)
  return counts
}

export function undeclaredVariables(counts: Map<string, number>, declared: TemplateVariable[]) {
  const keys = new Set(declared.map((variable) => variable.key))
  return [...counts.keys()].filter((key) => !keys.has(key)).sort()
}

export function suggestKey(raw: string) {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

export function sampleValues(variables: TemplateVariable[], current: VariableValues) {
  const values: VariableValues = {}
  for (const variable of variables) {
    const value = current[variable.key]
    if (value === undefined || value === '') continue
    if (variable.type === 'number') {
      const number = Number(value)
      if (Number.isFinite(number)) values[variable.key] = number
    } else {
      values[variable.key] = String(value)
    }
  }
  return values
}
