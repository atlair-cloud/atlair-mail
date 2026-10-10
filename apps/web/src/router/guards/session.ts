import type { NavigationGuard } from 'vue-router'
import { queryClient } from '../../app/query-client'
import { getMe, meQueryKey } from '../../features/auth'
import { listOrganizations, organizationsQueryKey, useOrganizationStore } from '../../features/organizations'
import { ApiError } from '../../lib/api/client'

async function fetchCurrentUser() {
  try {
    return await queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: getMe })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const authGuard: NavigationGuard = async (to) => {
  if (to.meta.requiresAuth) {
    if (!(await fetchCurrentUser())) return { name: 'auth-login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } }
    return
  }

  if (to.meta.guestOnly) {
    const user = await fetchCurrentUser().catch(() => null)
    if (user) return { name: 'home' }
  }
}

export const resolveHome: NavigationGuard = async () => {
  const organizations = await queryClient.fetchQuery({ queryKey: organizationsQueryKey, queryFn: listOrganizations })
  const lastOrganizationId = useOrganizationStore().lastOrganizationId

  if (organizations.length === 0) return { name: 'onboarding' }
  if (organizations.length === 1) return { name: 'organization', params: { organizationId: organizations[0]!.id } }
  if (organizations.some((organization) => organization.id === lastOrganizationId)) {
    return { name: 'organization', params: { organizationId: lastOrganizationId } }
  }
  return { name: 'organizations' }
}
