import type { RoleName } from '../api/members'

export const ROLES: { value: RoleName; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Everything, including deactivating the organization.' },
  { value: 'admin', label: 'Admin', description: 'Manages domains, keys, webhooks, the provider and members.' },
  { value: 'member', label: 'Member', description: 'Sees everything except the audit log, and can send emails.' },
]

export const roleLabel = (role: string) => ROLES.find((item) => item.value === role)?.label ?? role
