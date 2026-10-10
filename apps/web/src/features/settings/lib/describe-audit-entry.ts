import type { AuditEntry } from '../api/audit-log'
import { roleLabel } from './roles'

type Change = { before?: Record<string, string>; after?: Record<string, string>; userId?: string; role?: string }

export function describeAuditEntry(entry: AuditEntry, personName: (userId: string | undefined) => string) {
  const changes = (entry.changes ?? {}) as Change
  switch (entry.action) {
    case 'organization.created':
      return 'created the organization'
    case 'organization.updated': {
      const parts = []
      if (changes.before?.name !== changes.after?.name) parts.push(`renamed it from “${changes.before?.name}” to “${changes.after?.name}”`)
      if (changes.before?.slug !== changes.after?.slug) parts.push(`changed the slug to ${changes.after?.slug}`)
      return parts.join(' and ') || 'updated the organization'
    }
    case 'organization.deactivated':
      return 'deactivated the organization'
    case 'member.added':
      return `added ${personName(changes.userId)} as ${roleLabel(changes.role ?? '').toLowerCase()}`
    case 'member.role_updated':
      return `changed a member’s role from ${roleLabel(changes.before?.role ?? '').toLowerCase()} to ${roleLabel(changes.after?.role ?? '').toLowerCase()}`
    case 'member.removed':
      return `removed ${personName(changes.userId)}`
    default:
      return entry.action
  }
}
