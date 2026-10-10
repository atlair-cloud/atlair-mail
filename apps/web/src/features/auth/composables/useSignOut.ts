import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '../lib/auth-client'

export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const signingOut = ref(false)

  async function signOut() {
    signingOut.value = true
    await authClient.signOut()
    queryClient.clear()
    await router.replace({ name: 'auth-login' })
  }

  return { signOut, signingOut }
}
