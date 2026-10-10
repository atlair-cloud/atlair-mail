<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { appFailure } from '../app/failures'
import { panelTheme } from '../app/panel-theme'
import CrashScreen from '../components/shared/CrashScreen.vue'
import ErrorBoundary from '../components/shared/ErrorBoundary.vue'
import FlickeringGrid from '../components/shared/FlickeringGrid.vue'
import AppTopbar from './organization/AppTopbar.vue'
import PanelProgress from './shell/PanelProgress.vue'
import ShellBar from './shell/ShellBar.vue'

const route = useRoute()
const panel = ref<HTMLElement | null>(null)
const inOrganization = computed(() => typeof route.params.organizationId === 'string')

watch(
  () => route.path,
  () => panel.value?.scrollTo({ top: 0 }),
)
</script>

<template>
  <div class="relative flex h-svh flex-col overflow-hidden bg-frame text-atlair-950 [view-transition-name:app-shell]">
    <div aria-hidden="true" class="frame-gloss pointer-events-none absolute inset-0" />
    <FlickeringGrid :square-size="3" :grid-gap="7" :color="panelTheme === 'dark' ? '#ffffff' : '#1c1917'" :max-opacity="panelTheme === 'dark' ? 0.12 : 0.08" />
    <AppTopbar v-if="inOrganization" />
    <ShellBar v-else />

    <main class="relative flex min-h-0 flex-1 flex-col px-3 sm:px-4">
      <PanelProgress />
      <div
        ref="panel"
        class="shell-panel relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[20px] bg-canvas [view-transition-name:app-panel]"
      >
        <CrashScreen v-if="appFailure" :error="appFailure.error" :kind="appFailure.kind" />
        <ErrorBoundary v-else>
          <RouterView v-slot="{ Component }">
            <Transition name="page">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </ErrorBoundary>
      </div>
    </main>
  </div>
</template>
