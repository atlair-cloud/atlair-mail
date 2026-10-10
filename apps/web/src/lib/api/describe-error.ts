import { productName } from '../brand'
import { ApiError } from './client'

export type LoadErrorKind = 'offline' | 'access' | 'server'

export type LoadErrorDescription = {
  kind: LoadErrorKind
  title: string
  body: string
  detail: string
}

export function describeLoadError(error: unknown, subject: string): LoadErrorDescription {
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())

  if (!(error instanceof ApiError) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      kind: 'offline',
      title: `Can’t reach ${productName}`,
      body: `Your connection or the ${productName} API seems to be down, so ${subject} couldn’t load. Nothing about your email has changed.`,
      detail: `No response · ${time}`,
    }
  }

  if (error.status === 403 || error.status === 404) {
    return {
      kind: 'access',
      title: 'You can’t see this right now',
      body: `Your access to ${subject} may have changed. Ask an owner or admin, or switch to another organization.`,
      detail: `HTTP ${error.status} · ${time}`,
    }
  }

  return {
    kind: 'server',
    title: `${productName} couldn’t load ${subject}`,
    body: 'Something went wrong on our side while reading it. Sending keeps working and nothing has changed; this only affects the panel.',
    detail: `HTTP ${error.status}${error.code ? ` · ${error.code}` : ''} · ${time}`,
  }
}
