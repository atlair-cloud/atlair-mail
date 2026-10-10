import { createAuthClient } from 'better-auth/vue'
import { API_URL } from '../../../lib/api/client'

export const authClient = createAuthClient({ baseURL: API_URL })
