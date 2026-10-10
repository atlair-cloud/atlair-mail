<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../../../lib/api/client'
import { productName } from '../../../lib/brand'
import AuthCard from '../components/AuthCard.vue'
import { useCompleteSignIn } from '../composables/useCompleteSignIn'
import { safeRedirect } from '../lib/redirect'

const route = useRoute()
const router = useRouter()

const redirect = safeRedirect(route.query.redirect)
const completeSignIn = useCompleteSignIn(redirect)
const failed = ref(false)
const retrying = ref(false)

function backToLogin(error: string) {
  return router.replace({ name: 'auth-login', query: { error, ...(redirect ? { redirect } : {}) } })
}

async function continueSignIn() {
  failed.value = false
  try {
    await completeSignIn()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return backToLogin('session_missing')
    failed.value = true
  }
}

async function retry() {
  retrying.value = true
  await continueSignIn()
  retrying.value = false
}

onMounted(() => {
  const error = typeof route.query.error === 'string' ? route.query.error : null
  if (error) {
    backToLogin(error)
    return
  }
  continueSignIn()
})
</script>

<template>
  <AuthCard v-if="failed" title="Sign-in didn’t finish" :description="`${productName} didn’t respond. Please try again.`">
    <UButton
      type="button"
      size="xl"
      :loading="retrying"
      class="mt-8 flex min-h-11 w-full justify-center rounded-sm bg-atlair-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-atlair-900 disabled:bg-atlair-950 aria-disabled:bg-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-atlair-950 motion-reduce:transition-none"
      @click="retry"
    >
      Try again
    </UButton>
    <p class="mb-0 mt-5 text-center text-xs">
      <RouterLink class="rounded-sm text-slate-700 hover:text-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" :to="{ name: 'auth-login' }">Back to sign in</RouterLink>
    </p>
  </AuthCard>

  <main v-else class="flex min-h-svh items-center justify-center bg-canvas px-6">
    <div class="reveal flex items-center gap-2.5" role="status">
      <span aria-hidden="true" class="size-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-atlair-950 motion-reduce:animate-none" />
      <h1 tabindex="-1" class="m-0 text-sm font-medium text-slate-600 outline-none">Signing you in…</h1>
    </div>
  </main>
</template>

<style scoped>
.reveal {
  opacity: 0;
  animation: callback-reveal 200ms ease-out 400ms forwards;
}

@keyframes callback-reveal {
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    animation: none;
  }
}
</style>
