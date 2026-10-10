<script setup lang="ts">
import { NavArrowLeft } from '@iconoir/vue'
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import StatusScreen from './StatusScreen.vue'

withDefaults(
  defineProps<{
    title?: string
    body?: string
    to: RouteLocationRaw
    toLabel: string
  }>(),
  {
    title: 'We couldn’t find that page',
    body: 'The link may be wrong, or what it pointed to has been deleted or moved.',
  },
)

const route = useRoute()
const router = useRouter()
const canGoBack = computed(() => typeof window !== 'undefined' && typeof window.history.state?.back === 'string')
</script>

<template>
  <StatusScreen mood="lost" eyebrow="404" :title="title" :body="body">
    <RouterLink
      :to="to"
      class="inline-flex items-center justify-center h-9 rounded-sm px-3.5 bg-atlair-950 text-sm font-medium text-white shadow-sm hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
    >{{ toLabel }}</RouterLink>
    <button
      v-if="canGoBack"
      type="button"
      class="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950"
      @click="router.back()"
    >
      <NavArrowLeft aria-hidden="true" class="size-4" />Go back
    </button>
    <template #detail>
      <p class="m-0 truncate font-mono text-[11px] text-slate-500" :title="route.fullPath">{{ route.fullPath }}</p>
    </template>
  </StatusScreen>
</template>
