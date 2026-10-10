import type { LocationQueryValue } from 'vue-router'

export function safeRedirect(value: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : null
}

function withRedirect(path: string, redirect: string | null) {
  return redirect ? `${path}?${new URLSearchParams({ redirect })}` : path
}

export function oauthCallbackURLs(redirect: string | null) {
  const origin = window.location.origin
  return {
    callbackURL: `${origin}${withRedirect('/auth/callback', redirect)}`,
    errorCallbackURL: `${origin}${withRedirect('/auth/login', redirect)}`,
  }
}
