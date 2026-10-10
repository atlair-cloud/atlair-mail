import type { AuditEntry } from '../api/audit-log'
import { roleLabel } from './roles'

type Change = {
  before?: Record<string, string | null>
  after?: Record<string, string | null>
  userId?: string
  role?: string
  name?: string
  address?: string
  url?: string
  permission?: string
  version?: number
  from?: number
  note?: string | null
}

const quoted = (value: string | null | undefined) => `“${value ?? ''}”`

const shortUrl = (value: string | null | undefined) => (value ?? '').replace(/^https:\/\//, '')

const eventsDestination = (events: Record<string, string | null> | undefined) =>
  events?.mode === 'pull' ? 'checking a queue' : `sending to ${shortUrl(events?.url)}`

export function describeAuditEntry(entry: AuditEntry, personName: (userId: string | undefined) => string) {
  const changes = (entry.changes ?? {}) as Change
  switch (entry.action) {
    case 'organization.created':
      return 'created the organization'
    case 'organization.updated': {
      const parts = []
      if (changes.before?.name !== changes.after?.name) parts.push(`renamed it from ${quoted(changes.before?.name)} to ${quoted(changes.after?.name)}`)
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
    case 'api_key.created':
      return `created the API key ${quoted(changes.name)}${changes.permission === 'sending_access' ? ' (sending only)' : ''}`
    case 'api_key.revoked':
      return `revoked the API key ${quoted(changes.name)}`
    case 'domain.added':
      return `added the domain ${changes.name}`
    case 'domain.verified':
      return `verified ${changes.name}`
    case 'domain.verification_lost':
      return `checked ${changes.name}, which is no longer verified`
    case 'domain.removed':
      return `removed the domain ${changes.name}`
    case 'template.created':
      return `created the template ${quoted(changes.name)}`
    case 'template.renamed': {
      const parts = []
      if (changes.before?.name !== changes.after?.name) parts.push(`renamed the template ${quoted(changes.before?.name)} to ${quoted(changes.after?.name)}`)
      if (changes.before?.alias !== changes.after?.alias) {
        const target = parts.length ? 'its' : `${quoted(changes.after?.name)}’s`
        parts.push(changes.after?.alias ? `set ${target} alias to ${changes.after.alias}` : `removed ${target} alias`)
      }
      return parts.join(' and ')
    }
    case 'template.published':
      return `published ${quoted(changes.name)} v${changes.version}${changes.note ? `: ${changes.note}` : ''}`
    case 'template.restored':
      return `restored v${changes.version} of ${quoted(changes.name)} to the draft`
    case 'template.rolled_back':
      return `rolled ${quoted(changes.name)} back to v${changes.from}, now live as v${changes.version}`
    case 'template.deleted':
      return `deleted the template ${quoted(changes.name)}`
    case 'webhook.created':
      return `added a webhook for ${shortUrl(changes.url)}`
    case 'webhook.updated':
      return changes.before?.url !== changes.after?.url
        ? `moved a webhook from ${shortUrl(changes.before?.url)} to ${shortUrl(changes.after?.url)}`
        : `changed the events sent to ${shortUrl(changes.url)}`
    case 'webhook.disabled':
      return `turned off the webhook for ${shortUrl(changes.url)}`
    case 'webhook.enabled':
      return `turned on the webhook for ${shortUrl(changes.url)}`
    case 'webhook.secret_rotated':
      return `rotated the signing secret for ${shortUrl(changes.url)}`
    case 'webhook.deleted':
      return `deleted the webhook for ${shortUrl(changes.url)}`
    case 'suppression.added':
      return `suppressed ${changes.address}`
    case 'suppression.removed':
      return `removed ${changes.address} from the suppression list`
    case 'provider.connected':
      return `connected Amazon SES in ${changes.after?.region}`
    case 'provider.credentials_replaced':
      return `replaced the Amazon SES credentials (${changes.after?.region}, ${changes.after?.accessKeyId})`
    case 'provider.disconnected':
      return 'disconnected Amazon SES'
    case 'provider.events_enabled':
      return `turned on delivery tracking, ${eventsDestination(changes.after)}`
    case 'provider.events_changed':
      return `switched delivery tracking to ${eventsDestination(changes.after)}`
    case 'provider.events_redriven':
      return 'retried the set-aside delivery events'
    default:
      return entry.action
  }
}

export function auditActorName(entry: AuditEntry) {
  if (entry.actor) return entry.actor.name
  if (entry.apiKey) return `API key ${quoted(entry.apiKey.name)}`
  return 'Atlair Mail'
}
