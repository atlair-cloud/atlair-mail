import type { Router } from 'vue-router'

const endpoint = import.meta.env.VITE_ANALYTICS_URL
const attributionKeys = ['ref', 'utm_source', 'utm_medium', 'utm_campaign'] as const
const newAccountWindowMs = 10 * 60 * 1000

const landingParams = new URLSearchParams(window.location.search)
const attribution: Record<string, string> = Object.fromEntries(
  attributionKeys.flatMap((key) => {
    const value = landingParams.get(key)
    return value ? [[key, value.slice(0, 100)]] : []
  }),
)

export function attributionParams() {
  return attribution
}

export function track(name: string, props: { page?: string; label?: string; referrer?: string } = {}) {
  if (!endpoint) return
  const body = JSON.stringify({ name, ...attribution, ...props })
  if (!navigator.sendBeacon?.(endpoint, body)) {
    fetch(endpoint, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {})
  }
}

export function trackSignIn(accountCreatedAt: string) {
  track(Date.now() - Date.parse(accountCreatedAt) < newAccountWindowMs ? 'sign_up' : 'sign_in')
}

function externalReferrer() {
  if (!document.referrer) return undefined
  const host = new URL(document.referrer).host
  return host === window.location.host ? undefined : host
}

export function installAnalytics(router: Router) {
  if (!endpoint) return
  let firstView = true
  router.afterEach((to, from, failure) => {
    if (failure || (!firstView && to.name === from.name)) return
    track('page_view', { page: String(to.name ?? 'unknown'), referrer: firstView ? externalReferrer() : undefined })
    firstView = false
  })
}
