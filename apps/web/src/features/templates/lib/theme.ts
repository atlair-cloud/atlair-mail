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

export function isDark(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return 0.299 * r + 0.587 * g + 0.114 * b <= 160
}

export const readableOn = (background: string) => (isDark(background) ? '#ffffff' : '#111827')

function luminance(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

export const automaticSectionText = (background: string, theme: Required<TemplateTheme>) =>
  isDark(theme.textColor) === isDark(background) ? readableOn(background) : theme.textColor

export const sectionTone = (background: string) => (isDark(background) ? 'dark' : 'light')

export function sectionToneColors(theme: Required<TemplateTheme>) {
  const textOn = (tone: 'dark' | 'light') => automaticSectionText(tone === 'dark' ? '#000000' : '#ffffff', theme)
  const linkOn = (tone: 'dark' | 'light') => (isDark(theme.brandColor) === (tone === 'dark') ? 'currentColor' : theme.brandColor)
  return {
    '--tpl-text-on-dark': textOn('dark'),
    '--tpl-text-on-light': textOn('light'),
    '--tpl-link-on-dark': linkOn('dark'),
    '--tpl-link-on-light': linkOn('light'),
    '--tpl-icons': isDark(theme.contentColor) ? '#ffffff' : '#374151',
  }
}

export type ButtonVariant = 'filled' | 'outline'
export type ButtonSize = 'small' | 'medium' | 'large'

const buttonSizing: Record<ButtonSize, { padding: string; fontSize: string }> = {
  small: { padding: '8px 14px', fontSize: '13px' },
  medium: { padding: '12px 20px', fontSize: '15px' },
  large: { padding: '16px 28px', fontSize: '17px' },
}

type ButtonAttrs = { color?: string | null; variant?: ButtonVariant | null; size?: ButtonSize | null }

export function buttonLook(attrs: ButtonAttrs, theme: Required<TemplateTheme>) {
  const color = attrs.color ?? theme.brandColor
  const sizing = buttonSizing[attrs.size ?? 'medium']
  return attrs.variant === 'outline'
    ? { backgroundColor: 'transparent', color, boxShadow: `inset 0 0 0 2px ${color}`, ...sizing }
    : { backgroundColor: color, color: readableOn(color), boxShadow: 'none', ...sizing }
}
