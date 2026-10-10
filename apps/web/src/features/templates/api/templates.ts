import type { JSONContent } from '@tiptap/core'
import type { Actor, Authorship } from '../../../lib/api/actors'
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
  revision: number
  latestVersion: number
  publishedVersion: number | null
  hasUnpublishedChanges: boolean
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

export type TemplateVersionSummary = {
  id: string
  number: number
  subject: string
  note: string | null
  isPublished: boolean
  publishedAt: string
  publishedBy: Actor | null
}

export type TemplateVersion = TemplateVersionSummary & { content: TemplateDocument; theme: TemplateTheme; variables: TemplateVariable[] }

export type VersionChoice = number | 'draft'

export type RenderedTemplate = { subject: string; html: string; text: string }

export type VariableValues = Record<string, string | number>

export const templatePageSize = 50

export const templatesQueryKey = (organizationId: string, query?: { search: string; before?: string }) =>
  query ? (['organizations', organizationId, 'templates', 'list', query] as const) : (['organizations', organizationId, 'templates'] as const)

export const templateQueryKey = (organizationId: string, templateId: string) => ['organizations', organizationId, 'templates', templateId] as const

export const templateVersionsQueryKey = (organizationId: string, templateId: string) => [...templateQueryKey(organizationId, templateId), 'versions'] as const

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

export function updateTemplate(organizationId: string, templateId: string, revision: number, draft: TemplateDraft) {
  return apiFetch<Template>(`${base(organizationId)}/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ revision, ...body(draft), alias: draft.alias }),
  })
}

const withNote = (note: string) => (note.trim() ? { note: note.trim() } : {})

export function publishTemplate(organizationId: string, templateId: string, revision: number, note: string) {
  return apiFetch<Template>(`${base(organizationId)}/${templateId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ revision, ...withNote(note) }),
  })
}

export const templateVersionPageSize = 30

export function listTemplateVersions(organizationId: string, templateId: string, before?: number) {
  const params = new URLSearchParams({ limit: String(templateVersionPageSize) })
  if (before !== undefined) params.set('before', String(before))
  return apiFetch<{ data: TemplateVersionSummary[]; hasMore: boolean }>(`${base(organizationId)}/${templateId}/versions?${params}`)
}

export const templateVersionQueryKey = (organizationId: string, templateId: string, number: number) =>
  [...templateVersionsQueryKey(organizationId, templateId), number] as const

export function getTemplateVersion(organizationId: string, templateId: string, number: number) {
  return apiFetch<TemplateVersion>(`${base(organizationId)}/${templateId}/versions/${number}`)
}

export function restoreTemplateVersion(organizationId: string, templateId: string, number: number, revision: number) {
  return apiFetch<Template>(`${base(organizationId)}/${templateId}/versions/${number}/restore`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  })
}

export function rollbackTemplateVersion(organizationId: string, templateId: string, number: number, revision: number, note: string) {
  return apiFetch<Template>(`${base(organizationId)}/${templateId}/versions/${number}/publish`, {
    method: 'POST',
    body: JSON.stringify({ revision, ...withNote(note) }),
  })
}

export function previewTemplate(organizationId: string, templateId: string, version: VersionChoice, variables: VariableValues) {
  return apiFetch<RenderedTemplate>(`${base(organizationId)}/${templateId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ version, variables }),
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
