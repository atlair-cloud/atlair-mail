import { useCallback, useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'atlair:theme'

export const themeScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('${KEY}');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark')}catch(e){}})()`

const listeners = new Set<() => void>()

let override: ThemePreference | null = null

function read(): ThemePreference {
  if (override) return override
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function systemDark() {
  return matchMedia('(prefers-color-scheme: dark)').matches
}

function apply() {
  const pref = read()
  document.documentElement.classList.toggle('dark', pref === 'dark' || (pref === 'system' && systemDark()))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', apply)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', apply)
  }
}


export function useTheme() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
  const setPreference = useCallback((pref: ThemePreference) => {
    override = pref
    try {
      if (pref === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, pref)
    } catch {}
    apply()
  }, [])
  return { dark, setPreference }
}
