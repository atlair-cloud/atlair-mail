<script setup lang="ts">
import { IconoirProvider } from '@iconoir/vue'
import { useRoute } from 'vue-router'
import CrashScreen from '../components/shared/CrashScreen.vue'
import ErrorBoundary from '../components/shared/ErrorBoundary.vue'
import { appFailure } from './failures'

const route = useRoute()
</script>

<template>
  <UApp :tooltip="{ delayDuration: 250, skipDelayDuration: 300 }">
    <IconoirProvider>
      <main v-if="appFailure && !route.meta.shell" class="flex min-h-svh items-center justify-center bg-canvas">
        <CrashScreen :error="appFailure.error" :kind="appFailure.kind" />
      </main>
      <ErrorBoundary v-else>
        <RouterView />
      </ErrorBoundary>
    </IconoirProvider>
  </UApp>
</template>
