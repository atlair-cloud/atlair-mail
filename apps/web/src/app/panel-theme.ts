import { usePreferredDark, useStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

export const themePreference = useStorage<ThemePreference>('atlair-mail:panel-theme', 'system')

const prefersDark = usePreferredDark()

export const panelTheme = computed<'light' | 'dark'>(() =>
  themePreference.value === 'system' ? (prefersDark.value ? 'dark' : 'light') : themePreference.value,
)

watch(
  panelTheme,
  (theme) => {
    document.documentElement.classList.toggle('panel-dark', theme === 'dark')
  },
  { immediate: true },
)

export function setThemePreference(preference: ThemePreference) {
  themePreference.value = preference
}
