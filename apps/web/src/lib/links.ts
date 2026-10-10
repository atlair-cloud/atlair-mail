import type { RouteLocationRaw, Router } from 'vue-router'
import { API_URL } from './api/client'

export const API_DOCS_URL = `${API_URL}/docs/`

export function routeIfExists(router: Router, name: string, params: Record<string, string> = {}, query?: Record<string, string>): RouteLocationRaw | null {
  return router.hasRoute(name) ? { name, params, query } : null
}
