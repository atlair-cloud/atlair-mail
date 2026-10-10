import { apiFetch } from '../../../lib/api/client'

export type RoleName = 'owner' | 'admin' | 'member'

export type Member = { id: string; userId: string; name: string; email: string; image: string | null; role: RoleName; createdAt: string }

export type Role = { id: string; name: RoleName; permissions: string[] }

export const membersQueryKey = (organizationId: string) => ['organizations', organizationId, 'members'] as const
export const rolesQueryKey = (organizationId: string) => ['organizations', organizationId, 'roles'] as const

const base = (organizationId: string) => `/organizations/${organizationId}/members`

export async function listMembers(organizationId: string) {
  const { data } = await apiFetch<{ data: Member[] }>(`${base(organizationId)}?limit=100`)
  return data
}

export function addMember(organizationId: string, input: { email: string; role: RoleName }) {
  return apiFetch<Member>(base(organizationId), { method: 'POST', body: JSON.stringify(input) })
}

export function updateMemberRole(organizationId: string, memberId: string, role: RoleName) {
  return apiFetch<Member>(`${base(organizationId)}/${memberId}`, { method: 'PATCH', body: JSON.stringify({ role }) })
}

export function removeMember(organizationId: string, memberId: string) {
  return apiFetch<void>(`${base(organizationId)}/${memberId}`, { method: 'DELETE' })
}

export async function listRoles(organizationId: string) {
  const { data } = await apiFetch<{ data: Role[] }>(`/organizations/${organizationId}/roles`)
  return data
}
