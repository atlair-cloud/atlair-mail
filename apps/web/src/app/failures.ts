import { shallowRef, type App } from 'vue'
import type { Router } from 'vue-router'

export type FailureKind = 'crash' | 'stale'

export type Failure = { kind: FailureKind; error: unknown }

export const appFailure = shallowRef<Failure | null>(null)

const RELOAD_KEY = 'atlair-mail:stale-reload-at'
const RELOAD_COOLDOWN_MS = 30_000
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|unable to preload css/i

export function isStaleBuildError(error: unknown) {
  return error instanceof Error && CHUNK_ERROR.test(error.message)
}

function reloadOnceAt(path: string) {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.assign(path)
  return true
}

export function failureDetails(error: unknown, path: string) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return [`Build: ${import.meta.env.VITE_BUILD_SHA}`, `Page: ${path}`, `Time: ${new Date().toISOString()}`, `Error: ${message}`].join('\n')
}

export function installFailureHandling(app: App, router: Router) {
  app.config.errorHandler = (error) => {
    console.error(error)
    appFailure.value ??= { kind: isStaleBuildError(error) ? 'stale' : 'crash', error }
  }

  router.onError((error, to) => {
    console.error(error)
    if (isStaleBuildError(error)) {
      if (!reloadOnceAt(to.fullPath)) appFailure.value = { kind: 'stale', error }
      return
    }
    appFailure.value = { kind: 'crash', error }
  })

  router.afterEach((_to, _from, failure) => {
    if (!failure) appFailure.value = null
  })
}
