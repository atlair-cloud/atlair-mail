import type { JSONContent } from '@tiptap/core'
import type { Authorship } from '../../../lib/api/actors'
import { apiFetch } from '../../../lib/api/client'

export type FontFamily = 'sans' | 'serif' | 'mono'

export type TemplateTheme = {
  brandColor?: string
  textColor?: string
  backgroundColor?: string
  contentColor?: string
  fontFamily?: FontFamily
  width?: number
}

export type VariableType = 'string' | 'number'

export type TemplateVariable = { key: string; type: VariableType; fallback?: string | number }

export type TemplateDocument = JSONContent & { type: 'doc'; content: JSONContent[] }

export type TemplateSummary = Authorship & {
  id: string
  name: string
  alias: string | null
  subject: string
  variables: TemplateVariable[]
  version: number
}

export type Template = TemplateSummary & { content: TemplateDocument; theme: TemplateTheme }

export type TemplateDraft = {
  name: string
  alias: string | null
  subject: string
  content: TemplateDocument
  theme: TemplateTheme
  variables: TemplateVariable[]
}

export type RenderedTemplate = { subject: string; html: string; text: string }

export type VariableValues = Record<string, string | number>

export const templatePageSize = 50

export const templatesQueryKey = (organizationId: string, query?: { search: string; before?: string }) =>
  query ? (['organizations', organizationId, 'templates', 'list', query] as const) : (['organizations', organizationId, 'templates'] as const)

export const templateQueryKey = (organizationId: string, templateId: string) => ['organizations', organizationId, 'templates', templateId] as const

const base = (organizationId: string) => `/organizations/${organizationId}/templates`

export function listTemplates(organizationId: string, query: { search: string; before?: string }) {
  const params = new URLSearchParams({ limit: String(templatePageSize) })
  if (query.search) params.set('search', query.search)
  if (query.before) params.set('before', query.before)
  return apiFetch<{ data: TemplateSummary[]; hasMore: boolean }>(`${base(organizationId)}?${params}`)
}

export function getTemplate(organizationId: string, idOrAlias: string) {
  return apiFetch<Template>(`${base(organizationId)}/${encodeURIComponent(idOrAlias)}`)
}

const body = (draft: TemplateDraft) => ({
  name: draft.name,
  subject: draft.subject,
  content: draft.content,
  theme: draft.theme,
  variables: draft.variables,
})

export function createTemplate(organizationId: string, draft: TemplateDraft) {
  return apiFetch<Template>(base(organizationId), {
    method: 'POST',
    body: JSON.stringify({ ...body(draft), ...(draft.alias ? { alias: draft.alias } : {}) }),
  })
}

export function updateTemplate(organizationId: string, templateId: string, version: number, draft: TemplateDraft) {
  return apiFetch<Template>(`${base(organizationId)}/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ version, ...body(draft), alias: draft.alias }),
  })
}

export function deleteTemplate(organizationId: string, templateId: string) {
  return apiFetch<void>(`${base(organizationId)}/${templateId}`, { method: 'DELETE' })
}

export function previewDraft(organizationId: string, draft: Omit<TemplateDraft, 'name' | 'alias'>, values: VariableValues) {
  return apiFetch<RenderedTemplate>(`${base(organizationId)}/preview`, {
    method: 'POST',
    body: JSON.stringify({ subject: draft.subject, content: draft.content, theme: draft.theme, variables: draft.variables, values }),
  })
}
