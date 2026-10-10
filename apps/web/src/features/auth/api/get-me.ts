import { apiFetch } from '../../../lib/api/client'

export type CurrentUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: string
}

export const meQueryKey = ['me'] as const

export function getMe() {
  return apiFetch<CurrentUser>('/me')
}
