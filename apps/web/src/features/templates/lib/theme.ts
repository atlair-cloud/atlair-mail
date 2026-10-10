import type { FontFamily, TemplateTheme } from '../api/templates'

export const defaultTheme: Required<TemplateTheme> = {
  brandColor: '#111827',
  textColor: '#1f2937',
  backgroundColor: '#f4f4f5',
  contentColor: '#ffffff',
  fontFamily: 'sans',
  width: 600,
}

export const fontStacks: Record<FontFamily, string> = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
]

export const BRAND_SWATCHES = ['#111827', '#243041', '#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0d9488']

export const resolveTheme = (theme: TemplateTheme): Required<TemplateTheme> => ({ ...defaultTheme, ...theme })

export const hexColor = /^#[0-9a-fA-F]{6}$/

export function readableOn(background: string) {
  const value = Number.parseInt(background.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111827' : '#ffffff'
}
