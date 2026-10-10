import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import type { TemplateTheme } from '../api/templates'
import { defaultTheme } from '../lib/theme'

export type TemplateEditorContext = {
  declared: ComputedRef<Set<string>>
  theme: ComputedRef<Required<TemplateTheme>>
  readonly: ComputedRef<boolean>
}

export const templateEditorKey: InjectionKey<TemplateEditorContext> = Symbol('template-editor')

export function useTemplateEditorContext(): TemplateEditorContext {
  return (
    inject(templateEditorKey, null) ?? {
      declared: computed(() => new Set<string>()),
      theme: computed(() => defaultTheme),
      readonly: computed(() => false),
    }
  )
}
