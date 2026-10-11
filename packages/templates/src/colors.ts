import type { ButtonNode, SectionNode, TemplateTheme } from "./document.ts";

export const darkText = "#111827";
export const lightText = "#ffffff";

export function isDark(color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b <= 160;
}

export const readableOn = (background: string) => (isDark(background) ? lightText : darkText);

export interface Palette {
  text: string;
  heading: string;
  link: string;
  quote: string;
  quoteBorder: string;
  codeBackground: string;
  divider: string;
  icons: "dark" | "light";
}

export const themePalette = (theme: Required<TemplateTheme>): Palette => ({
  text: theme.textColor,
  heading: theme.textColor,
  link: theme.brandColor,
  quote: "#4b5563",
  quoteBorder: "#e5e7eb",
  codeBackground: "#f4f4f5",
  divider: "#e5e7eb",
  icons: isDark(theme.contentColor) ? "light" : "dark",
});

export function sectionPalette(section: SectionNode, theme: Required<TemplateTheme>): Palette {
  const background = section.attrs?.backgroundColor ?? theme.contentColor;
  const dark = isDark(background);
  const automatic = isDark(theme.textColor) === dark ? readableOn(background) : theme.textColor;
  const text = section.attrs?.textColor ?? automatic;
  const muted = dark ? "rgba(255,255,255,0.24)" : "#e5e7eb";
  return {
    text,
    heading: text,
    link: isDark(theme.brandColor) === dark ? text : theme.brandColor,
    quote: text,
    quoteBorder: muted,
    codeBackground: dark ? "rgba(255,255,255,0.14)" : "#f4f4f5",
    divider: muted,
    icons: dark ? "light" : "dark",
  };
}

const buttonSizing = {
  small: { padding: [8, 14], fontSize: 13 },
  medium: { padding: [12, 20], fontSize: 15 },
  large: { padding: [16, 28], fontSize: 17 },
} as const;

export function buttonLook(button: ButtonNode, theme: Required<TemplateTheme>) {
  const color = button.attrs.color ?? theme.brandColor;
  const outline = button.attrs.variant === "outline";
  const sizing = buttonSizing[button.attrs.size ?? "medium"];
  const inset = outline ? 2 : 0;
  return {
    background: outline ? "transparent" : color,
    text: outline ? color : readableOn(color),
    border: outline ? `2px solid ${color}` : null,
    padding: `${sizing.padding[0] - inset}px ${sizing.padding[1] - inset}px`,
    fontSize: `${sizing.fontSize}px`,
  };
}
