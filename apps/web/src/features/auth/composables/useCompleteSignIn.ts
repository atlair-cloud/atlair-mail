import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { trackSignIn } from '../../../lib/analytics'
import { getMe, meQueryKey } from '../api/get-me'

export function useCompleteSignIn(redirect: string | null) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return async function completeSignIn() {
    queryClient.removeQueries()
    const me = await queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: getMe })
    trackSignIn(me.createdAt)
    await router.replace(redirect ?? { name: 'home' })
  }
}
