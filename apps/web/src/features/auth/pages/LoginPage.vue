<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { productName } from '../../../lib/brand'
import AuthCard from '../components/AuthCard.vue'
import { authClient } from '../lib/auth-client'
import { authErrorMessage } from '../lib/auth-error'
import { socialProviders, type SocialProvider } from '../lib/providers'
import { oauthCallbackURLs, safeRedirect } from '../lib/redirect'

const route = useRoute()
const redirect = safeRedirect(route.query.redirect)
const pendingProvider = ref<SocialProvider | null>(null)
const errorMessage = ref(route.query.error ? 'Sign-in didn’t complete. Please try again.' : '')

async function signIn(provider: SocialProvider) {
  pendingProvider.value = provider
  errorMessage.value = ''
  const { error } = await authClient.signIn.social({ provider, ...oauthCallbackURLs(redirect) })
  if (error) {
    errorMessage.value = authErrorMessage(error)
    pendingProvider.value = null
  }
}
</script>

<template>
  <AuthCard :title="`Sign in to ${productName}`" description="Send email from your own domains, with logs and webhooks.">
    <div class="mt-8 grid gap-3" aria-labelledby="auth-title">
      <UButton
        v-if="socialProviders.includes('github')"
        type="button"
        size="xl"
        :loading="pendingProvider === 'github'"
        :disabled="pendingProvider !== null"
        class="flex min-h-11 w-full justify-center gap-2.5 rounded-sm bg-atlair-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-atlair-900 disabled:bg-atlair-950 aria-disabled:bg-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-atlair-950 motion-reduce:transition-none"
        @click="signIn('github')"
      >
        <svg v-if="pendingProvider !== 'github'" class="size-[18px] shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>Continue with GitHub</span>
      </UButton>
      <UButton
        v-if="socialProviders.includes('google')"
        type="button"
        size="xl"
        color="neutral"
        variant="outline"
        :loading="pendingProvider === 'google'"
        :disabled="pendingProvider !== null"
        class="flex min-h-11 w-full justify-center gap-2.5 rounded-sm bg-white px-4 text-sm font-medium text-slate-800 shadow-none ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-atlair-950 motion-reduce:transition-none"
        @click="signIn('google')"
      >
        <img v-if="pendingProvider !== 'google'" class="size-[18px] shrink-0 object-contain" src="https://developers.google.com/identity/images/g-logo.png" alt="" width="18" height="18" />
        <span>Continue with Google</span>
      </UButton>
    </div>

    <p v-if="errorMessage" role="alert" class="mb-0 mt-5 text-center text-xs leading-relaxed text-red-600">{{ errorMessage }}</p>
    <p v-else class="mb-0 mt-5 text-center text-xs leading-relaxed text-slate-500">New to {{ productName }}? Continuing creates your account.</p>
  </AuthCard>
</template>
