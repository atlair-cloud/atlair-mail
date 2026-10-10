import { formatRelativeTime } from '../../../lib/format/relative-time'
import type { Overview } from '../api/get-overview'

export type SetupStepKey = 'provider' | 'domain' | 'api-key' | 'first-email'

export type SetupStep = {
  key: SetupStepKey
  title: string
  why: string
  done: boolean
  status?: string
  statusTone?: 'neutral' | 'waiting' | 'error'
  lockedReason?: string
}

export function primaryDomain(overview: Overview) {
  const { domains } = overview
  return domains.find((domain) => domain.status === 'verified') ?? domains.find((domain) => domain.status === 'pending') ?? domains[0] ?? null
}

export function setupSteps(overview: Overview): SetupStep[] {
  const { setup } = overview
  const domain = primaryDomain(overview)
  const provider = setup.provider

  const domainStatus = (() => {
    if (!domain) return {}
    if (domain.status === 'verified') return { status: `${domain.name} verified`, statusTone: 'neutral' as const }
    if (domain.status === 'failed') return { status: `${domain.name} failed verification`, statusTone: 'error' as const }
    const checked = domain.lastCheckedAt ? ` · checked ${formatRelativeTime(domain.lastCheckedAt)}` : ''
    return { status: `${domain.name} is waiting for DNS${checked}`, statusTone: 'waiting' as const }
  })()

  return [
    {
      key: 'provider',
      title: 'Connect Amazon SES',
      why: 'Emails go out through your own AWS account, so the sending reputation and the bill stay yours.',
      done: provider.connected,
      ...(provider.connected
        ? provider.eventsConnected
          ? { status: `Connected · ${provider.region} · delivery tracking on`, statusTone: 'neutral' as const }
          : { status: `Connected · ${provider.region} · delivery tracking off`, statusTone: 'waiting' as const }
        : {}),
    },
    {
      key: 'domain',
      title: 'Verify a sending domain',
      why: 'Inboxes trust mail signed for your domain. Add a few DNS records once and every email carries your name.',
      done: setup.domains.verified > 0,
      ...domainStatus,
      lockedReason: provider.connected ? undefined : 'Connect Amazon SES first: domains are registered in your SES account.',
    },
    {
      key: 'api-key',
      title: 'Create an API key',
      why: 'Your app sends with it. It’s shown only once, so keep it in your secrets manager.',
      done: setup.apiKeys > 0,
      status: setup.apiKeys > 0 ? `${setup.apiKeys} active ${setup.apiKeys === 1 ? 'key' : 'keys'}` : undefined,
      statusTone: 'neutral',
    },
    {
      key: 'first-email',
      title: 'Send your first email',
      why: 'Call the API from your app, or send a test from here. It appears in recent emails within seconds.',
      done: setup.firstEmailSent,
      lockedReason: setup.domains.verified > 0 ? undefined : 'Verify a domain first: emails are sent from it.',
    },
  ]
}
