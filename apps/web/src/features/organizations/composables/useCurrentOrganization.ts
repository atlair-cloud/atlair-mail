import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { listOrganizations, organizationsQueryKey } from '../api/list-organizations'

export function useCurrentOrganization() {
  const route = useRoute()
  const organizationId = computed(() => String(route.params.organizationId ?? ''))

  const query = useQuery({ queryKey: organizationsQueryKey, queryFn: listOrganizations })
  const organizations = computed(() => query.data.value ?? [])
  const organization = computed(() => organizations.value.find((org) => org.id === organizationId.value))

  const canManage = computed(() => organization.value?.role === 'owner' || organization.value?.role === 'admin')

  const isOwner = computed(() => organization.value?.role === 'owner')

  return { organizationId, organization, organizations, canManage, isOwner, isPending: query.isPending }
}
