import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { getMe, meQueryKey } from '../api/get-me'

export function useCompleteSignIn(redirect: string | null) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return async function completeSignIn() {
    queryClient.removeQueries()
    await queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: getMe })
    await router.replace(redirect ?? { name: 'home' })
  }
}
