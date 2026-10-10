import type { RouteLocationRaw, Router } from 'vue-router'

export function routeIfExists(router: Router, name: string, params: Record<string, string> = {}, query?: Record<string, string>): RouteLocationRaw | null {
  return router.hasRoute(name) ? { name, params, query } : null
}
