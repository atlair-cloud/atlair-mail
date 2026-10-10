import { productName } from '../../../lib/brand'

type AuthClientError = { status?: number; message?: string | null }

export function authErrorMessage(error: AuthClientError) {
  if (error.status === 429) return 'Too many attempts. Wait a minute, then try again.'
  if (!error.status) return `Couldn’t reach ${productName}. Please try again.`
  return error.message || 'Something went wrong. Please try again.'
}
