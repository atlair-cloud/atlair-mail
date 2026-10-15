import type { LocationQueryValue } from 'vue-router'
import { attributionParams } from '../../../lib/analytics'

export function safeRedirect(value: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : null
}

function withRedirect(path: string, redirect: string | null) {
  const query = new URLSearchParams({ ...attributionParams(), ...(redirect ? { redirect } : {}) })
  return query.size ? `${path}?${query}` : path
}

export function oauthCallbackURLs(redirect: string | null) {
  const origin = window.location.origin
  return {
    callbackURL: `${origin}${withRedirect('/auth/callback', redirect)}`,
    errorCallbackURL: `${origin}${withRedirect('/auth/login', redirect)}`,
  }
}
